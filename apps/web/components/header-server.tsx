import { getInitialHeaderAuth } from "@/lib/server/header-auth";
import { HeaderClient } from "./header-client";

export async function HeaderServer() {
  const initialHeaderAuth = await getInitialHeaderAuth();
  return <HeaderClient initialHeaderAuth={initialHeaderAuth} />;
}
