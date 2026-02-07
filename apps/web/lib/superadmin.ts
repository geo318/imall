import { env } from "@repo/shared";
import { cookies } from "next/headers";

const COOKIE_NAME = "superadmin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export async function getSuperadminSession(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(COOKIE_NAME)?.value);
}

export async function setSuperadminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSuperadminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { path: "/", expires: new Date(0) });
}

export async function getSuperadminCookieHeader(): Promise<Record<string, string>> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return {};
  return { Cookie: `${COOKIE_NAME}=${value}` };
}
