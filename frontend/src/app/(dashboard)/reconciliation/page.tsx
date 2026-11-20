"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Amount,
  Button,
  Card,
  ErrorState,
  KpiRowSkeleton,
  PageHeader,
  PaidProgress,
  RequestStatusBadge,
} from "@/components/ui";
import {
  DataTable,
  dateColumn,
  moneyColumn,
  progressColumn,
  requestStatusColumn,
  titleColumn,
} from "@/components/data-table";
import { api } from "@/lib/api";
import { todayDate } from "@/lib/format/date";
import { toDecimalString, toMinor } from "@/lib/format/money";
import { REQUEST_STATUS } from "@/lib/format/status";
import { useQuery } from "@/lib/hooks/useQuery";
import { percent, totals } from "@/lib/reconcile";
import type { Money, PaymentRequest, PaymentRequestStatus } from "@/lib/types";

type View = "attention" | "open" | "settled" | "all";

const VIEWS: { id: View; label: string; match: (r: PaymentRequest) => boolean }[] = [
  { id: "attention", label: "Needs attention", match: (r) => r.status === "overdue" || r.status === "partially_paid" },
  { id: "open", label: "Open", match: (r) => r.status === "open" || r.status === "partially_paid" || r.status === "overdue" },
  { id: "settled", label: "Paid in full", match: (r) => r.status === "paid" },
  { id: "all", label: "All", match: () => true },
];

const STATUS_ORDER: PaymentRequestStatus[] = ["overdue", "partially_paid", "open", "paid", "cancelled", "expired"];

/** Overdue first, then the most money still owed. */
function byPriority(a: PaymentRequest, b: PaymentRequest) {
  const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
  if (s !== 0) return s;
  const diff = toMinor(b.outstanding_amount) - toMinor(a.outstanding_amount);
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}

