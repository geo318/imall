ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "category_key" varchar(160),
  ADD COLUMN IF NOT EXISTS "name_en" varchar(256),
  ADD COLUMN IF NOT EXISTS "name_ka" varchar(256),
  ADD COLUMN IF NOT EXISTS "name_ru" varchar(256),
  ADD COLUMN IF NOT EXISTS "icon" varchar(32) DEFAULT '📦';

UPDATE "categories"
SET
  "category_key" = COALESCE(NULLIF("category_key", ''), "slug"),
  "name_en" = COALESCE(NULLIF("name_en", ''), "name"),
  "icon" = COALESCE(NULLIF("icon", ''), '📦')
WHERE
  "category_key" IS NULL
  OR "category_key" = ''
  OR "name_en" IS NULL
  OR "name_en" = ''
  OR "icon" IS NULL
  OR "icon" = '';

ALTER TABLE "categories"
  ALTER COLUMN "category_key" SET NOT NULL,
  ALTER COLUMN "icon" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_category_key_unique"
  ON "categories" ("category_key");
