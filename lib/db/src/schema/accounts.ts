import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // bank, credit_card
  person: text("person").notNull(),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
