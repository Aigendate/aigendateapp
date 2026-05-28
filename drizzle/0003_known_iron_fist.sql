ALTER TABLE "hospitals" ADD COLUMN "city" text;
--> statement-breakpoint
-- Best-effort backfill: addresses follow the "<street>, <city>, Paraguay" shape.
UPDATE "hospitals"
SET "city" = trim(regexp_replace("address", '^.*,\s*([^,]+)\s*,\s*Paraguay\s*$', '\1'))
WHERE "city" IS NULL
  AND "address" ~ ',\s*[^,]+\s*,\s*Paraguay\s*$';