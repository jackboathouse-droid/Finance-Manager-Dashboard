import Stripe from "stripe";

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) throw new Error("X-Replit-Token not found");

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });

  const data = await response.json();
  const conn = data.items?.[0];
  if (!conn?.settings?.secret) throw new Error("Stripe dev connection not found");
  return { secretKey: conn.settings.secret };
}

async function seedProducts() {
  try {
    const { secretKey } = await getCredentials();
    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });

    console.log("Checking for existing Pro Plan...");
    const existing = await stripe.products.search({
      query: "name:'Bubble Pro' AND active:'true'",
    });

    if (existing.data.length > 0) {
      console.log("Bubble Pro already exists:", existing.data[0].id);
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      console.log("Existing prices:");
      prices.data.forEach((p) =>
        console.log(`  ${p.id} — ${p.unit_amount} ${p.currency}/${(p.recurring as any)?.interval}`)
      );
      return;
    }

    const product = await stripe.products.create({
      name: "Bubble Pro",
      description: "Unlimited accounts, transactions, and advanced financial insights.",
    });
    console.log("Created product:", product.id);

    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: 999,
      currency: "usd",
      recurring: { interval: "month" },
    });
    console.log("Monthly price:", monthly.id, "($9.99/mo)");

    const yearly = await stripe.prices.create({
      product: product.id,
      unit_amount: 7999,
      currency: "usd",
      recurring: { interval: "year" },
    });
    console.log("Yearly price:", yearly.id, "($79.99/yr)");

    console.log("Done! Stripe webhooks will sync these to the database automatically.");
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

seedProducts();
