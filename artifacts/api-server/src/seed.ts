import { db } from "@workspace/db";
import { categoriesTable, subcategoriesTable } from "@workspace/db";

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
