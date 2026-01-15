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
  console.log({ shopSlug, auctionId, payload });
  const [, error] = await tryCatch(
    axios.post(`/api/shops/${shopSlug}/auctions/${auctionId}/bids`, {
      amount: String(payload.amount),
      // bidderId is now handled by backend from auth token
    }),
  );

  console.log({ error });

  if (error) {
    if (axios.isAxiosError(error)) {
      // Log error details for debugging
      if (process.env.NODE_ENV === "development") {
        console.error("[Auction Service] Bid error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
      }

      // Handle authentication errors specifically
      if (error.response?.status === 401) {
        const errorMessage =
          typeof error.response?.data === "string"
            ? error.response.data
            : error.response?.data?.error || error.response?.data?.message;
        throw new Error(
          errorMessage ||
            "You must be signed in to place a bid. Please refresh the page and try again.",
        );
      }
      if (error.response?.status === 403) {
        throw new Error("You don't have permission to place a bid");
      }

      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(message || "Failed to place bid");
    }
    throw new Error("Failed to place bid");
  }
}
