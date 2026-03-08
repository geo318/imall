CREATE TABLE IF NOT EXISTS "user_shipping_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "label" varchar(128),
  "first_name" varchar(128) NOT NULL,
  "last_name" varchar(128) NOT NULL,
  "email" varchar(256),
  "phone" varchar(64),
  "address_line1" varchar(256) NOT NULL,
  "city" varchar(128) NOT NULL,
  "region" varchar(128),
  "postal_code" varchar(32),
  "country" varchar(64) DEFAULT 'GE' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_shipping_addresses_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "user_shipping_addresses"
      ADD CONSTRAINT "user_shipping_addresses_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "user_shipping_addresses_user_created_idx"
  ON "user_shipping_addresses" USING btree ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "user_shipping_addresses_user_default_idx"
  ON "user_shipping_addresses" USING btree ("user_id", "is_default");
