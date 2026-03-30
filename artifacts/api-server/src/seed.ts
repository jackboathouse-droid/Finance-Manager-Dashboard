import { db, pool } from "@workspace/db";
import { categoriesTable, subcategoriesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

type CategorySeed = {
  name: string;
  type: "income" | "expense";
  subcategories: string[];
};

const DEFAULT_CATEGORIES: CategorySeed[] = [
  // ── Expense categories ──────────────────────────────────────────────────────
  {
    name: "Housing",
    type: "expense",
    subcategories: ["Rent", "Mortgage", "Utilities", "Home Insurance", "HOA Fees", "Home Repairs"],
  },
  {
    name: "Food & Dining",
    type: "expense",
    subcategories: ["Groceries", "Restaurants", "Coffee & Cafes", "Fast Food", "Takeout"],
  },
  {
    name: "Transportation",
    type: "expense",
    subcategories: ["Gas", "Car Insurance", "Parking", "Public Transit", "Rideshare", "Car Maintenance"],
  },
  {
    name: "Health",
    type: "expense",
    subcategories: ["Doctor", "Dentist", "Pharmacy", "Gym", "Health Insurance"],
  },
  {
    name: "Entertainment",
    type: "expense",
    subcategories: ["Movies", "Music", "Gaming", "Streaming Services", "Books & Magazines"],
  },
  {
    name: "Shopping",
    type: "expense",
    subcategories: ["Clothing", "Electronics", "Home Goods", "Personal Care", "Gifts"],
  },
  {
    name: "Education",
    type: "expense",
    subcategories: ["Tuition", "Books & Supplies", "Online Courses", "School Fees"],
  },
  {
    name: "Travel",
    type: "expense",
    subcategories: ["Flights", "Hotels", "Car Rental", "Vacation Activities"],
  },
  {
    name: "Subscriptions",
    type: "expense",
    subcategories: ["Software", "Newspapers & Magazines", "Memberships"],
  },
  {
    name: "Insurance",
    type: "expense",
    subcategories: ["Life Insurance", "Renters Insurance", "Pet Insurance"],
  },
  {
    name: "Taxes",
    type: "expense",
    subcategories: ["Federal Tax", "State Tax", "Property Tax"],
  },
  {
    name: "Savings & Investments",
    type: "expense",
    subcategories: ["Emergency Fund", "Retirement Contribution", "Investment Purchase"],
  },
  // ── Income categories ───────────────────────────────────────────────────────
  {
    name: "Salary & Wages",
    type: "income",
    subcategories: ["Paycheck", "Bonus", "Commission", "Overtime"],
  },
  {
    name: "Business Income",
    type: "income",
    subcategories: ["Freelance", "Consulting", "Contract Work"],
  },
  {
    name: "Investment Income",
    type: "income",
    subcategories: ["Dividends", "Capital Gains", "Interest", "Rental Income"],
  },
  {
    name: "Other Income",
    type: "income",
    subcategories: ["Tax Refund", "Gifts Received", "Reimbursements", "Side Hustle"],
  },
];

/**
 * Ensures the session table exists in PostgreSQL.
 * Required by connect-pg-simple. Safe to run on every startup.
 */
export async function ensureSessionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    ) WITH (OIDS=FALSE);

    CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire"
      ON "user_sessions" ("expire");
  `);
}

export async function seedDefaultCategories() {
  const existing = await db.select().from(categoriesTable).limit(1);

  if (existing.length > 0) {
    return;
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const [inserted] = await db
      .insert(categoriesTable)
      .values({ name: cat.name, type: cat.type })
      .returning();

    if (inserted && cat.subcategories.length > 0) {
      await db.insert(subcategoriesTable).values(
        cat.subcategories.map((name) => ({
          name,
          category_id: inserted.id,
          type: cat.type,
        }))
      );
    }
  }

  console.log("[seed] Inserted default categories and subcategories.");
}

/**
 * Ensures the admin account exists in the database.
 * Credentials are read from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 * Defaults to admin@bubble.app / admin only in non-production environments.
 */
export async function ensureAdminUser() {
  const isProduction = process.env["NODE_ENV"] === "production";

  const ADMIN_EMAIL =
    process.env["ADMIN_EMAIL"] ??
    (isProduction ? undefined : "admin@bubble.app");
  const ADMIN_PASSWORD =
    process.env["ADMIN_PASSWORD"] ??
    (isProduction ? undefined : "admin");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn(
      "[seed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin user creation."
    );
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing) {
    return; // Admin already exists
  }

  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await db.insert(usersTable).values({
    full_name: "Admin",
    email: ADMIN_EMAIL,
    password_hash,
    auth_provider: "email",
    role: "admin",
  });

  console.log(`[seed] Admin user created: ${ADMIN_EMAIL}`);
}
