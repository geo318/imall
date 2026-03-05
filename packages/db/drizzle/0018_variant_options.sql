CREATE TABLE IF NOT EXISTS "tenant_variant_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "option_key" varchar(64) NOT NULL,
  "name" varchar(128) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_option_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "tenant_option_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "variant_option_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "product_option_id" uuid NOT NULL,
  "value" varchar(128) NOT NULL,
  "value_key" varchar(128) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "tenant_variant_options"
    ADD CONSTRAINT "tenant_variant_options_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "product_option_definitions"
    ADD CONSTRAINT "product_option_definitions_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "product_option_definitions"
    ADD CONSTRAINT "product_option_definitions_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "product_option_definitions"
    ADD CONSTRAINT "product_option_definitions_tenant_option_id_tenant_variant_options_id_fk"
    FOREIGN KEY ("tenant_option_id") REFERENCES "public"."tenant_variant_options"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "variant_option_values"
    ADD CONSTRAINT "variant_option_values_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "variant_option_values"
    ADD CONSTRAINT "variant_option_values_variant_id_variants_id_fk"
    FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "variant_option_values"
    ADD CONSTRAINT "variant_option_values_product_option_id_product_option_definitions_id_fk"
    FOREIGN KEY ("product_option_id") REFERENCES "public"."product_option_definitions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_variant_options_tenant_option_key_unique"
  ON "tenant_variant_options" USING btree ("tenant_id", "option_key");
CREATE INDEX IF NOT EXISTS "tenant_variant_options_tenant_name_idx"
  ON "tenant_variant_options" USING btree ("tenant_id", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "product_option_definitions_product_option_unique"
  ON "product_option_definitions" USING btree ("product_id", "tenant_option_id");
CREATE INDEX IF NOT EXISTS "product_option_definitions_product_sort_idx"
  ON "product_option_definitions" USING btree ("product_id", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "variant_option_values_variant_option_unique"
  ON "variant_option_values" USING btree ("variant_id", "product_option_id");
CREATE INDEX IF NOT EXISTS "variant_option_values_variant_idx"
  ON "variant_option_values" USING btree ("variant_id");
CREATE INDEX IF NOT EXISTS "variant_option_values_product_option_idx"
  ON "variant_option_values" USING btree ("product_option_id");
