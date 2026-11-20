"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { DataTable, dateColumn, moneyColumn, requestStatusColumn, textColumn, titleColumn } from "@/components/data-table";
import type { PaymentRequest } from "@/lib/types";

const columns = [
  titleColumn<PaymentRequest>("customer", {
    header: "Request",
    title: (r) => r.customer.name,
    subtitle: (r) => r.description,
    href: (r) => `/requests/${r.id}`,
  }),
  textColumn<PaymentRequest>("reference", (r) => r.reference, { header: "Reference", mono: true, muted: true }),
  moneyColumn<PaymentRequest>("total", (r) => r.amount, { header: "Total" }),
  moneyColumn<PaymentRequest>("outstanding", (r) => r.outstanding_amount, {
    header: "Outstanding",
    emphasis: true,
    tone: (r) => (r.status === "overdue" ? "bad" : undefined),
  }),
  dateColumn<PaymentRequest>("due", (r) => r.due_date, {
    header: "Due",
    emptyText: "No due date",
    tone: (r) => (r.status === "overdue" ? "bad" : undefined),
  }),
  requestStatusColumn<PaymentRequest>("status", (r) => r.status),
];

const searchText = (r: PaymentRequest) => `${r.reference} ${r.customer.name} ${r.description}`;

/** Payment requests, on the dashboard, the requests page and a customer's page. */
export function RequestsTable({
  requests,
  isLoading,
  showSearch,
  hidePagination,
  skeletonRows,
  children,
}: {
  requests: PaymentRequest[];
  isLoading?: boolean;
  showSearch?: boolean;
  hidePagination?: boolean;
  skeletonRows?: number;
  /** Empty state, shown when there are no requests. */
  children?: ReactNode;
}) {
  const router = useRouter();
  return (
    <DataTable
      label="Payment requests"
      data={requests}
      columns={columns}
      getRowId={(r) => r.id}
      isLoading={isLoading}
      skeletonRows={skeletonRows}
      hidePagination={hidePagination}
      showFilters={showSearch}
      filterProps={{ searchPlaceholder: "Search reference, customer or description…" }}
      searchText={searchText}
      handleRowSelection={(r) => router.push(`/requests/${r.id}`)}
    >
      {children}
    </DataTable>
  );
}
