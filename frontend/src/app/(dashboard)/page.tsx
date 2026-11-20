"use client";

import { RequestsTable } from "@/components/RequestsTable";
import {
  Amount,
  ButtonLink,
  Card,
  KpiRowSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui";
import { api } from "@/lib/api";
import { toMinor } from "@/lib/format/money";
import { useQuery } from "@/lib/hooks/useQuery";
import type { Money } from "@/lib/types";

function Kpi({ label, value, count, tone }: { label: string; value?: Money; count?: number; tone?: "danger" }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone === "danger" ? "text-bad" : "text-ink"}`}>
        {value ? <Amount value={value} /> : <span className="tabular-nums">{count}</span>}
      </p>
    </Card>
  );
}

export default function DashboardPage() {
  const q = useQuery(() => api.getDashboardSummary(), []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Verified payments only. Pending and failed payments never reduce what is owed."
        actions={<ButtonLink href="/requests/new">Create request</ButtonLink>}
      />

      {q.status === "error" && <ErrorState error={q.error} onRetry={q.reload} />}
      {q.status !== "error" && (
        <div className="flex flex-col gap-6">
          {q.status === "success" ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Kpi label="Collected" value={q.data.collected_total} />
              <Kpi label="Outstanding" value={q.data.outstanding_total} />
              <Kpi label="Overdue" value={q.data.overdue_total} tone={toMinor(q.data.overdue_total) > 0n ? "danger" : undefined} />
              <Kpi label="Paid in full" count={q.data.paid_request_count} />
            </div>
          ) : (
            <div role="status">
              <span className="sr-only">Loading your payments…</span>
              <KpiRowSkeleton />
            </div>
          )}

          {q.status === "success" && toMinor(q.data.overdue_total) > 0n && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-bad/20 bg-bad-soft px-5 py-4 text-sm">
              <p className="text-bad">
                <strong className="font-semibold"><Amount value={q.data.overdue_total} /></strong> is past its due date.
              </p>
              <ButtonLink href="/requests?status=overdue" variant="secondary" className="py-1.5">
                View overdue
              </ButtonLink>
            </div>
          )}

          {q.status === "success" && !!q.data.pending_count && (
            <p className="text-sm text-muted">
              {q.data.pending_count} payment{q.data.pending_count === 1 ? " is" : "s are"} still being verified.
            </p>
          )}

          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold text-ink">Recent requests</h2>
              <ButtonLink href="/requests" variant="ghost" className="px-2 py-1">
                View all
              </ButtonLink>
            </div>
            <RequestsTable
              requests={q.status === "success" ? q.data.recent_requests : []}
              isLoading={q.status === "loading"}
              skeletonRows={4}
              hidePagination
            >
              <EmptyState
                title="No payment requests yet"
                body="Create your first request and share the link with your customer."
                action={<ButtonLink href="/requests/new">Create request</ButtonLink>}
              />
            </RequestsTable>
          </Card>
        </div>
      )}
    </>
  );
}
