import { db, userShippingAddresses, users } from "@repo/db";
import { and, desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin } from "../context";
import { ensureAuth, requireAuth } from "../utils/auth";

const normalizeOptional = <T extends z.ZodString>(schema: T) =>
  z
    .union([schema, z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    });

const createAddressSchema = z.object({
  label: normalizeOptional(z.string().max(128)),
  firstName: z.string().trim().min(1).max(128),
  lastName: z.string().trim().min(1).max(128),
  email: normalizeOptional(z.string().email().max(256)),
  phone: normalizeOptional(z.string().max(64)),
  addressLine1: z.string().trim().min(1).max(256),
  city: z.string().trim().min(1).max(128),
  region: normalizeOptional(z.string().max(128)),
  postalCode: normalizeOptional(z.string().max(32)),
  country: normalizeOptional(z.string().max(64)).default("GE"),
  isDefault: z.boolean().optional(),
});

const updateAddressSchema = z
  .object({
    label: normalizeOptional(z.string().max(128)),
    firstName: z.string().trim().min(1).max(128).optional(),
    lastName: z.string().trim().min(1).max(128).optional(),
    email: normalizeOptional(z.string().email().max(256)),
    phone: normalizeOptional(z.string().max(64)),
    addressLine1: z.string().trim().min(1).max(256).optional(),
    city: z.string().trim().min(1).max(128).optional(),
    region: normalizeOptional(z.string().max(128)),
    postalCode: normalizeOptional(z.string().max(32)),
    country: normalizeOptional(z.string().max(64)),
    isDefault: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");

async function findUserIdByExternalAuthId(externalAuthId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.externalAuthId, externalAuthId))
    .limit(1);
  return user?.id ?? null;
}

async function ensureUserIdByExternalAuthId(externalAuthId: string): Promise<string> {
  const existingUserId = await findUserIdByExternalAuthId(externalAuthId);
  if (existingUserId) return existingUserId;

  const [created] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      externalAuthId,
    })
    .returning({ id: users.id });

  if (!created?.id) {
    throw new Error("Failed to create user profile");
  }

  return created.id;
}

type AddressInsert = typeof userShippingAddresses.$inferInsert;
type AddressUpdate = Partial<typeof userShippingAddresses.$inferInsert>;

