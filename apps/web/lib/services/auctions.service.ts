import axios from "axios";
import { tryCatch } from "../utils";

export type BidPayload = {
  amount: string | number;
  bidderId: string;
};

export async function placeBid(
  shopSlug: string,
  auctionId: string,
  payload: BidPayload,
): Promise<void> {
  const [, error] = await tryCatch(
    axios.post(`/api/shops/${shopSlug}/auctions/${auctionId}/bids`, {
      amount: String(payload.amount),
      bidderId: payload.bidderId,
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

