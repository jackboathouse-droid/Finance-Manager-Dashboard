import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const manualAssetsTable = pgTable("manual_assets", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // "asset" | "liability"
  category: text("category").notNull().default(""),
  value: numeric("value", { precision: 15, scale: 2 }).notNull().default("0"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertManualAssetSchema = createInsertSchema(manualAssetsTable).omit({ id: true, created_at: true });
export type InsertManualAsset = z.infer<typeof insertManualAssetSchema>;
export type ManualAsset = typeof manualAssetsTable.$inferSelect;
