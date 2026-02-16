import {
  customerMessages,
  customerSegmentMembers,
  customerSegments,
  customers,
  db,
  fulfillmentRules,
  inventoryLedger,
  orderItems,
  orders,
  payoutLedger,
  payouts,
  returnItems,
  returns,
  shippingProfiles,
  shopSettings,
  tenants,
  variants,
} from "@repo/db";
import { slugify } from "@repo/shared";
import { and, desc, eq, inArray, ne, sql, sum } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { adminOrSuperadminGuard, getTenantIdBySlug } from "../context";

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  bankDetails: z.string().optional(),
  payoutAccount: z.string().optional(),
  payoutNotes: z.string().optional(),
  orderNotes: z.string().optional(),
  inventoryNotes: z.string().optional(),
  sellerEmail: z.string().email().optional().or(z.literal("")),
  sellerPhone: z.string().optional(),
  sellerRules: z.string().optional(),
});

function extractSlugSuffix(slug: string | null | undefined) {
  if (!slug) return null;
  const suffix = slug.split("-").at(-1);
  if (!suffix) return null;
  return /^[a-z0-9]{6,8}$/i.test(suffix) ? suffix : null;
}

async function slugTakenByOtherTenant(slug: string, tenantId: string) {
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.shopSlug, slug), ne(tenants.id, tenantId)))
    .limit(1);
  return Boolean(existing?.id);
}

async function generateShopSlug(name: string, tenantId: string, currentSlug?: string | null) {
  const base = slugify(name) || "shop";
  const preservedSuffix = extractSlugSuffix(currentSlug ?? undefined);
  if (preservedSuffix) {
    const candidate = `${base}-${preservedSuffix}`;
    if (!(await slugTakenByOtherTenant(candidate, tenantId))) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
    const candidate = `${base}-${suffix}`;
    if (!(await slugTakenByOtherTenant(candidate, tenantId))) {
      return candidate;
    }
  }

  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

const orderStatusSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "cancelled"]),
});

const optionalNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  return value;
}, z.coerce.number().optional());

const optionalDate = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  return value;
}, z.coerce.date().optional());

