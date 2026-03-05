ALTER TABLE "variant_option_values"
  ADD COLUMN IF NOT EXISTS "thumbnail_url" varchar(1024);
