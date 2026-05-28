#!/usr/bin/env node
// Vercel build entry. On production deploys, applies pending Drizzle
// migrations against DATABASE_URL before running `next build`. Preview and
// development deploys skip the migrate step so they can't mutate the prod DB.
//
// Wired in via `package.json` → "vercel-build" (Vercel picks this over "build"
// automatically when present). To run locally with the same gating: set
// VERCEL_ENV=production and DATABASE_URL, then `npm run vercel-build`.

import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV ?? "local";

if (env === "production") {
  if (!process.env.DATABASE_URL) {
    console.error("[vercel-build] DATABASE_URL must be set on Vercel for production migrations");
    process.exit(1);
  }
  console.log("[vercel-build] Production deploy — applying Drizzle migrations");
  execSync("node --import tsx server/migrate.ts", { stdio: "inherit" });
} else {
  console.log(`[vercel-build] VERCEL_ENV=${env} — skipping migrations`);
}

console.log("[vercel-build] Running next build");
execSync("next build", { stdio: "inherit" });
