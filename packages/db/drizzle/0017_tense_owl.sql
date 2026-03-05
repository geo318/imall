CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"category_key" varchar(160) NOT NULL,
	"name" varchar(256) NOT NULL,
	"name_en" varchar(256),
	"name_ka" varchar(256),
	"name_ru" varchar(256),
	"icon" varchar(32) DEFAULT '📦' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_relations" (
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_relations_parent_id_child_id_pk" PRIMARY KEY("parent_id","child_id")
);
--> statement-breakpoint
CREATE TABLE "product_option_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"tenant_option_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_variant_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"option_key" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_option_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_option_id" uuid NOT NULL,
	"value" varchar(128) NOT NULL,
	"value_key" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "seller_email" varchar(256);--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "seller_phone" varchar(64);--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "seller_rules" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "can_auction" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "category_relations" ADD CONSTRAINT "category_relations_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_relations" ADD CONSTRAINT "category_relations_child_id_categories_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_definitions" ADD CONSTRAINT "product_option_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_definitions" ADD CONSTRAINT "product_option_definitions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_definitions" ADD CONSTRAINT "product_option_definitions_tenant_option_id_tenant_variant_options_id_fk" FOREIGN KEY ("tenant_option_id") REFERENCES "public"."tenant_variant_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_variant_options" ADD CONSTRAINT "tenant_variant_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_product_option_id_product_option_definitions_id_fk" FOREIGN KEY ("product_option_id") REFERENCES "public"."product_option_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_category_key_unique" ON "categories" USING btree ("category_key");--> statement-breakpoint
CREATE UNIQUE INDEX "product_option_definitions_product_option_unique" ON "product_option_definitions" USING btree ("product_id","tenant_option_id");--> statement-breakpoint
CREATE INDEX "product_option_definitions_product_sort_idx" ON "product_option_definitions" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_variant_options_tenant_option_key_unique" ON "tenant_variant_options" USING btree ("tenant_id","option_key");--> statement-breakpoint
CREATE INDEX "tenant_variant_options_tenant_name_idx" ON "tenant_variant_options" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_option_values_variant_option_unique" ON "variant_option_values" USING btree ("variant_id","product_option_id");--> statement-breakpoint
CREATE INDEX "variant_option_values_variant_idx" ON "variant_option_values" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "variant_option_values_product_option_idx" ON "variant_option_values" USING btree ("product_option_id");--> statement-breakpoint
CREATE INDEX "auctions_tenant_status_ends_at_idx" ON "auctions" USING btree ("tenant_id","status","ends_at");--> statement-breakpoint
CREATE INDEX "auctions_status_ends_at_idx" ON "auctions" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "auctions_variant_id_idx" ON "auctions" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "bids_auction_created_at_idx" ON "bids" USING btree ("auction_id","created_at");--> statement-breakpoint
CREATE INDEX "bids_bidder_id_idx" ON "bids" USING btree ("bidder_id");--> statement-breakpoint
CREATE INDEX "cart_items_cart_variant_idx" ON "cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "inventory_ledger_tenant_variant_idx" ON "inventory_ledger" USING btree ("tenant_id","variant_id");--> statement-breakpoint
CREATE INDEX "inventory_ledger_variant_created_at_idx" ON "inventory_ledger" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "memberships_user_tenant_idx" ON "memberships" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_user_idx" ON "memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "product_images_product_sort_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "products_tenant_deleted_created_at_idx" ON "products" USING btree ("tenant_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tenants_can_sell_created_at_idx" ON "tenants" USING btree ("can_sell","created_at");--> statement-breakpoint
CREATE INDEX "users_external_auth_id_idx" ON "users" USING btree ("external_auth_id");--> statement-breakpoint
CREATE INDEX "variants_product_id_idx" ON "variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_tenant_product_idx" ON "variants" USING btree ("tenant_id","product_id");