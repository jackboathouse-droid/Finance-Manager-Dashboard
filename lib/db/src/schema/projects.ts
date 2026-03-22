import { pgTable, serial, text, numeric, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => usersTable.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }).default("piggy-bank").notNull(),
  color: varchar("color", { length: 20 }).default("#4FC3F7").notNull(),
  target_amount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  current_amount: numeric("current_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active | paused | completed
  deadline: text("deadline"), // YYYY-MM-DD, optional
  created_at: timestamp("created_at").defaultNow().notNull(),
  milestone_notified: integer("milestone_notified").default(0).notNull(), // last milestone %  notified (0,10,20,...,100)
});

export const projectContributionsTable = pgTable("project_contributions", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id")
    .references(() => projectsTable.id, { onDelete: "cascade" })
    .notNull(),
  user_id: integer("user_id").references(() => usersTable.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  account_id: integer("account_id"),      // source account (nullable)
  transaction_id: integer("transaction_id"), // linked ledger transaction (nullable)
  contributed_at: timestamp("contributed_at").defaultNow().notNull(),
});

export type Project = typeof projectsTable.$inferSelect;
export type ProjectContribution = typeof projectContributionsTable.$inferSelect;
