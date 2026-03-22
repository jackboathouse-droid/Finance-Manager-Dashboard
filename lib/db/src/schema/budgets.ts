import { pgTable, serial, integer, numeric, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { subcategoriesTable } from "./subcategories";
import { usersTable } from "./users";

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  category_id: integer("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "cascade" }),
  subcategory_id: integer("subcategory_id").references(() => subcategoriesTable.id, {
    onDelete: "set null",
  }),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  budget_amount: numeric("budget_amount", { precision: 12, scale: 2 }).notNull(),
  is_recurring: boolean("is_recurring").notNull().default(false),
  user_id: integer("user_id").references(() => usersTable.id),
});

export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ id: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgetsTable.$inferSelect;
