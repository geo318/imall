import { Elysia } from "elysia";
import { z } from "zod";
import { adminOrSuperadminGuard, env } from "../context";
import {
  createKeepzDirectSettlementsTransaction,
  getKeepzDirectSettlementsAccessToken,
  getKeepzDirectSettlementsBalance,
  getKeepzDirectSettlementsDiagnostics,
  getKeepzDirectSettlementsTokenDiagnostics,
  getKeepzDirectSettlementsTransactionDetails,
  KeepzDirectSettlementsApiError,
  KeepzDirectSettlementsConfigError,
} from "../integrations/keepz-direct-settlements";
import { logger } from "../utils/logger";

const currencySchema = z.enum(["GEL", "USD", "EUR"]);

const authTokenRequestSchema = z
  .object({
    forceRefresh: z.coerce.boolean().optional(),
  })
  .optional()
  .default({});

const createTransactionSchema = z
  .object({
    amount: z.coerce.number().positive(),
    currency: currencySchema,
    description: z.string().trim().min(1),
    beneficiaryIdentityNumber: z.string().trim().optional(),
    beneficiaryName: z.string().trim().optional(),
    beneficiaryAddress: z.string().trim().optional(),
    toIban: z.string().trim().optional(),
    receiverId: z.string().trim().uuid().optional(),
    receiverType: z.enum(["BRANCH", "USER"]).optional(),
    birthDate: z.string().trim().optional(),
    uniqueId: z.string().trim().uuid().optional(),
    debtorName: z.string().trim().optional(),
    debtorIban: z.string().trim().optional(),
    debtorIdentityNumber: z.string().trim().optional(),
  })
  .superRefine((payload, ctx) => {
    const hasIban = Boolean(payload.toIban);
    const hasReceiverId = Boolean(payload.receiverId);
    const hasReceiverType = Boolean(payload.receiverType);

    if (hasIban && hasReceiverId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either toIban or receiverId/receiverType, not both",
        path: ["toIban"],
      });
    }
    if (hasReceiverId && !hasReceiverType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "receiverType is required when receiverId is provided",
        path: ["receiverType"],
      });
    }
    if (hasReceiverType && !hasReceiverId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "receiverId is required when receiverType is provided",
        path: ["receiverId"],
      });
    }
    if (!hasIban && !hasReceiverId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either toIban or receiverId/receiverType is required",
        path: ["toIban"],
      });
    }
  });

const transactionDetailsParamsSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
});

const balanceQuerySchema = z.object({
  currency: currencySchema.optional(),
});

function sanitizeDebugRaw(raw: unknown): unknown {
  if (typeof raw === "string") {
    return raw.length > 1000 ? `${raw.slice(0, 1000)}…` : raw;
  }
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const source = raw as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.length > 1000) {
      sanitized[key] = `${value.slice(0, 1000)}…`;
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function handleDirectSettlementsError(
  action: string,
  error: unknown,
  set: { status?: number | string },
): Record<string, unknown> {
  if (error instanceof KeepzDirectSettlementsConfigError) {
    logger.error(`[Keepz Direct Settlements] ${action} config error`, {
      message: error.message,
      details: error.details,
    });
    set.status = 503;
    const response: Record<string, unknown> = {
      error: error.message,
      code: "KEEPZ_DIRECT_SETTLEMENTS_NOT_CONFIGURED",
    };
    if (env.NODE_ENV === "development") {
      response.debug = error.details;
    }
    return response;
  }

  if (error instanceof KeepzDirectSettlementsApiError) {
    logger.error(`[Keepz Direct Settlements] ${action} request failed`, {
      message: error.message,
      httpStatus: error.httpStatus,
      statusCode: error.statusCode,
      path: error.path,
      method: error.method,
      raw: sanitizeDebugRaw(error.raw),
    });
    set.status = error.httpStatus || 502;
    const response: Record<string, unknown> = {
      error: error.message,
      statusCode: error.statusCode,
    };
    if (env.NODE_ENV === "development") {
      response.debug = sanitizeDebugRaw(error.raw);
    }
    return response;
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error(`[Keepz Direct Settlements] ${action} unexpected error`, { message });
  set.status = 500;
  return {
    error: `Failed to ${action}`,
    message,
  };
}

export const keepzDirectSettlementsRoutes = new Elysia({
  prefix: "/payments/keepz/direct-settlements",
})
  .use(adminOrSuperadminGuard)
  .get("/diagnostics", ({ set }) => {
    try {
      return {
        ...getKeepzDirectSettlementsDiagnostics(),
        token: getKeepzDirectSettlementsTokenDiagnostics(),
      };
    } catch (error) {
      return handleDirectSettlementsError("fetch diagnostics", error, set);
    }
  })
  .post("/auth/token", async ({ body, set }) => {
    try {
      const payload = authTokenRequestSchema.parse(body);
      const token = await getKeepzDirectSettlementsAccessToken({
        forceRefresh: Boolean(payload.forceRefresh),
      });
      return {
        success: true,
        ...token,
      };
    } catch (error) {
      return handleDirectSettlementsError("authenticate", error, set);
    }
  })
  .get("/balance", async ({ query, set }) => {
    try {
      const payload = balanceQuerySchema.parse(query);
      const balance = await getKeepzDirectSettlementsBalance(payload.currency);
      return balance;
    } catch (error) {
      return handleDirectSettlementsError("fetch balance", error, set);
    }
  })
  .get("/transactions/:transactionId", async ({ params, set }) => {
    try {
      const payload = transactionDetailsParamsSchema.parse(params);
      const details = await getKeepzDirectSettlementsTransactionDetails(payload.transactionId);
      return details;
    } catch (error) {
      return handleDirectSettlementsError("fetch transaction details", error, set);
    }
  })
  .post("/transactions", async ({ body, set }) => {
    try {
      const payload = createTransactionSchema.parse(body);
      const transaction = await createKeepzDirectSettlementsTransaction(payload);
      return transaction;
    } catch (error) {
      return handleDirectSettlementsError("create transaction", error, set);
    }
  });