const payoutCreateSchema = z.object({
  status: z.string().optional(),
  amount: z.coerce.number(),
  currency: z.string().optional(),
  scheduledFor: z.coerce.date(),
  paidAt: optionalDate,
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const payoutUpdateSchema = z.object({
  status: z.string().optional(),
  amount: optionalNumber,
  currency: z.string().optional(),
  scheduledFor: optionalDate,
  paidAt: optionalDate,
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const ledgerCreateSchema = z.object({
  payoutId: z.string().uuid().optional(),
  type: z.string().min(1),
  amount: z.coerce.number(),
  currency: z.string().optional(),
  occurredAt: optionalDate,
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const ledgerUpdateSchema = z.object({
  notes: z.string().optional(),
});

const returnItemSchema = z.object({
  orderItemId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  qty: z.coerce.number().int().positive(),
  restockQty: z.coerce.number().int().nonnegative().optional(),
  condition: z.string().optional(),
});

const returnCreateSchema = z.object({
  orderId: z.string().uuid().optional(),
  status: z.string().optional(),
  reason: z.string().optional(),
  rmaNumber: z.string().optional(),
  refundAmount: optionalNumber,
  refundCurrency: z.string().optional(),
  restockStatus: z.string().optional(),
  requestedAt: optionalDate,
  approvedAt: optionalDate,
  receivedAt: optionalDate,
  refundedAt: optionalDate,
  notes: z.string().optional(),
  items: z.array(returnItemSchema).optional(),
});

const returnUpdateSchema = returnCreateSchema.omit({ items: true });

const shippingProfileCreateSchema = z.object({
  name: z.string().min(1),
  carrier: z.string().optional(),
  serviceLevel: z.string().optional(),
  rateType: z.string().optional(),
  flatRate: optionalNumber,
  currency: z.string().optional(),
  minOrderValue: optionalNumber,
  maxOrderValue: optionalNumber,
  minWeight: optionalNumber,
  maxWeight: optionalNumber,
  estimatedMinDays: z.coerce.number().int().optional(),
  estimatedMaxDays: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});

const shippingProfileUpdateSchema = shippingProfileCreateSchema.partial();

const fulfillmentRuleCreateSchema = z.object({
  shippingProfileId: z.string().uuid().optional(),
  priority: z.coerce.number().int().optional(),
  destinationCountry: z.string().optional(),
  minOrderValue: optionalNumber,
  maxOrderValue: optionalNumber,
  handlingDays: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
});

const fulfillmentRuleUpdateSchema = fulfillmentRuleCreateSchema.partial();

const customerCreateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
  orderCount: z.coerce.number().int().optional(),
  totalSpent: optionalNumber,
  currency: z.string().optional(),
  lastOrderAt: optionalDate,
});

const customerUpdateSchema = customerCreateSchema.partial();

const segmentCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const segmentUpdateSchema = segmentCreateSchema.partial();

const segmentMemberSchema = z.object({
  customerId: z.string().uuid(),
});

const messageCreateSchema = z.object({
  customerId: z.string().uuid(),
  channel: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().optional(),
  status: z.string().optional(),
  sentAt: optionalDate,
});

const messageUpdateSchema = z.object({
  status: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  sentAt: optionalDate,
});

const toOptionalNumericString = (value?: number) => {
  if (value === undefined) return undefined;
  return value.toString();
};

const toNullableNumericString = (value?: number | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.toString();
};

async function getOrCreateShopSettings(tenantId: string) {
  const [existing] = await db
    .select()
    .from(shopSettings)
    .where(eq(shopSettings.tenantId, tenantId))
    .limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(shopSettings)
    .values({
      tenantId,
      bankDetails: null,
      payoutAccount: null,
      payoutNotes: null,
      orderNotes: null,
      inventoryNotes: null,
      sellerEmail: null,
      sellerPhone: null,
      sellerRules: null,
    })
    .returning();
  return created;
}

export const adminShopRoutes = new Elysia({ prefix: "/admin/:shopSlug" })
  .use(adminOrSuperadminGuard)
  .get("/settings", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        settings: tenants.settings,
        canSell: tenants.canSell,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return new Response("Shop not found", { status: 404 });
    }
    const settings = await getOrCreateShopSettings(tenantId);

    return {
      id: tenant.id,
      slug: shopSlug,
      name: tenant.name,
      canSell: tenant.canSell,
      bankDetails: settings?.bankDetails ?? null,
      payoutAccount: settings?.payoutAccount ?? null,
      payoutNotes: settings?.payoutNotes ?? null,
      orderNotes: settings?.orderNotes ?? null,
      inventoryNotes: settings?.inventoryNotes ?? null,
      sellerEmail: settings?.sellerEmail ?? null,
      sellerPhone: settings?.sellerPhone ?? null,
      sellerRules: settings?.sellerRules ?? null,
    };
  })
  .patch("/settings", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = settingsSchema.parse(body);

    await getOrCreateShopSettings(tenantId);

    await db.transaction(async (tx) => {
      if (payload.name) {
        const [existingTenant] = await tx
          .select({ name: tenants.name, slug: tenants.shopSlug })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        const needsSlugUpdate = existingTenant?.name !== payload.name;
        const nextSlug = needsSlugUpdate
          ? await generateShopSlug(payload.name, tenantId, existingTenant?.slug)
          : existingTenant?.slug;

        await tx
          .update(tenants)
          .set({ name: payload.name, shopSlug: nextSlug ?? existingTenant?.slug ?? "" })
          .where(eq(tenants.id, tenantId));
      }

      const updates: Partial<
        Pick<
          typeof shopSettings.$inferInsert,
          | "bankDetails"
          | "payoutAccount"
          | "payoutNotes"
          | "orderNotes"
          | "inventoryNotes"
          | "sellerEmail"
          | "sellerPhone"
          | "sellerRules"
        >
      > = {};

      if (payload.bankDetails !== undefined) updates.bankDetails = payload.bankDetails;
      if (payload.payoutAccount !== undefined) updates.payoutAccount = payload.payoutAccount;
      if (payload.payoutNotes !== undefined) updates.payoutNotes = payload.payoutNotes;
      if (payload.orderNotes !== undefined) updates.orderNotes = payload.orderNotes;
      if (payload.inventoryNotes !== undefined) updates.inventoryNotes = payload.inventoryNotes;
      if (payload.sellerEmail !== undefined) updates.sellerEmail = payload.sellerEmail || null;
      if (payload.sellerPhone !== undefined) updates.sellerPhone = payload.sellerPhone;
      if (payload.sellerRules !== undefined) updates.sellerRules = payload.sellerRules;

      if (Object.keys(updates).length > 0) {
        await tx.update(shopSettings).set(updates).where(eq(shopSettings.tenantId, tenantId));
      }
    });

    const refreshed = await db
      .select({
        name: tenants.name,
        slug: tenants.shopSlug,
        canSell: tenants.canSell,
        bankDetails: shopSettings.bankDetails,
        payoutAccount: shopSettings.payoutAccount,
        payoutNotes: shopSettings.payoutNotes,
        orderNotes: shopSettings.orderNotes,
        inventoryNotes: shopSettings.inventoryNotes,
        sellerEmail: shopSettings.sellerEmail,
        sellerPhone: shopSettings.sellerPhone,
        sellerRules: shopSettings.sellerRules,
      })
      .from(tenants)
      .innerJoin(shopSettings, eq(shopSettings.tenantId, tenants.id))
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return {
      name: refreshed[0]?.name ?? "",
      slug: refreshed[0]?.slug ?? shopSlug,
      canSell: refreshed[0]?.canSell ?? false,
      bankDetails: refreshed[0]?.bankDetails ?? null,
      payoutAccount: refreshed[0]?.payoutAccount ?? null,
      payoutNotes: refreshed[0]?.payoutNotes ?? null,
      orderNotes: refreshed[0]?.orderNotes ?? null,
      inventoryNotes: refreshed[0]?.inventoryNotes ?? null,
      sellerEmail: refreshed[0]?.sellerEmail ?? null,
      sellerPhone: refreshed[0]?.sellerPhone ?? null,
      sellerRules: refreshed[0]?.sellerRules ?? null,
    };
  })
  .get("/inventory", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    const [stockRows, variantRows] = await Promise.all([
      db
        .select({ variantId: inventoryLedger.variantId, available: sum(inventoryLedger.delta) })
        .from(inventoryLedger)
        .where(eq(inventoryLedger.tenantId, tenantId))
        .groupBy(inventoryLedger.variantId)
        .orderBy(inventoryLedger.variantId),
      db
        .select({
          id: variants.id,
          sku: variants.sku,
          price: variants.price,
          currency: variants.currency,
        })
        .from(variants)
        .where(eq(variants.tenantId, tenantId)),
    ]);

    const stockMap = new Map(stockRows.map((row) => [row.variantId, Number(row.available ?? 0)]));

    return variantRows.map((variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      price: variant.price,
      currency: variant.currency,
      available: stockMap.get(variant.id) ?? 0,
    }));
  })
  .get("/orders", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    const orderRows = await db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        currency: orders.currency,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .orderBy(desc(orders.createdAt))
      .limit(20);

    if (orderRows.length === 0) {
      return [];
    }

    const orderIds = orderRows.map((order) => order.id);
    const itemCounts = await db
      .select({ orderId: orderItems.orderId, itemCount: sql`count(*)` })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId);

    const countMap = new Map(itemCounts.map((row) => [row.orderId, Number(row.itemCount ?? 0)]));

    return orderRows.map((order) => ({
      ...order,
      itemCount: countMap.get(order.id) ?? 0,
    }));
  })
  .patch("/orders/:orderId", async ({ params, body }) => {
    const { shopSlug, orderId } = params as { shopSlug: string; orderId: string };
    const { status } = orderStatusSchema.parse(body);
    const tenantId = await getTenantIdBySlug(shopSlug);

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);

    if (!order) {
      return new Response("Order not found", { status: 404 });
    }

    await db.update(orders).set({ status }).where(eq(orders.id, orderId));
    return { id: orderId, status };
  })
  // Payouts and ledger
  .get("/payouts", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    return db
      .select()
      .from(payouts)
      .where(eq(payouts.tenantId, tenantId))
      .orderBy(desc(payouts.scheduledFor))
      .limit(50);
  })
  .post("/payouts", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = payoutCreateSchema.parse(body);

    const [created] = await db
      .insert(payouts)
      .values({
        tenantId,
        status: payload.status ?? "scheduled",
        amount: payload.amount.toString(),
        currency: payload.currency ?? "USD",
        scheduledFor: payload.scheduledFor,
        paidAt: payload.paidAt ?? null,
        method: payload.method ?? null,
        reference: payload.reference ?? null,
        notes: payload.notes ?? null,
        updatedAt: new Date(),
      })
      .returning();

    return created;
  })
  .patch("/payouts/:payoutId", async ({ params, body }) => {
    const { shopSlug, payoutId } = params as { shopSlug: string; payoutId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = payoutUpdateSchema.parse(body);

    await db
      .update(payouts)
      .set({
        ...payload,
        amount: toOptionalNumericString(payload.amount),
        updatedAt: new Date(),
      })
      .where(and(eq(payouts.id, payoutId), eq(payouts.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(payouts)
      .where(and(eq(payouts.id, payoutId), eq(payouts.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Payout not found", { status: 404 });
  })
  .get("/payouts/ledger", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    return db
      .select()
      .from(payoutLedger)
      .where(eq(payoutLedger.tenantId, tenantId))
      .orderBy(desc(payoutLedger.occurredAt))
      .limit(100);
  })
  .post("/payouts/ledger", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = ledgerCreateSchema.parse(body);

    const [created] = await db
      .insert(payoutLedger)
      .values({
        tenantId,
        payoutId: payload.payoutId ?? null,
        type: payload.type,
        amount: payload.amount.toString(),
        currency: payload.currency ?? "USD",
        occurredAt: payload.occurredAt ?? new Date(),
        referenceType: payload.referenceType ?? null,
        referenceId: payload.referenceId ?? null,
        notes: payload.notes ?? null,
      })
      .returning();

    return created;
  })
  .patch("/payouts/ledger/:entryId", async ({ params, body }) => {
    const { shopSlug, entryId } = params as { shopSlug: string; entryId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = ledgerUpdateSchema.parse(body);

    await db
      .update(payoutLedger)
      .set({ notes: payload.notes ?? null })
      .where(and(eq(payoutLedger.id, entryId), eq(payoutLedger.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(payoutLedger)
      .where(and(eq(payoutLedger.id, entryId), eq(payoutLedger.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Ledger entry not found", { status: 404 });
  })
  // Returns and refunds
  .get("/returns", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    const returnRows = await db
      .select()
      .from(returns)
      .where(eq(returns.tenantId, tenantId))
      .orderBy(desc(returns.requestedAt))
      .limit(50);

    if (returnRows.length === 0) {
      return [];
    }

    const returnIds = returnRows.map((row) => row.id);
    const itemRows = await db
      .select()
      .from(returnItems)
      .where(inArray(returnItems.returnId, returnIds));

    const itemMap = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const existing = itemMap.get(item.returnId) ?? [];
      existing.push(item);
      itemMap.set(item.returnId, existing);
    }

    return returnRows.map((row) => ({
      ...row,
      items: itemMap.get(row.id) ?? [],
    }));
  })
  .post("/returns", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = returnCreateSchema.parse(body);

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(returns)
        .values({
          tenantId,
          orderId: payload.orderId ?? null,
          status: payload.status ?? "requested",
          reason: payload.reason ?? null,
          rmaNumber: payload.rmaNumber ?? null,
          refundAmount: toNullableNumericString(payload.refundAmount) ?? null,
          refundCurrency: payload.refundCurrency ?? "USD",
          restockStatus: payload.restockStatus ?? "pending",
          requestedAt: payload.requestedAt ?? new Date(),
          approvedAt: payload.approvedAt ?? null,
          receivedAt: payload.receivedAt ?? null,
          refundedAt: payload.refundedAt ?? null,
          notes: payload.notes ?? null,
          updatedAt: new Date(),
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create return");
      }

      if (payload.items?.length) {
        await tx.insert(returnItems).values(
          payload.items.map((item) => ({
            tenantId,
            returnId: created.id,
            orderItemId: item.orderItemId ?? null,
            variantId: item.variantId ?? null,
            qty: item.qty,
            restockQty: item.restockQty ?? 0,
            condition: item.condition ?? null,
          })),
        );
      }

      return created;
    });

    return result;
  })
  .patch("/returns/:returnId", async ({ params, body }) => {
    const { shopSlug, returnId } = params as { shopSlug: string; returnId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = returnUpdateSchema.parse(body);

    await db
      .update(returns)
      .set({
        ...payload,
        refundAmount: toOptionalNumericString(payload.refundAmount),
        updatedAt: new Date(),
      })
      .where(and(eq(returns.id, returnId), eq(returns.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(returns)
      .where(and(eq(returns.id, returnId), eq(returns.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Return not found", { status: 404 });
  })
  // Shipping profiles and fulfillment rules
  .get("/shipping-profiles", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    return db
      .select()
      .from(shippingProfiles)
      .where(eq(shippingProfiles.tenantId, tenantId))
      .orderBy(desc(shippingProfiles.createdAt));
  })
  .post("/shipping-profiles", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = shippingProfileCreateSchema.parse(body);

    const [created] = await db
      .insert(shippingProfiles)
      .values({
        tenantId,
        name: payload.name,
        carrier: payload.carrier ?? null,
        serviceLevel: payload.serviceLevel ?? null,
        rateType: payload.rateType ?? "flat",
        flatRate: toNullableNumericString(payload.flatRate) ?? null,
        currency: payload.currency ?? "USD",
        minOrderValue: toNullableNumericString(payload.minOrderValue) ?? null,
        maxOrderValue: toNullableNumericString(payload.maxOrderValue) ?? null,
        minWeight: toNullableNumericString(payload.minWeight) ?? null,
        maxWeight: toNullableNumericString(payload.maxWeight) ?? null,
        estimatedMinDays: payload.estimatedMinDays ?? null,
        estimatedMaxDays: payload.estimatedMaxDays ?? null,
        active: payload.active ?? true,
        updatedAt: new Date(),
      })
      .returning();

    return created;
  })
  .patch("/shipping-profiles/:profileId", async ({ params, body }) => {
    const { shopSlug, profileId } = params as { shopSlug: string; profileId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = shippingProfileUpdateSchema.parse(body);

    await db
      .update(shippingProfiles)
      .set({
        ...payload,
        flatRate: toOptionalNumericString(payload.flatRate),
        minOrderValue: toOptionalNumericString(payload.minOrderValue),
        maxOrderValue: toOptionalNumericString(payload.maxOrderValue),
        minWeight: toOptionalNumericString(payload.minWeight),
        maxWeight: toOptionalNumericString(payload.maxWeight),
        updatedAt: new Date(),
      })
      .where(and(eq(shippingProfiles.id, profileId), eq(shippingProfiles.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(shippingProfiles)
      .where(and(eq(shippingProfiles.id, profileId), eq(shippingProfiles.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Shipping profile not found", { status: 404 });
  })
  .get("/fulfillment-rules", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    return db
      .select()
      .from(fulfillmentRules)
      .where(eq(fulfillmentRules.tenantId, tenantId))
      .orderBy(desc(fulfillmentRules.priority));
  })
  .post("/fulfillment-rules", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = fulfillmentRuleCreateSchema.parse(body);

    const [created] = await db
      .insert(fulfillmentRules)
      .values({
        tenantId,
        shippingProfileId: payload.shippingProfileId ?? null,
        priority: payload.priority ?? 0,
        destinationCountry: payload.destinationCountry ?? null,
        minOrderValue: toNullableNumericString(payload.minOrderValue) ?? null,
        maxOrderValue: toNullableNumericString(payload.maxOrderValue) ?? null,
        handlingDays: payload.handlingDays ?? null,
        active: payload.active ?? true,
        notes: payload.notes ?? null,
      })
      .returning();

    return created;
  })
  .patch("/fulfillment-rules/:ruleId", async ({ params, body }) => {
    const { shopSlug, ruleId } = params as { shopSlug: string; ruleId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = fulfillmentRuleUpdateSchema.parse(body);

    await db
      .update(fulfillmentRules)
      .set({
        ...payload,
        minOrderValue: toOptionalNumericString(payload.minOrderValue),
        maxOrderValue: toOptionalNumericString(payload.maxOrderValue),
      })
      .where(and(eq(fulfillmentRules.id, ruleId), eq(fulfillmentRules.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(fulfillmentRules)
      .where(and(eq(fulfillmentRules.id, ruleId), eq(fulfillmentRules.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Fulfillment rule not found", { status: 404 });
  })
  // Customer management
  .get("/customers", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    return db
      .select()
      .from(customers)
      .where(eq(customers.tenantId, tenantId))
      .orderBy(desc(customers.createdAt))
      .limit(100);
  })
  .post("/customers", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = customerCreateSchema.parse(body);

    const [created] = await db
      .insert(customers)
      .values({
        tenantId,
        email: payload.email ?? null,
        name: payload.name ?? null,
        phone: payload.phone ?? null,
        status: payload.status ?? "active",
        orderCount: payload.orderCount ?? 0,
        totalSpent: toOptionalNumericString(payload.totalSpent) ?? "0",
        currency: payload.currency ?? "USD",
        lastOrderAt: payload.lastOrderAt ?? null,
      })
      .returning();

    return created;
  })
  .patch("/customers/:customerId", async ({ params, body }) => {
    const { shopSlug, customerId } = params as { shopSlug: string; customerId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = customerUpdateSchema.parse(body);

    await db
      .update(customers)
      .set({
        ...payload,
        totalSpent: toOptionalNumericString(payload.totalSpent),
      })
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Customer not found", { status: 404 });
  })
  .get("/customers/segments", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    return db
      .select()
      .from(customerSegments)
      .where(eq(customerSegments.tenantId, tenantId))
      .orderBy(desc(customerSegments.createdAt));
  })
  .post("/customers/segments", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = segmentCreateSchema.parse(body);

    const [created] = await db
      .insert(customerSegments)
      .values({
        tenantId,
        name: payload.name,
        description: payload.description ?? null,
      })
      .returning();

    return created;
  })
  .patch("/customers/segments/:segmentId", async ({ params, body }) => {
    const { shopSlug, segmentId } = params as { shopSlug: string; segmentId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = segmentUpdateSchema.parse(body);

    await db
      .update(customerSegments)
      .set(payload)
      .where(and(eq(customerSegments.id, segmentId), eq(customerSegments.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(customerSegments)
      .where(and(eq(customerSegments.id, segmentId), eq(customerSegments.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Segment not found", { status: 404 });
  })
  .post("/customers/segments/:segmentId/members", async ({ params, body }) => {
    const { shopSlug, segmentId } = params as { shopSlug: string; segmentId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = segmentMemberSchema.parse(body);

    const [segment] = await db
      .select({ id: customerSegments.id })
      .from(customerSegments)
      .where(and(eq(customerSegments.id, segmentId), eq(customerSegments.tenantId, tenantId)))
      .limit(1);
    if (!segment) {
      return new Response("Segment not found", { status: 404 });
    }

    await db
      .insert(customerSegmentMembers)
      .values({
        segmentId,
        customerId: payload.customerId,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    return { segmentId, customerId: payload.customerId };
  })
  .delete("/customers/segments/:segmentId/members/:customerId", async ({ params }) => {
    const { shopSlug, segmentId, customerId } = params as {
      shopSlug: string;
      segmentId: string;
      customerId: string;
    };
    const tenantId = await getTenantIdBySlug(shopSlug);

    const [segment] = await db
      .select({ id: customerSegments.id })
      .from(customerSegments)
      .where(and(eq(customerSegments.id, segmentId), eq(customerSegments.tenantId, tenantId)))
      .limit(1);
    if (!segment) {
      return new Response("Segment not found", { status: 404 });
    }

    await db
      .delete(customerSegmentMembers)
      .where(
        and(
          eq(customerSegmentMembers.segmentId, segmentId),
          eq(customerSegmentMembers.customerId, customerId),
        ),
      );

    return { segmentId, customerId };
  })
  .get("/customers/messages", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    return db
      .select()
      .from(customerMessages)
      .where(eq(customerMessages.tenantId, tenantId))
      .orderBy(desc(customerMessages.createdAt))
      .limit(100);
  })
  .post("/customers/messages", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = messageCreateSchema.parse(body);

    const [created] = await db
      .insert(customerMessages)
      .values({
        tenantId,
        customerId: payload.customerId,
        channel: payload.channel,
        subject: payload.subject ?? null,
        body: payload.body ?? null,
        status: payload.status ?? "draft",
        sentAt: payload.sentAt ?? null,
      })
      .returning();

    return created;
  })
  .patch("/customers/messages/:messageId", async ({ params, body }) => {
    const { shopSlug, messageId } = params as { shopSlug: string; messageId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = messageUpdateSchema.parse(body);

    const updates: Partial<typeof customerMessages.$inferInsert> = {};
    if (payload.status !== undefined) {
      updates.status = payload.status;
    }
    if (payload.subject !== undefined) {
      updates.subject = payload.subject;
    }
    if (payload.body !== undefined) {
      updates.body = payload.body;
    }
    if (payload.sentAt !== undefined) {
      updates.sentAt = payload.sentAt;
    }
    if (payload.status === "sent" && payload.sentAt === undefined) {
      updates.sentAt = new Date();
    }

    if (Object.keys(updates).length === 0) {
      return new Response("No updates provided", { status: 400 });
    }

    await db
      .update(customerMessages)
      .set(updates)
      .where(and(eq(customerMessages.id, messageId), eq(customerMessages.tenantId, tenantId)));

    const [updated] = await db
      .select()
      .from(customerMessages)
      .where(and(eq(customerMessages.id, messageId), eq(customerMessages.tenantId, tenantId)))
      .limit(1);

    return updated ?? new Response("Message not found", { status: 404 });
  });
