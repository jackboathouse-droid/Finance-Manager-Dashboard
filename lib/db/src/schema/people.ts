import { pgTable, serial, varchar, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const peopleTable = pgTable(
  "people",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    user_id: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("people_name_user_id_key").on(t.name, t.user_id)]
);

export type Person = typeof peopleTable.$inferSelect;
export type InsertPerson = typeof peopleTable.$inferInsert;