/** Quote a CSV cell; neutralise spreadsheet formulas in user-entered text. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: PaymentRequest[]) {
  const header = ["Reference", "Customer", "Description", "Currency", "Total", "Received (verified)", "Outstanding", "Status", "Due date", "Created"];
  const lines = rows.map((r) =>
    [
      r.reference,
      r.customer.name,
      r.description,
      r.amount.assetCode,
      toDecimalString(r.amount),
      toDecimalString(r.amount_paid),
      toDecimalString(r.outstanding_amount),
      REQUEST_STATUS[r.status].label,
      r.due_date ?? "",
      r.created_at.slice(0, 10),
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paytrain-reconciliation-${todayDate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Kpi({ label, value, note, tone }: { label: string; value: Money; note?: string; tone?: "ok" | "bad" }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-ink"}`}>
        <Amount value={value} />
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}

const columns = [
  titleColumn<PaymentRequest>("request", {
    header: "Request",
    title: (r) => r.customer.name,
    subtitle: (r) => `${r.reference} · ${r.description}`,
    href: (r) => `/requests/${r.id}`,
  }),
  moneyColumn<PaymentRequest>("total", (r) => r.amount, { header: "Total", total: true }),
  moneyColumn<PaymentRequest>("received", (r) => r.amount_paid, { header: "Received", tone: () => "ok", total: true }),
  moneyColumn<PaymentRequest>("outstanding", (r) => r.outstanding_amount, {
    header: "Outstanding",
    emphasis: true,
    tone: (r) => (r.status === "overdue" ? "bad" : undefined),
    total: true,
  }),
  progressColumn<PaymentRequest>("collected", (r) => ({ paid: r.amount_paid, total: r.amount }), { header: "Collected" }),
  dateColumn<PaymentRequest>("due", (r) => r.due_date, {
    header: "Due",
    emptyText: "No due date",
    tone: (r) => (r.status === "overdue" ? "bad" : undefined),
  }),
  requestStatusColumn<PaymentRequest>("status", (r) => r.status),
];

export default function ReconciliationPage() {
  const router = useRouter();
  const q = useQuery(() => api.listPaymentRequests(), []);
  const [view, setView] = useState<View>("attention");

  const data = useMemo(() => {
    if (q.status !== "success") return null;
    const all = [...q.data].sort(byPriority);
    const t = totals(all);
    const byStatus = STATUS_ORDER.map((status) => {
      const list = all.filter((r) => r.status === status);
      return { status, count: list.length, totals: totals(list) };
    }).filter((s) => s.count > 0);
    return { all, t, byStatus };
  }, [q]);

  const current = VIEWS.find((v) => v.id === view)!;
  const rows = data ? data.all.filter(current.match) : [];

  return (
    <>
      <PageHeader
        title="Reconciliation"
        subtitle="What you've requested against what's been verified as received."
        actions={
          <Button variant="secondary" onClick={() => data && downloadCsv(data.all)} disabled={!data || data.all.length === 0}>
            Download CSV
          </Button>
        }
      />

      {q.status === "loading" && (
        <div role="status" className="flex flex-col gap-6">
          <span className="sr-only">Loading reconciliation…</span>
          <KpiRowSkeleton />
          <Card>
            <DataTable label="Requests to reconcile" data={[]} columns={columns} isLoading />
          </Card>
        </div>
      )}
      {q.status === "error" && <ErrorState error={q.error} onRetry={q.reload} />}

      {data && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Kpi label="Requested" value={data.t.requested} note={`${data.t.count} request${data.t.count === 1 ? "" : "s"}`} />
            <Kpi
              label="Received (verified)"
              value={data.t.received}
              tone="ok"
              note={`${percent(data.t.received, data.t.requested)}% collected`}
            />
            <Kpi label="Outstanding" value={data.t.outstanding} note={`${data.t.openCount} still open`} />
            <Kpi
              label="Overdue"
              value={data.t.overdue}
              tone={data.t.overdueCount ? "bad" : undefined}
              note={`${data.t.overdueCount} past due date`}
            />
          </div>

          {data.all.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-5 lg:col-span-2">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-semibold text-ink">Collected so far</h2>
                  <p className="text-sm text-muted">
                    <Amount value={data.t.received} className="font-medium text-ink" /> of <Amount value={data.t.requested} />
                  </p>
                </div>
                <div className="mt-4">
                  <PaidProgress paid={data.t.received} total={data.t.requested} />
                </div>
                <p className="mt-3 text-xs text-muted">
                  Only payments the wallet provider confirmed count as received. Pending or failed payments never reduce
                  what is owed.
                  {data.t.otherCurrencies > 0 &&
                    ` ${data.t.otherCurrencies} request(s) in other currencies aren't included in these totals.`}
                </p>
              </Card>

              <Card>
                <h2 className="border-b border-line px-5 py-4 font-semibold text-ink">By status</h2>
                <dl className="divide-y divide-line text-sm">
                  {data.byStatus.map((s) => (
                    <div key={s.status} className="flex items-center justify-between gap-3 px-5 py-3">
                      <dt className="flex items-center gap-2">
                        <RequestStatusBadge status={s.status} />
                        <span className="text-muted">× {s.count}</span>
                      </dt>
                      <dd className="text-right tabular-nums">
                        <Amount value={s.status === "paid" ? s.totals.received : s.totals.outstanding} />
                        <span className="block text-xs text-muted">{s.status === "paid" ? "received" : "owed"}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          )}

          <Card>
            <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-line p-4" role="tablist" aria-label="Show requests">
              {VIEWS.map((v) => {
                const count = data.all.filter(v.match).length;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={view === v.id}
                    onClick={() => setView(v.id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                      view === v.id ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {v.label} <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            <DataTable
              label="Requests to reconcile"
              data={rows}
              columns={columns}
              getRowId={(r) => r.id}
              searchText={(r) => `${r.reference} ${r.customer.name} ${r.description}`}
              handleRowSelection={(r) => router.push(`/requests/${r.id}`)}
            >
              <DataTable.EmptyState
                title={view === "attention" ? "Nothing needs attention" : "No requests here"}
                body={
                  view === "attention"
                    ? "No requests are overdue or part-paid right now."
                    : data.all.length
                      ? "Try another view."
                      : "Create a payment request to start tracking what you're owed."
                }
              />
            </DataTable>
          </Card>

          <p className="text-xs text-muted">
            Totals come from each request&apos;s verified amount paid. Matching individual payments to requests will show
            here once the API lists transactions.
          </p>
        </div>
      )}
    </>
  );
}
