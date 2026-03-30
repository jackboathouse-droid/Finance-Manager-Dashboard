import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  full_name: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash"), // nullable for Google-only users
  auth_provider: text("auth_provider").notNull().default("email"), // "email" | "google"
  role: text("role").notNull().default("user"), // "admin" | "user"
  google_id: text("google_id").unique(),
  profile_picture_url: text("profile_picture_url"),
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // "free" | "pro"
  stripe_customer_id: text("stripe_customer_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type DbUser = typeof usersTable.$inferSelect;
export type InsertDbUser = typeof usersTable.$inferInsert;
