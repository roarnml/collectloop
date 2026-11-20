"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RequestsTable } from "@/components/RequestsTable";
import {
  Amount,
  ButtonLink,
  Card,
  DetailSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  PaidProgress,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { totals } from "@/lib/reconcile";

function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const justCreated = useSearchParams().get("created") === "1";
  const q = useQuery(
    () =>
      Promise.all([
        api.getCustomer(id),
        api.listPaymentRequests().then((all) => all.filter((r) => r.customer.id === id)),
      ]),
    [id],
  );

  if (q.status === "loading") return <DetailSkeleton label="Loading customer…" />;
  if (q.status === "error") {
    return (
      <>
        <Link href="/customers" className="text-sm text-muted hover:text-ink">
          ← Customers
        </Link>
        <div className="mt-3">
          <ErrorState error={q.error} onRetry={q.reload} />
        </div>
      </>
    );
  }

  const [c, requests] = q.data;
  const t = totals(requests);
  const newRequestHref = `/requests/new?customer=${encodeURIComponent(c.id)}`;

  return (
    <>
      <Link href="/customers" className="text-sm text-muted hover:text-ink">
        ← Customers
      </Link>
      <div className="mt-3">
        <PageHeader
          title={c.name}
          subtitle={
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {c.email && (
                <a href={`mailto:${c.email}`} className="hover:text-ink">
                  {c.email}
                </a>
              )}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="hover:text-ink">
                  {c.phone}
                </a>
              )}
              {!c.email && !c.phone && <span>No contact details</span>}
            </span>
          }
          actions={<ButtonLink href={newRequestHref}>New request</ButtonLink>}
        />
      </div>

      {justCreated && (
        <p role="status" className="mb-4 rounded-card border border-ok/20 bg-ok-soft px-5 py-3 text-sm text-ok">
          Customer added. Create a payment request to bill them.
        </p>
      )}

      <Card className="p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">Billed</p>
            <p className="mt-1 text-lg font-semibold"><Amount value={t.requested} /></p>
          </div>
          <div>
            <p className="text-xs text-muted">Paid (verified)</p>
            <p className="mt-1 text-lg font-semibold text-ok"><Amount value={t.received} /></p>
          </div>
          <div>
            <p className="text-xs text-muted">Outstanding</p>
            <p className="mt-1 text-lg font-semibold"><Amount value={t.outstanding} /></p>
          </div>
          <div>
            <p className="text-xs text-muted">Overdue</p>
            <p className={`mt-1 text-lg font-semibold ${t.overdueCount ? "text-bad" : ""}`}>
              <Amount value={t.overdue} />
            </p>
          </div>
        </div>
        <div className="mt-4">
          <PaidProgress paid={t.received} total={t.requested} />
        </div>
        <p className="mt-3 text-xs text-muted">
          {t.count} request{t.count === 1 ? "" : "s"} · {t.paidCount} paid in full · {t.openCount} still open
          {t.otherCurrencies > 0 && ` · ${t.otherCurrencies} in other currencies not included in totals`}
        </p>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-ink">Payment requests</h2>
        </div>
        <RequestsTable requests={requests}>
          <EmptyState
            title="No payment requests yet"
            body={`Create a request to bill ${c.name}.`}
            action={<ButtonLink href={newRequestHref}>New request</ButtonLink>}
          />
        </RequestsTable>
      </Card>
    </>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton label="Loading customer…" />}>
      <CustomerDetail />
    </Suspense>
  );
}
