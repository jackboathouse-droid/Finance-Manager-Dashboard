import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  accountsTable,
  categoriesTable,
  subcategoriesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  try {
    const { month, category_id, account_id, type } = req.query as Record<string, string>;

    let conditions: any[] = [];

    if (month) {
      conditions.push(sql`to_char(${transactionsTable.date}, 'YYYY-MM') = ${month}`);
    }
    if (category_id) {
      conditions.push(eq(transactionsTable.category_id, parseInt(category_id)));
    }
    if (account_id) {
      conditions.push(eq(transactionsTable.account_id, parseInt(account_id)));
    }
    if (type) {
      conditions.push(eq(transactionsTable.type, type));
    }

    const results = await db
      .select({
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
      })
      .from(transactionsTable)
      .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${transactionsTable.date} DESC`);

    res.json(
      results.map((r) => ({
        ...r,
        amount: parseFloat(r.amount),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
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
      })
      .returning();

    const [enriched] = await db
      .select({
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
      })
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
    const { csv_data } = req.body as { csv_data: string };
    const lines = csv_data.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    let imported = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] ?? "";
        });

        if (!row.date || !row.description || !row.account_id || !row.amount || !row.person || !row.type) {
          errors.push(`Row ${i + 1}: missing required fields`);
          continue;
        }

        await db.insert(transactionsTable).values({
          date: row.date,
          description: row.description,
          account_id: parseInt(row.account_id),
          category_id: row.category_id ? parseInt(row.category_id) : null,
          subcategory_id: row.subcategory_id ? parseInt(row.subcategory_id) : null,
          amount: row.amount,
          person: row.person,
          type: row.type,
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
    const id = parseInt(req.params.id);
    const [tx] = await db
      .select({
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
      })
      .from(transactionsTable)
      .leftJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
      .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(transactionsTable.subcategory_id, subcategoriesTable.id))
      .where(eq(transactionsTable.id, id));

    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    res.json({ ...tx, amount: parseFloat(tx.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
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
      .where(eq(transactionsTable.id, id));

    const [enriched] = await db
      .select({
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
      })
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
    const id = parseInt(req.params.id);
    await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

export default router;
