import { pgTable, serial, text, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const subcategoriesTable = pgTable("subcategories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category_id: integer("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 10 }).notNull(), // income, expense
});

export const insertSubcategorySchema = createInsertSchema(subcategoriesTable).omit({ id: true });
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategoriesTable.$inferSelect;
