"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Amount,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PaidProgress,
  PaymentStatusBadge,
  RequestStatusBadge,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { useQuery } from "@/lib/hooks/useQuery";

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={url}
        aria-label="Customer payment link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-xs text-ink"
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked; the input stays selectable for manual copy.
            }
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center rounded-lg px-3 text-sm font-medium text-brand hover:bg-brand-soft"
        >
          Open
        </a>
      </div>
    </div>
  );
}

function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const justCreated = useSearchParams().get("created") === "1";
  const req = useQuery(() => api.getPaymentRequest(id), [id]);
  const txns = useQuery(
    () => (api.supportsTransactions ? api.listTransactions({ requestId: id }) : Promise.resolve(null)),
    [id],
  );

  if (req.status === "loading") return <LoadingState />;
  if (req.status === "error") return <ErrorState error={req.error} onRetry={req.reload} />;

  const r = req.data;
  const publicUrl = `${window.location.origin}/pay/${r.public_uuid}`;

  return (
    <>
      <Link href="/requests" className="text-sm text-muted hover:text-ink">
        ← Payment requests
      </Link>
      <div className="mt-3">
        <PageHeader
          title={r.description}
          subtitle={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono">{r.reference}</span>
              <span>{r.customer.name}</span>
              <span>{r.due_date ? `Due ${formatDate(r.due_date)}` : "No due date"}</span>
            </span>
          }
          actions={<RequestStatusBadge status={r.status} />}
        />
      </div>

      {justCreated && (
        <p role="status" className="mb-4 rounded-card border border-ok/20 bg-ok-soft px-5 py-3 text-sm text-ok">
          Request created. Share the link below with {r.customer.name}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted">Total</p>
              <p className="mt-1 text-lg font-semibold"><Amount value={r.amount} /></p>
            </div>
            <div>
              <p className="text-xs text-muted">Paid (verified)</p>
              <p className="mt-1 text-lg font-semibold text-ok"><Amount value={r.amount_paid} /></p>
            </div>
            <div>
              <p className="text-xs text-muted">Outstanding</p>
              <p className="mt-1 text-lg font-semibold"><Amount value={r.outstanding_amount} /></p>
            </div>
          </div>
          <div className="mt-4">
            <PaidProgress paid={r.amount_paid} total={r.amount} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {r.allow_partial ? "Part payments allowed." : "Must be paid in full."} Only verified payments count toward the
            amount paid.
          </p>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-semibold text-ink">Share with customer</h2>
          <p className="text-sm text-muted">Anyone with this link can view the request and pay. They don&apos;t need an account.</p>
          <CopyLink url={publicUrl} />
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-ink">Payments</h2>
          <Button variant="ghost" className="px-2 py-1" onClick={() => { req.reload(); txns.reload(); }}>
            Refresh
          </Button>
        </div>
        {txns.status === "loading" && <div className="px-5"><LoadingState /></div>}
        {txns.status === "error" && <div className="p-5"><ErrorState error={txns.error} onRetry={txns.reload} /></div>}
        {txns.status === "success" && txns.data === null && (
          <EmptyState
            title="Payment history coming soon"
            body="The API doesn't list individual payments yet. The totals above already include every verified payment."
          />
        )}
        {txns.status === "success" &&
          txns.data !== null &&
          (txns.data.length === 0 ? (
            <EmptyState title="No payments yet" body="Payments appear here once the customer starts paying." />
          ) : (
            <ol className="divide-y divide-line">
              {txns.data.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium"><Amount value={t.amount} /></p>
                    <p className="text-xs text-muted">
                      {t.verified_at ? `Verified ${formatDateTime(t.verified_at)}` : `Started ${formatDateTime(t.created_at)}`}
                      {t.provider_reference && <> · <span className="font-mono">{t.provider_reference}</span></>}
                    </p>
                    {t.failure_message && <p className="mt-1 text-xs text-bad">{t.failure_message}</p>}
                  </div>
                  <PaymentStatusBadge status={t.status} simulated={t.is_simulated} />
                </li>
              ))}
            </ol>
          ))}
      </Card>
    </>
  );
}

export default function RequestDetailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RequestDetail />
    </Suspense>
  );
}
