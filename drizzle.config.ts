import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  // Studio and migration commands need a DB URL. Surface a clear error early.
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL must be set. Run `vercel env pull .env.local` first.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
