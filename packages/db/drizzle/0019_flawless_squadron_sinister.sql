CREATE TABLE "user_shipping_addresses" (
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
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" varchar(32) DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "manual_sale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "manual_sale_comment" text;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD COLUMN "thumbnail_url" varchar(1024);--> statement-breakpoint
ALTER TABLE "user_shipping_addresses" ADD CONSTRAINT "user_shipping_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_shipping_addresses_user_created_idx" ON "user_shipping_addresses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_shipping_addresses_user_default_idx" ON "user_shipping_addresses" USING btree ("user_id","is_default");