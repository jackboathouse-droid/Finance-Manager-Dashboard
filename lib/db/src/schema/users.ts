import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  full_name: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash"), // nullable for Google-only users
  auth_provider: text("auth_provider").notNull().default("email"), // "email" | "google"
  google_id: text("google_id").unique(),
  profile_picture_url: text("profile_picture_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type DbUser = typeof usersTable.$inferSelect;
export type InsertDbUser = typeof usersTable.$inferInsert;
