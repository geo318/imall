"use client";

import { useEffect, useRef, useState } from "react";

interface AuctionDetail {
  id: string;
  status: string;
  currentPrice: string | null;
  highestBidId: string | null;
  startsAt: string;
  endsAt: string;
  startingBid?: string | null;
}

export default function AuctionPage({
  params,
}: {
  params: { shopSlug: string; auctionId: string };
}) {
  const { shopSlug, auctionId } = params;
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [bidAmount, setBidAmount] = useState<string>("");
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const demoBidderId = "00000000-0000-0000-0000-000000000001";

  // Fetch the auction on mount.
  useEffect(() => {
    async function loadAuction() {
      try {
        const domain = process.env.NEXT_PUBLIC_DOMAIN;
        const res = await fetch(`${domain}/api/shops/${shopSlug}/auctions/${auctionId}`);
        if (res.ok) {
          const data = (await res.json()) as AuctionDetail;
          setAuction(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadAuction();
  }, [shopSlug, auctionId]);

  // Set up WebSocket subscription.
  useEffect(() => {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    const wsUrl = `${domain?.replace("http", "ws")}/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ action: "subscribe", auctionId }));
    });
    ws.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "subscribed") {
          setMessages((m) => [...m, `Subscribed to auction ${payload.auctionId}`]);
        } else if (payload.type === "bid") {
          // Example: handle bid update payload
          setMessages((m) => [...m, `New bid: ${payload.amount} by ${payload.bidderId}`]);
          setAuction((a) => a && { ...a, currentPrice: payload.amount });
        }
      } catch {}
    });
    return () => {
      ws.close();
    };
  }, [auctionId]);

  const placeBid = async () => {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    await fetch(`${domain}/api/shops/${shopSlug}/auctions/${auctionId}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // TODO: replace demo bidder with Clerk user id mapping.
      body: JSON.stringify({ amount: bidAmount, bidderId: demoBidderId }),
    });
    setBidAmount("");
  };

  if (!auction) {
    return <p className="p-4">Loading auction…</p>;
  }
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Auction</h1>
      <p>Status: {auction.status}</p>
      <p>Current price: {auction.currentPrice ?? auction.startingBid ?? "0"}</p>
      <div className="mt-4">
        <input
          type="number"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder="Bid amount"
          className="border p-2 mr-2 rounded"
        />
        <button
          onClick={placeBid}
          type="button"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Place Bid
        </button>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-gray-600">
        {messages.map((m, i) => (
          <li key={`${m}-${String(i)}`}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
