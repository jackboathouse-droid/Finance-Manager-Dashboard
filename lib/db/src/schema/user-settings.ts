import { pgTable, serial, integer, varchar, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userSettingsTable = pgTable(
  "user_settings",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    date_format: varchar("date_format", { length: 20 }).notNull().default("MM/DD/YYYY"),
    budget_alerts: boolean("budget_alerts").notNull().default(true),
    milestone_alerts: boolean("milestone_alerts").notNull().default(true),
    weekly_summary: boolean("weekly_summary").notNull().default(false),
    recurring_budgets: boolean("recurring_budgets").notNull().default(true),
    rollover_budget: boolean("rollover_budget").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    last_budget_alert_sent: timestamp("last_budget_alert_sent", { withTimezone: true }),
    last_weekly_digest_sent: timestamp("last_weekly_digest_sent", { withTimezone: true }),
  },
  (t) => [unique("user_settings_user_id_key").on(t.user_id)]
);

export type UserSettings = typeof userSettingsTable.$inferSelect;
export type InsertUserSettings = typeof userSettingsTable.$inferInsert;
