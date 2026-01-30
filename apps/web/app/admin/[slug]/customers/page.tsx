import { Metadata } from "next";
import { Badge } from "@repo/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/table";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

type CustomerEntry = {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  orderCount: number;
  totalSpent: number | string;
  currency: string | null;
  lastOrderAt: string | null;
};

type SegmentEntry = {
  id: string;
  name: string;
  description: string | null;
};

type MessageEntry = {
  id: string;
  customerId: string;
  channel: string;
  subject: string | null;
  status: string;
  createdAt: string;
};

async function fetchCustomers(slug: string): Promise<CustomerEntry[]> {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/customers`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load customers");
  }
  return response.json();
}

async function fetchSegments(slug: string): Promise<SegmentEntry[]> {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/customers/segments`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load segments");
  }
  return response.json();
}

async function fetchMessages(slug: string): Promise<MessageEntry[]> {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/customers/messages`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load messages");
  }
  return response.json();
}

function buildMockCustomers(): CustomerEntry[] {
  return [
    {
      id: "cust-001",
      name: "Ava Collins",
      email: "ava@example.com",
      status: "vip",
      orderCount: 6,
      totalSpent: 1120,
      currency: "USD",
      lastOrderAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "cust-002",
      name: "Liam Stewart",
      email: "liam@example.com",
      status: "active",
      orderCount: 3,
      totalSpent: 410,
      currency: "USD",
      lastOrderAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function buildMockSegments(): SegmentEntry[] {
  return [
    { id: "seg-1", name: "VIP customers", description: "Repeat buyers with high LTV" },
    { id: "seg-2", name: "At-risk", description: "No orders in 60+ days" },
  ];
}

function buildMockMessages(): MessageEntry[] {
  return [
    {
      id: "msg-1",
      customerId: "cust-001",
      channel: "email",
      subject: "Thank you for your recent order",
      status: "sent",
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-2",
      customerId: "cust-002",
      channel: "sms",
      subject: "Back in stock alert",
      status: "draft",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export const metadata: Metadata = {
  title: "Customers",
};

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let customers = await fetchCustomers(slug).catch(() => []);
  let segments = await fetchSegments(slug).catch(() => []);
  let messages = await fetchMessages(slug).catch(() => []);
  let isMock = false;

  if (customers.length === 0) {
    customers = buildMockCustomers();
    isMock = customers.length > 0;
  }
  if (segments.length === 0) {
    segments = buildMockSegments();
    isMock = true;
  }
  if (messages.length === 0) {
    messages = buildMockMessages();
    isMock = true;
  }

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Customers
        </p>
        <h1 className="text-3xl font-bold">Customer management</h1>
        <p className="text-sm text-muted-foreground">
          Track customer activity, segments, and outbound messaging.
        </p>
      </div>

      {isMock ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Showing mock customers and segments. Connect live CRM data when available.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Lifetime value</TableHead>
                <TableHead>Last order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                    No customers yet.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.name ?? "Guest"}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {customer.email ?? "--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.orderCount}</TableCell>
                    <TableCell>
                      {(customer.currency ?? "USD") +
                        " " +
                        toNumber(customer.totalSpent).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {customer.lastOrderAt
                        ? new Date(customer.lastOrderAt).toLocaleDateString()
                        : "--"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer segments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-10 text-center text-slate-500">
                    No segments yet.
                  </TableCell>
                </TableRow>
              ) : (
                segments.map((segment) => (
                  <TableRow key={segment.id}>
                    <TableCell className="font-medium">{segment.name}</TableCell>
                    <TableCell className="text-slate-500">
                      {segment.description ?? "--"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent outreach</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                    No messages yet.
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="capitalize">{message.channel}</TableCell>
                    <TableCell className="text-slate-500">
                      {message.subject ?? "--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {message.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(message.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
