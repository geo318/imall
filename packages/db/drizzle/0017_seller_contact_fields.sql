ALTER TABLE "shop_settings"
  ADD COLUMN IF NOT EXISTS "seller_email" varchar(256),
  ADD COLUMN IF NOT EXISTS "seller_phone" varchar(64),
  ADD COLUMN IF NOT EXISTS "seller_rules" text;

