import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const waitlistTable = pgTable("waitlist", {
  id:        serial("id").primaryKey(),
  email:     text("email").notNull().unique(),
  plan:      text("plan").notNull().default("pro"),    // "starter" | "pro" | "enterprise"
  source:    text("source"),                            // "landing", "pricing", etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Waitlist = typeof waitlistTable.$inferSelect;
