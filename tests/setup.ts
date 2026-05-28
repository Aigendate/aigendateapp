import "dotenv/config";

// Prefer a dedicated test DB so `npm test` doesn't trash the dev seed.
// Run `npm run db:test:setup` once to create + migrate it, then set
// DATABASE_URL_TEST in .env (or .env.test).
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
} else if (process.env.DATABASE_URL) {
  console.warn(
    "[tests] DATABASE_URL_TEST not set — tests will run against DATABASE_URL " +
      "and TRUNCATE its tables. Run `npm run db:test:setup` to isolate.",
  );
} else {
  throw new Error(
    "DATABASE_URL not set. Start the local Postgres with `docker compose up -d postgres` and ensure .env exists.",
  );
}
