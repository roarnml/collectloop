"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { addColumn, DataTable, dateColumn, moneyColumn, textColumn, titleColumn } from "@/components/data-table";
import { ButtonLink, Card, ErrorState, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { DEFAULT_ASSET } from "@/lib/config";
import { zero } from "@/lib/format/money";
import { useQuery } from "@/lib/hooks/useQuery";
import { type Totals, totalsByCustomer } from "@/lib/reconcile";
import type { Customer } from "@/lib/types";

type CustomerRow = { customer: Customer; totals: (Totals & { lastRequestAt: string | null }) | null };

const none = zero(DEFAULT_ASSET);
const contact = (c: Customer) => [c.email, c.phone].filter(Boolean).join(" · ");

const columns = [
  titleColumn<CustomerRow>("customer", {
    header: "Customer",
    title: (r) => r.customer.name,
    href: (r) => `/customers/${r.customer.id}`,
  }),
  textColumn<CustomerRow>("contact", (r) => contact(r.customer), { header: "Contact", muted: true }),
  addColumn<CustomerRow>("requests", (r) => r.totals?.count ?? 0, {
    header: "Requests",
    meta: { align: "right" },
    cell: (r) => (
      <span>
        {r.totals?.count ?? 0}
        {!!r.totals?.overdueCount && <span className="ml-1 text-xs text-bad">({r.totals.overdueCount} overdue)</span>}
      </span>
    ),
  }),
  moneyColumn<CustomerRow>("paid", (r) => r.totals?.received ?? none, { header: "Paid", tone: () => "ok", total: true }),
  moneyColumn<CustomerRow>("outstanding", (r) => r.totals?.outstanding ?? none, {
    header: "Outstanding",
    emphasis: true,
    tone: (r) => (r.totals?.overdueCount ? "bad" : undefined),
    total: true,
  }),
  dateColumn<CustomerRow>("last_request", (r) => r.totals?.lastRequestAt ?? null, { header: "Last request" }),
];

const searchText = (r: CustomerRow) => `${r.customer.name} ${contact(r.customer)}`;

export default function CustomersPage() {
  const router = useRouter();
  const q = useQuery(() => Promise.all([api.listCustomers(), api.listPaymentRequests()]), []);

  const rows = useMemo<CustomerRow[]>(() => {
    if (q.status !== "success") return [];
    const [customers, requests] = q.data;
    const byCustomer = totalsByCustomer(requests);
    return customers.map((customer) => ({ customer, totals: byCustomer.get(customer.id) ?? null }));
  }, [q]);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Who you bill, what they've paid, and what they still owe."
        actions={<ButtonLink href="/customers/new">Add customer</ButtonLink>}
      />

      {q.status === "error" ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <Card>
          <DataTable
            label="Customers"
            data={rows}
            columns={columns}
            getRowId={(r) => r.customer.id}
            isLoading={q.status === "loading"}
            skeletonRows={4}
            showFilters
            filterProps={{ searchPlaceholder: "Search name, email or phone…" }}
            searchText={searchText}
            handleRowSelection={(r) => router.push(`/customers/${r.customer.id}`)}
          >
            <DataTable.EmptyState
              title="No customers yet"
              body="Add a customer, or create a payment request and add them there."
              action={<ButtonLink href="/customers/new">Add customer</ButtonLink>}
            />
          </DataTable>
        </Card>
      )}
    </>
  );
}
