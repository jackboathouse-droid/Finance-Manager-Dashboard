import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  accountsTable,
  categoriesTable,
  subcategoriesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { categoryBelongsToUser, subcategoryBelongsToUser } from "../lib/validate-ownership";

const router: IRouter = Router();

const TX_SELECT = {
  id: transactionsTable.id,
  date: transactionsTable.date,
  description: transactionsTable.description,
  account_id: transactionsTable.account_id,
  category_id: transactionsTable.category_id,
  subcategory_id: transactionsTable.subcategory_id,
  amount: transactionsTable.amount,
  person: transactionsTable.person,
  type: transactionsTable.type,
  account_name: accountsTable.name,
  category_name: categoriesTable.name,
  subcategory_name: subcategoriesTable.name,
};

function withJoins(q: ReturnType<typeof db.select>) {
  return (q as any)
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
    .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id));
}

router.get("/transactions", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { month, category_id, account_id, type, limit: limitParam } = req.query as Record<string, string>;

    const conditions: any[] = [eq(transactionsTable.user_id, userId)];

    if (month) conditions.push(sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`);
    if (category_id) conditions.push(eq(transactionsTable.category_id, parseInt(category_id)));
    if (account_id) conditions.push(eq(transactionsTable.account_id, parseInt(account_id)));
    if (type) conditions.push(eq(transactionsTable.type, type));

    const limitNum = limitParam ? parseInt(limitParam) : undefined;

    const baseQ = db
      .select(TX_SELECT)
      .from(transactionsTable)
      .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id))
      .where(and(...conditions))
      .orderBy(sql`${transactionsTable.date} DESC`);

    const results = limitNum && limitNum > 0 ? await baseQ.limit(limitNum) : await baseQ;

    res.json(results.map((r) => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.get("/transactions/people", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const results = await db
      .selectDistinct({ person: sql<string>`TRIM(${transactionsTable.person})` })
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId))
      .orderBy(sql`TRIM(${transactionsTable.person})`);

    const people = results.map((r) => r.person).filter((p): p is string => Boolean(p));
    res.json(people);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch people" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const body = req.body as {
      date: string;
      description: string;
      account_id: number;
      category_id?: number | null;
      subcategory_id?: number | null;
      amount: number;
      person: string;
      type: string;
    };

    // Validate category/subcategory ownership
    if (!(await categoryBelongsToUser(body.category_id, userId))) {
      return res.status(403).json({ error: "Invalid category." });
    }
    if (!(await subcategoryBelongsToUser(body.subcategory_id, userId))) {
      return res.status(403).json({ error: "Invalid subcategory." });
    }

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        date: body.date,
        description: body.description,
        account_id: body.account_id,
        category_id: body.category_id ?? null,
        subcategory_id: body.subcategory_id ?? null,
        amount: String(body.amount),
        person: body.person,
        type: body.type,
        user_id: userId,
      })
      .returning();

    const [enriched] = await db
      .select(TX_SELECT)
      .from(transactionsTable)
      .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id))
      .where(eq(transactionsTable.id, tx.id));

    res.status(201).json({ ...enriched, amount: parseFloat(enriched.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.post("/transactions/import", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const { csv_data } = req.body as { csv_data: string };
    const lines = csv_data.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    let imported = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

        if (!row.date || !row.description || !row.account_id || !row.amount || !row.person || !row.type) {
          errors.push(`Row ${i + 1}: missing required fields`);
          continue;
        }

        const parsedCategoryId = row.category_id ? parseInt(row.category_id) : null;
        const parsedSubcategoryId = row.subcategory_id ? parseInt(row.subcategory_id) : null;

        // Validate ownership of category/subcategory IDs before inserting
        if (!(await categoryBelongsToUser(parsedCategoryId, userId))) {
          errors.push(`Row ${i + 1}: invalid or unauthorized category_id`);
          continue;
        }
        if (!(await subcategoryBelongsToUser(parsedSubcategoryId, userId))) {
          errors.push(`Row ${i + 1}: invalid or unauthorized subcategory_id`);
          continue;
        }

        await db.insert(transactionsTable).values({
          date: row.date,
          description: row.description,
          account_id: parseInt(row.account_id),
          category_id: parsedCategoryId,
          subcategory_id: parsedSubcategoryId,
          amount: row.amount,
          person: row.person,
          type: row.type,
          user_id: userId,
        });
        imported++;
      } catch (rowErr) {
        errors.push(`Row ${i + 1}: ${String(rowErr)}`);
      }
    }

    res.json({ imported, errors });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to import transactions" });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    const [tx] = await db
      .select(TX_SELECT)
      .from(transactionsTable)
      .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id))
      .where(and(eq(transactionsTable.id, id), eq(transactionsTable.user_id, userId)));

    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    res.json({ ...tx, amount: parseFloat(tx.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    const body = req.body as {
      date: string;
      description: string;
      account_id: number;
      category_id?: number | null;
      subcategory_id?: number | null;
      amount: number;
      person: string;
      type: string;
    };

    // Validate category/subcategory ownership
    if (!(await categoryBelongsToUser(body.category_id, userId))) {
      return res.status(403).json({ error: "Invalid category." });
    }
    if (!(await subcategoryBelongsToUser(body.subcategory_id, userId))) {
      return res.status(403).json({ error: "Invalid subcategory." });
    }

    await db
      .update(transactionsTable)
      .set({
        date: body.date,
        description: body.description,
        account_id: body.account_id,
        category_id: body.category_id ?? null,
        subcategory_id: body.subcategory_id ?? null,
        amount: String(body.amount),
        person: body.person,
        type: body.type,
      })
      .where(and(eq(transactionsTable.id, id), eq(transactionsTable.user_id, userId)));

    const [enriched] = await db
      .select(TX_SELECT)
      .from(transactionsTable)
      .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id))
      .where(eq(transactionsTable.id, id));

    if (!enriched) return res.status(404).json({ error: "Transaction not found" });
    res.json({ ...enriched, amount: parseFloat(enriched.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required." });

    const id = parseInt(req.params.id);
    await db
      .delete(transactionsTable)
      .where(and(eq(transactionsTable.id, id), eq(transactionsTable.user_id, userId)));
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

export default router;
