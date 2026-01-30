CREATE TABLE "shop_settings" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  bank_details text,
  payout_account varchar(128),
  payout_notes text,
  order_notes text,
  inventory_notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shop_settings_tenant_id_unique ON "shop_settings" (tenant_id);
