"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { RequestList } from "@/components/RequestList";
import { ButtonLink, Card, EmptyState, ErrorState, LoadingState, PageHeader, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { REQUEST_STATUS } from "@/lib/format/status";
import { useQuery } from "@/lib/hooks/useQuery";
import type { PaymentRequestStatus } from "@/lib/types";

const FILTERS: ("all" | PaymentRequestStatus)[] = ["all", "open", "partially_paid", "overdue", "paid"];

function RequestsView() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("status");
  const filter = FILTERS.includes(raw as PaymentRequestStatus) ? (raw as PaymentRequestStatus) : "all";
  const [search, setSearch] = useState("");
  const q = useQuery(() => api.listPaymentRequests(), []);

  const rows = useMemo(() => {
    if (q.status !== "success") return [];
    const term = search.trim().toLowerCase();
    return q.data.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!term ||
          r.reference.toLowerCase().includes(term) ||
          r.customer.name.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term)),
    );
  }, [q, filter, search]);

  return (
    <>
      <PageHeader
        title="Payment requests"
        actions={<ButtonLink href="/requests/new">Create request</ButtonLink>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => router.replace(f === "all" ? "/requests" : `/requests?status=${f}`)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  filter === f ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {f === "all" ? "All" : REQUEST_STATUS[f].label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, customer…"
            aria-label="Search payment requests"
            className={`${inputClass} sm:max-w-64`}
          />
        </div>

        {q.status === "loading" && <div className="px-5"><LoadingState /></div>}
        {q.status === "error" && <div className="p-5"><ErrorState error={q.error} onRetry={q.reload} /></div>}
        {q.status === "success" &&
          (rows.length ? (
            <RequestList requests={rows} />
          ) : q.data.length ? (
            <EmptyState title="No matching requests" body="Try a different filter or search term." />
          ) : (
            <EmptyState
              title="No payment requests yet"
              body="Create a request, then share its link with your customer."
              action={<ButtonLink href="/requests/new">Create request</ButtonLink>}
            />
          ))}
      </Card>
    </>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RequestsView />
    </Suspense>
  );
}
