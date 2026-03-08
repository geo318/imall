ALTER TABLE "orders"
ADD COLUMN "payment_method" varchar(32) DEFAULT 'card' NOT NULL;

ALTER TABLE "orders"
ADD COLUMN "manual_sale" boolean DEFAULT false NOT NULL;

ALTER TABLE "orders"
ADD COLUMN "manual_sale_comment" text;
