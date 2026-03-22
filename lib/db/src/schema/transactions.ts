import { pgTable, serial, text, varchar, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";
import { categoriesTable } from "./categories";
import { subcategoriesTable } from "./subcategories";
import { usersTable } from "./users";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  account_id: integer("account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  category_id: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  subcategory_id: integer("subcategory_id").references(() => subcategoriesTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  person: text("person").notNull(),
  type: varchar("type", { length: 10 }).notNull(), // income, expense, transfer
  user_id: integer("user_id").references(() => usersTable.id),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
