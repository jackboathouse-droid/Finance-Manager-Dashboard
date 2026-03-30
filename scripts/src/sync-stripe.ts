import Stripe from "stripe";
import pg from "pg";

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
  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  const data = await resp.json();
  const secretKey = data.items?.[0]?.settings?.secret;
  if (!secretKey) throw new Error("Stripe dev connection not found");
  return { secretKey };
}

async function syncStripe() {
  const { secretKey } = await getCredentials();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const products = await stripe.products.list({ active: true, limit: 100 });
    console.log(`Syncing ${products.data.length} products...`);
    for (const prod of products.data) {
      await pool.query(
        `INSERT INTO stripe.products (id, name, description, active, metadata, created, updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET name=$2, description=$3, active=$4, metadata=$5, updated=$7`,
        [prod.id, prod.name, prod.description ?? null, prod.active, JSON.stringify(prod.metadata),
          new Date(prod.created * 1000), new Date(prod.updated * 1000)]
      );
      console.log("  Product:", prod.id, prod.name);
    }

    const prices = await stripe.prices.list({ active: true, limit: 100 });
    console.log(`Syncing ${prices.data.length} prices...`);
    for (const price of prices.data) {
      await pool.query(
        `INSERT INTO stripe.prices (id, product, unit_amount, currency, active, recurring, metadata, created, updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET unit_amount=$3, active=$5, recurring=$6, updated=$9`,
        [price.id, price.product, price.unit_amount, price.currency, price.active,
          JSON.stringify(price.recurring), JSON.stringify(price.metadata),
          new Date(price.created * 1000), new Date(price.updated * 1000)]
      );
      console.log("  Price:", price.id, `${price.unit_amount} ${price.currency}`);
    }

    console.log("Stripe sync complete!");
  } finally {
    await pool.end();
  }
}

syncStripe().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
