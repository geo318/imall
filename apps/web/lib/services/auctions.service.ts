import axios from "axios";
import { tryCatch } from "../utils";

export type BidPayload = {
  amount: string | number;
  // bidderId is no longer needed - backend gets it from auth token
};

export async function placeBid(
  shopSlug: string,
  auctionId: string,
  payload: BidPayload,
): Promise<void> {
  const [, error] = await tryCatch(
    axios.post(`/api/shops/${shopSlug}/auctions/${auctionId}/bids`, {
      amount: String(payload.amount),
      // bidderId is now handled by backend from auth token
    }),
  );

  if (error) {
    if (axios.isAxiosError(error)) {
      const message =
        typeof error.response?.data === "string" ? error.response.data : error.message;
      throw new Error(message || "Failed to place bid");
    }
    throw new Error("Failed to place bid");
  }
}
