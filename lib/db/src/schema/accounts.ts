import { pgTable, serial, text, varchar, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // bank, credit_card
  person: text("person").notNull(),
  user_id: integer("user_id").notNull().references(() => usersTable.id),
  starting_balance: numeric("starting_balance", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