function serializeAddress(address: {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: address.id,
    label: address.label,
    firstName: address.firstName,
    lastName: address.lastName,
    email: address.email,
    phone: address.phone,
    addressLine1: address.addressLine1,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export const userAddressRoutes = new Elysia({
  prefix: "/users",
})
  .use(authPlugin)
  .get("/me/addresses", async ({ auth, request, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      const authenticated = requireAuth(effectiveAuth);

      const userId = await findUserIdByExternalAuthId(authenticated.userId);
      if (!userId) {
        return { addresses: [] };
      }

      const addresses = await db
        .select()
        .from(userShippingAddresses)
        .where(eq(userShippingAddresses.userId, userId))
        .orderBy(desc(userShippingAddresses.isDefault), desc(userShippingAddresses.updatedAt));

      return { addresses: addresses.map(serializeAddress) };
    } catch (error) {
      if (error instanceof Response) return error;
      set.status = 500;
      return { error: "Failed to load addresses" };
    }
  })
  .post("/me/addresses", async ({ auth, request, body, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      const authenticated = requireAuth(effectiveAuth);
      const payload = createAddressSchema.parse(body);
      const userId = await ensureUserIdByExternalAuthId(authenticated.userId);

      const address = await db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: userShippingAddresses.id })
          .from(userShippingAddresses)
          .where(eq(userShippingAddresses.userId, userId));

        const shouldBeDefault = payload.isDefault === true || existing.length === 0;

        if (shouldBeDefault) {
          await tx
            .update(userShippingAddresses)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(userShippingAddresses.userId, userId));
        }

        const values: AddressInsert = {
          id: crypto.randomUUID(),
          userId,
          label: payload.label ?? null,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          addressLine1: payload.addressLine1,
          city: payload.city,
          region: payload.region ?? null,
          postalCode: payload.postalCode ?? null,
          country: payload.country ?? "GE",
          isDefault: shouldBeDefault,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const [inserted] = await tx.insert(userShippingAddresses).values(values).returning();
        return inserted ?? null;
      });

      if (!address) {
        set.status = 500;
        return { error: "Failed to save address" };
      }

      set.status = 201;
      return { address: serializeAddress(address) };
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof z.ZodError) {
        set.status = 400;
        return { error: "Invalid address payload", details: error.flatten() };
      }
      set.status = 500;
      return { error: "Failed to save address" };
    }
  })
  .patch("/me/addresses/:addressId", async ({ auth, request, params, body, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      const authenticated = requireAuth(effectiveAuth);
      const payload = updateAddressSchema.parse(body);
      const addressId = (params as { addressId: string }).addressId;
      const userId = await findUserIdByExternalAuthId(authenticated.userId);

      if (!userId) {
        set.status = 404;
        return { error: "Address not found" };
      }

      const [existing] = await db
        .select()
        .from(userShippingAddresses)
        .where(
          and(eq(userShippingAddresses.id, addressId), eq(userShippingAddresses.userId, userId)),
        )
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Address not found" };
      }

      const updated = await db.transaction(async (tx) => {
        if (payload.isDefault === true) {
          await tx
            .update(userShippingAddresses)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(userShippingAddresses.userId, userId));
        }

        const updates: AddressUpdate = {
          updatedAt: new Date(),
        };

        if (payload.label !== undefined) updates.label = payload.label ?? null;
        if (payload.firstName !== undefined) updates.firstName = payload.firstName;
        if (payload.lastName !== undefined) updates.lastName = payload.lastName;
        if (payload.email !== undefined) updates.email = payload.email ?? null;
        if (payload.phone !== undefined) updates.phone = payload.phone ?? null;
        if (payload.addressLine1 !== undefined) updates.addressLine1 = payload.addressLine1;
        if (payload.city !== undefined) updates.city = payload.city;
        if (payload.region !== undefined) updates.region = payload.region ?? null;
        if (payload.postalCode !== undefined) updates.postalCode = payload.postalCode ?? null;
        if (payload.country !== undefined) updates.country = payload.country ?? "GE";
        if (payload.isDefault !== undefined) updates.isDefault = payload.isDefault;

        const [row] = await tx
          .update(userShippingAddresses)
          .set(updates)
          .where(
            and(eq(userShippingAddresses.id, addressId), eq(userShippingAddresses.userId, userId)),
          )
          .returning();
        return row ?? null;
      });

      if (!updated) {
        set.status = 500;
        return { error: "Failed to update address" };
      }

      return { address: serializeAddress(updated) };
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof z.ZodError) {
        set.status = 400;
        return { error: "Invalid address payload", details: error.flatten() };
      }
      set.status = 500;
      return { error: "Failed to update address" };
    }
  })
  .delete("/me/addresses/:addressId", async ({ auth, request, params, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      const authenticated = requireAuth(effectiveAuth);
      const addressId = (params as { addressId: string }).addressId;
      const userId = await findUserIdByExternalAuthId(authenticated.userId);

      if (!userId) {
        set.status = 404;
        return { error: "Address not found" };
      }

      const deletedWasDefault = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(userShippingAddresses)
          .where(
            and(eq(userShippingAddresses.id, addressId), eq(userShippingAddresses.userId, userId)),
          )
          .limit(1);

        if (!existing) return null;

        await tx
          .delete(userShippingAddresses)
          .where(
            and(eq(userShippingAddresses.id, addressId), eq(userShippingAddresses.userId, userId)),
          );

        if (existing.isDefault) {
          const [fallback] = await tx
            .select({ id: userShippingAddresses.id })
            .from(userShippingAddresses)
            .where(eq(userShippingAddresses.userId, userId))
            .orderBy(desc(userShippingAddresses.updatedAt))
            .limit(1);

          if (fallback?.id) {
            await tx
              .update(userShippingAddresses)
              .set({ isDefault: true, updatedAt: new Date() })
              .where(eq(userShippingAddresses.id, fallback.id));
          }
        }

        return existing.isDefault;
      });

      if (deletedWasDefault === null) {
        set.status = 404;
        return { error: "Address not found" };
      }

      return { success: true, deletedWasDefault };
    } catch (error) {
      if (error instanceof Response) return error;
      set.status = 500;
      return { error: "Failed to delete address" };
    }
  });
