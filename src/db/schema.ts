import { pgTable, text, timestamp, jsonb, serial } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  data: jsonb("data").notNull(), // Full project JSON
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).defaultNow().notNull(),
});