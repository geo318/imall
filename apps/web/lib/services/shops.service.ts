import axios from "axios";
import { tryCatch } from "../utils";

export type Shop = {
  id: string;
  slug: string;
  name: string;
};

export async function getShops(limit = 50): Promise<Shop[]> {
  const [data, error] = await tryCatch(
    axios.get<Shop[]>("/api/shops", {
      params: { limit },
    }),
  );

  if (error) {
    throw new Error("Failed to load shops");
  }

  return data.data;
}

