export const faqEntriesMock = [
  {
    q: "How do auctions work?",
    a: "Vendors can enable auctions per variant with a minimum increment and optional buy-now price. Anti-snipe windows extend the end time if bids arrive in the final moments.",
  },
  {
    q: "Can I buy without bidding?",
    a: "Yes. Standard cart checkout is supported across vendors. Products without auctions can be purchased instantly; auctions with buy-now allow an immediate win.",
  },
  {
    q: "How are vendors onboarded?",
    a: "Each vendor gets a path-based shop slug, configures branding and bank details, and manages catalog, inventory, and orders from the shared admin workspace.",
  },
  {
    q: "Is inventory accurate?",
    a: "Inventory is tracked via a ledger with reservation flows for carts and auctions. Stock is decremented on order completion and released on cancel/expiry.",
  },
  {
    q: "Which payment providers are supported?",
    a: "keepz.me is first; the provider abstraction is ready for credo/bog/tbc next. Webhooks and secrets are validated through the shared env schema.",
  },
  {
    q: "Do you support roles and auth?",
    a: "Clerk powers authentication. Admin/staff roles are planned; today the admin workspace assumes admin access. Public routes stay open for shopping and auctions.",
  },
];
