ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "can_auction" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(160) NOT NULL,
  "name" varchar(256) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_slug_unique'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_slug_unique" UNIQUE ("slug");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "category_relations" (
  "parent_id" uuid NOT NULL,
  "child_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("parent_id", "child_id")
);

ALTER TABLE "category_relations"
  ADD CONSTRAINT "category_relations_parent_id_categories_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "category_relations"
  ADD CONSTRAINT "category_relations_child_id_categories_id_fk"
  FOREIGN KEY ("child_id") REFERENCES "categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
