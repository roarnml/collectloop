"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { RequestsTable } from "@/components/RequestsTable";
import { ButtonLink, Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { REQUEST_STATUS } from "@/lib/format/status";
import { useQuery } from "@/lib/hooks/useQuery";
import type { PaymentRequestStatus } from "@/lib/types";

const FILTERS: ("all" | PaymentRequestStatus)[] = ["all", "open", "partially_paid", "overdue", "paid"];

function StatusTabs({ filter, disabled }: { filter: "all" | PaymentRequestStatus; disabled?: boolean }) {
  const router = useRouter();
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-4 py-3" role="tablist" aria-label="Filter by status">
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          role="tab"
          aria-selected={filter === f}
          disabled={disabled}
          onClick={() => router.replace(f === "all" ? "/requests" : `/requests?status=${f}`)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
            filter === f ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface hover:text-ink"
          }`}
        >
          {f === "all" ? "All" : REQUEST_STATUS[f].label}
        </button>
      ))}
    </div>
  );
}

function RequestsView() {
  const raw = useSearchParams().get("status");
  const filter = FILTERS.includes(raw as PaymentRequestStatus) ? (raw as PaymentRequestStatus) : "all";
  const q = useQuery(() => api.listPaymentRequests(), []);

  const rows = useMemo(
    () => (q.status === "success" ? q.data.filter((r) => filter === "all" || r.status === filter) : []),
    [q, filter],
  );

  return (
    <>
      <PageHeader title="Payment requests" actions={<ButtonLink href="/requests/new">Create request</ButtonLink>} />

      {q.status === "error" ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <Card>
          <StatusTabs filter={filter} />
          <RequestsTable requests={rows} isLoading={q.status === "loading"} showSearch>
            {q.status === "success" && q.data.length > 0 ? (
              <EmptyState title="No requests with this status" body="Try another status." />
            ) : (
              <EmptyState
                title="No payment requests yet"
                body="Create a request, then share its link with your customer."
                action={<ButtonLink href="/requests/new">Create request</ButtonLink>}
              />
            )}
          </RequestsTable>
        </Card>
      )}
    </>
  );
}

export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Payment requests" />
          <Card>
            <StatusTabs filter="all" disabled />
            <RequestsTable requests={[]} isLoading />
          </Card>
        </>
      }
    >
      <RequestsView />
    </Suspense>
  );
}
