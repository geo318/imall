"use server";

import { env } from "@repo/shared";
import { revalidatePath } from "next/cache";
import { resolveBackendBase } from "@/app/api/_utils/backend";
import { redirect } from "@/i18n/navigation.server";
import {
  clearSuperadminSession,
  getSuperadminSession,
  setSuperadminSession,
} from "@/lib/superadmin";

const API_BASE = resolveBackendBase();

async function superadminRequest(path: string, options: RequestInit = {}) {
  const session = await getSuperadminSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const headers = new Headers(options.headers ?? {});
  headers.set("X-Superadmin-Email", env.SUPERADMIN_EMAIL);
  headers.set("X-Superadmin-Password", env.SUPERADMIN_PASSWORD);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export async function superadminLogin(_prevState: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const envEmail = env.SUPERADMIN_EMAIL.trim().toLowerCase();
  const envPassword = env.SUPERADMIN_PASSWORD.trim();
  const emailNormalized = email.toLowerCase();

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (emailNormalized !== envEmail || password !== envPassword) {
    if (env.NODE_ENV !== "production") {
      console.error("[superadmin] Invalid credentials", {
        emailMatch: emailNormalized === envEmail,
        passwordMatch: password === envPassword,
        emailLength: email.length,
        passwordLength: password.length,
        envEmailLength: envEmail.length,
        envPasswordLength: envPassword.length,
      });
    }
    return { error: "Invalid credentials" };
  }

  await setSuperadminSession();
  return redirect("/superadmin");
}

export async function superadminLogout() {
  await clearSuperadminSession();
  return redirect("/superadmin/login");
}

export async function listSuperadminShops(): Promise<
  Array<{
    id: string;
    slug: string;
    name: string;
    canSell: boolean;
    canAuction: boolean;
    createdAt: string;
  }>
> {
  const response = await superadminRequest("/superadmin/shops");
  if (!response.ok) {
    throw new Error("Failed to load shops");
  }
  return response.json();
}

export async function updateShopSelling(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") || "").trim();
  const canSell = String(formData.get("canSell") || "").trim() === "true";

  if (!slug) {
    throw new Error("Missing shop slug");
  }

  const response = await superadminRequest(`/superadmin/shops/${slug}`, {
    method: "PATCH",
    body: JSON.stringify({ canSell }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (env.NODE_ENV !== "production") {
      console.error("[superadmin] Update shop failed", {
        slug,
        status: response.status,
        errorText,
      });
    }
    try {
      const errorData = JSON.parse(errorText || "{}") as { error?: string };
      throw new Error(errorData?.error ?? (errorText || "Failed to update shop"));
    } catch {
      throw new Error(errorText || "Failed to update shop");
    }
  }

  revalidatePath("/superadmin");
}

export async function updateShopAuction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") || "").trim();
  const canAuction = String(formData.get("canAuction") || "").trim() === "true";

  if (!slug) {
    throw new Error("Missing shop slug");
  }

  const response = await superadminRequest(`/superadmin/shops/${slug}`, {
    method: "PATCH",
    body: JSON.stringify({ canAuction }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (env.NODE_ENV !== "production") {
      console.error("[superadmin] Update shop auction failed", {
        slug,
        status: response.status,
        errorText,
      });
    }
    throw new Error(errorText || "Failed to update auction setting");
  }

  revalidatePath("/superadmin");
}

export type SuperadminCategory = {
  id: string;
  slug: string;
  categoryKey: string;
  name: string;
  nameEn: string | null;
  nameKa: string | null;
  nameRu: string | null;
  icon: string;
  description: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SuperadminCategoryRelation = {
  parentId: string;
  childId: string;
};

export type SuperadminCategoryNode = SuperadminCategory & {
  parentId: string | null;
  hasChildren: boolean;
};

export async function listSuperadminCategories(): Promise<{
  categories: SuperadminCategory[];
  relations: SuperadminCategoryRelation[];
}> {
  const response = await superadminRequest("/superadmin/categories");
  if (!response.ok) {
    throw new Error("Failed to load categories");
  }
  return response.json();
}

export async function listSuperadminCategoryRoots(): Promise<SuperadminCategoryNode[]> {
  const response = await superadminRequest("/superadmin/categories/roots");
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw new Error("Failed to load categories");
  }
  return response.json();
}

export async function createSuperadminCategory(formData: FormData): Promise<void> {
  const name = String(formData.get("name") || "").trim();
  const categoryKey = String(formData.get("categoryKey") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const icon = String(formData.get("icon") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const nameKa = String(formData.get("nameKa") || "").trim();
  const nameRu = String(formData.get("nameRu") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim();
  const isActive = String(formData.get("isActive") || "").trim() === "true";

  if (!name) {
    throw new Error("Missing category name");
  }

  const response = await superadminRequest("/superadmin/categories", {
    method: "POST",
    body: JSON.stringify({
      name,
      categoryKey: categoryKey || undefined,
      slug: slug || undefined,
      icon: icon || undefined,
      nameEn: nameEn || undefined,
      nameKa: nameKa || undefined,
      nameRu: nameRu || undefined,
      description: description || undefined,
      isActive,
      parentId: parentId || undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Failed to create category");
  }

  revalidatePath("/superadmin");
}

export async function seedInitialSuperadminCategories(_formData?: FormData): Promise<void> {
  const response = await superadminRequest("/superadmin/categories/seed-initial", {
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Failed to seed initial categories");
  }

  revalidatePath("/superadmin");
}

export async function updateSuperadminCategory(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const categoryKey = String(formData.get("categoryKey") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const icon = String(formData.get("icon") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const nameKa = String(formData.get("nameKa") || "").trim();
  const nameRu = String(formData.get("nameRu") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim();
  const isActive = String(formData.get("isActive") || "").trim() === "true";

  if (!id) {
    throw new Error("Missing category id");
  }

  const response = await superadminRequest(`/superadmin/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: name || undefined,
      categoryKey: categoryKey || undefined,
      slug: slug || undefined,
      icon: icon || undefined,
      nameEn: nameEn || undefined,
      nameKa: nameKa || undefined,
      nameRu: nameRu || undefined,
      description: description || undefined,
      parentId: parentId ? parentId : null,
      isActive,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Failed to update category");
  }

  revalidatePath("/superadmin");
}

export async function deleteSuperadminCategory(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("Missing category id");
  }

  const response = await superadminRequest(`/superadmin/categories/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Failed to delete category");
  }

  revalidatePath("/superadmin");
}
