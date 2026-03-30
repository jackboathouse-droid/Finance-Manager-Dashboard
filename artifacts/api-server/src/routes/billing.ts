import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";

const router: IRouter = Router();

function getAppBaseUrl(req: any): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  return `${req.protocol}://${req.get("host")}`;
}

router.get("/billing/status", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const [user] = await db
      .select({
        id: usersTable.id,
        plan: usersTable.plan,
        stripe_customer_id: usersTable.stripe_customer_id,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return res.status(404).json({ error: "User not found." });

    let subscription: any = null;
    let derivedPlan = user.plan ?? "free";

    if (user.stripe_customer_id) {
      try {
        const result = await db.execute(
          sql`SELECT * FROM stripe.subscriptions WHERE customer = ${user.stripe_customer_id} AND status = 'active' LIMIT 1`
        );
        subscription = result.rows[0] || null;
        // Sync plan from subscription status
        const newPlan = subscription ? "pro" : "free";
        if (newPlan !== derivedPlan) {
          await db.update(usersTable).set({ plan: newPlan }).where(eq(usersTable.id, userId));
          derivedPlan = newPlan;
        }
      } catch {
        // stripe schema may not exist yet; ignore
      }
    }

    const publishableKey = await getStripePublishableKey().catch(() => null);

    res.json({
      plan: derivedPlan,
      stripe_customer_id: user.stripe_customer_id,
      subscription,
      publishableKey,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch billing status." });
  }
});

router.post("/billing/checkout", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { priceId } = req.body as { priceId: string };
    if (!priceId) return res.status(400).json({ error: "priceId is required." });

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return res.status(404).json({ error: "User not found." });

    const stripe = await getUncachableStripeClient();
    const base = getAppBaseUrl(req);

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripe_customer_id: customerId })
        .where(eq(usersTable.id, userId));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/pricing`,
      metadata: { userId: String(userId) },
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

router.post("/billing/portal", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return res.status(404).json({ error: "User not found." });
    if (!user.stripe_customer_id)
      return res.status(400).json({ error: "No billing account found." });

    const stripe = await getUncachableStripeClient();
    const base = getAppBaseUrl(req);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${base}/settings`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create billing portal session." });
  }
});

router.get("/billing/products", async (req, res) => {
  try {
    let rows: any[] = [];
    try {
      const result = await db.execute(
        sql`
          WITH paginated_products AS (
            SELECT id, name, description, metadata, active
            FROM stripe.products
            WHERE active = true
            ORDER BY id
          )
          SELECT
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active as price_active
          FROM paginated_products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          ORDER BY p.id, pr.unit_amount
        `
      );
      rows = result.rows as any[];
    } catch {
      // stripe schema not yet populated
    }

    const productsMap = new Map<string, any>();
    for (const row of rows) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

export default router;
