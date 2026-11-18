"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Amount, Button, Card, PaymentStatusBadge, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format/date";
import { parseHandoff, readHandoffRaw } from "@/lib/payments/handoff";
import { TERMINAL_PAYMENT_STATUSES, type PaymentStatusResponse } from "@/lib/types";

/** Waiting on the provider after the customer approved: check often, briefly. */
const PROCESSING = { everyMs: 2000, maxChecks: 10 };
/** Waiting for the customer to send funds from their wallet: check gently, longer. */
const AWAITING = { everyMs: 5000, maxChecks: 60 };

/**
 * Payment status page. Arriving here proves nothing: the page only shows
 * what the backend reports after it checks the payment with the provider.
 *
 * Live flow: the backend creates an Open Payments incoming payment and the
 * customer pays that URL from their own wallet; this page shows the URL and
 * keeps asking the backend to verify until funds are confirmed.
 */
const noopSubscribe = () => () => {};

function StatusView() {
  const params = useSearchParams();
  const paymentId = params.get("payment");
  const requestId = params.get("request");
  // Browser-only data: null during the server render, read from sessionStorage on the client.
  const handoffRaw = useSyncExternalStore(
    noopSubscribe,
    () => (paymentId ? readHandoffRaw(paymentId) : null),
    () => null,
  );
  const handoff = useMemo(() => parseHandoff(handoffRaw), [handoffRaw]);

  const [data, setData] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [checks, setChecks] = useState(0);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    if (!paymentId) return;
    setChecking(true);
    try {
      setData(await api.getPaymentStatus(paymentId, requestId));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setChecking(false);
      setChecks((n) => n + 1);
    }
  }, [paymentId, requestId]);

  const terminal = !!data && TERMINAL_PAYMENT_STATUSES.includes(data.status);
  // Before the first answer (or if verification is down), trust the handoff to show the payment link.
  const awaitingFunds = data ? data.status === "awaiting_authorization" : !!handoff;
  const plan = awaitingFunds ? AWAITING : PROCESSING;
  const gaveUp = !terminal && checks >= plan.maxChecks;

  useEffect(() => {
    if (!paymentId || terminal || gaveUp) return;
    const t = setTimeout(check, checks === 0 ? 0 : plan.everyMs);
    return () => clearTimeout(t);
  }, [paymentId, checks, terminal, gaveUp, check, plan.everyMs]);

  const recheck = () => {
    setChecks(0); // Restart automatic checking too.
  };

  if (!paymentId) {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-semibold text-ink">Missing payment details</h1>
        <p className="mt-2 text-sm text-muted">Open the payment link you were sent and try again.</p>
      </Card>
    );
  }

  const requestHref = data?.request_public_uuid || requestId ? `/pay/${data?.request_public_uuid || requestId}` : null;
  const backLink = requestHref && (
    <Link href={requestHref} className="text-sm font-medium text-brand hover:underline">
      Back to payment request
    </Link>
  );

  // First answer not back yet, and nothing to show the customer meanwhile.
  if (!data && !handoff) {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center" aria-live="polite">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-ink">We couldn&apos;t check this payment</h1>
            <p className="text-sm text-bad">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={recheck} loading={checking}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <Spinner className="size-8 text-brand" />
            <h1 className="text-lg font-semibold text-ink">Checking payment status</h1>
          </>
        )}
        {backLink}
      </Card>
    );
  }

  // Customer still needs to send the money from their wallet.
  if (awaitingFunds && handoff) {
    const amount = data?.amount ?? handoff.amount;
    const business = data?.business_name || handoff.businessName;
    const reference = data && data.request_reference !== "—" ? data.request_reference : handoff.reference;
    return (
      <Card className="flex flex-col gap-4 p-6" aria-live="polite">
        <div>
          <p className="text-sm text-muted">Pay {business || "the business"}</p>
          <p className="text-3xl font-semibold tracking-tight">
            <Amount value={amount} />
          </p>
          <p className="font-mono text-xs text-muted">Ref {reference}</p>
        </div>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink">
          <li>Open your Open Payments wallet (for the hackathon, the Interledger test wallet).</li>
          <li>Choose to send a payment, and paste this payment link as the recipient.</li>
          <li>Send exactly the amount above. This page updates once the money arrives.</li>
        </ol>
        <div className="flex flex-col gap-2">
          <label htmlFor="payment-url" className="text-sm font-medium text-ink">
            Payment link
          </label>
          <input
            id="payment-url"
            readOnly
            value={handoff.url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-xs text-ink"
          />
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(handoff.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // Clipboard blocked; the field stays selectable.
              }
            }}
          >
            {copied ? "Copied" : "Copy payment link"}
          </Button>
        </div>
        <div className="flex flex-col items-center gap-2 border-t border-line pt-4 text-center">
          <p className="flex items-center gap-2 text-sm text-muted">
            {!gaveUp && <Spinner className="size-4 text-brand" />}
            {gaveUp ? "We stopped checking automatically." : "Waiting for your payment…"}
          </p>
          <Button variant={gaveUp ? "primary" : "ghost"} onClick={recheck} loading={checking && gaveUp}>
            I&apos;ve sent it — check now
          </Button>
          {!!error && <p className="text-sm text-bad">{errorMessage(error)}</p>}
          {backLink}
        </div>
      </Card>
    );
  }

  if (!data) return null; // Unreachable: covered by the two branches above.

  // Waiting on the provider.
  if (!terminal) {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center" aria-live="polite">
        {gaveUp ? (
          <>
            <h1 className="text-lg font-semibold text-ink">Still checking your payment</h1>
            <p className="text-sm text-muted">
              {data.status_message ??
                (awaitingFunds
                  ? "We haven't received your approval from the wallet provider yet."
                  : "Your wallet provider hasn't confirmed this payment yet. This can take a few minutes. Don't pay again.")}
            </p>
            <Button variant="secondary" onClick={recheck} loading={checking}>
              Check again
            </Button>
          </>
        ) : (
          <>
            <Spinner className="size-8 text-brand" />
            <h1 className="text-lg font-semibold text-ink">Checking payment status</h1>
            <p className="text-sm text-muted">
              {data.status_message ?? "We're confirming the payment with your wallet provider. Please keep this page open."}
            </p>
          </>
        )}
        {!!error && <p className="text-sm text-bad">{errorMessage(error)}</p>}
        <PaymentStatusBadge status={data.status} />
        {backLink}
      </Card>
    );
  }

  if (data.status === "succeeded") {
    return (
      <Card
        className={`flex flex-col gap-4 p-6 ${data.is_simulated ? "border-2 border-dashed border-ok/50" : "border-ok/30"}`}
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-ok-soft text-ok" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="text-lg font-semibold text-ink">
            {data.is_simulated ? "Simulated payment confirmed" : "Payment confirmed"}
          </h1>
          {data.is_simulated && <p className="text-xs text-warn">Test data only. No money was moved.</p>}
        </div>
        <dl className="divide-y divide-line border-y border-line text-sm">
          {data.business_name && (
            <div className="flex justify-between py-2.5"><dt className="text-muted">Paid to</dt><dd>{data.business_name}</dd></div>
          )}
          <div className="flex justify-between py-2.5"><dt className="text-muted">Amount</dt><dd className="font-semibold"><Amount value={data.amount} /></dd></div>
          <div className="flex justify-between py-2.5"><dt className="text-muted">Reference</dt><dd className="font-mono text-xs">{data.request_reference}</dd></div>
          {data.verified_at && (
            <div className="flex justify-between py-2.5"><dt className="text-muted">Verified</dt><dd>{formatDateTime(data.verified_at)}</dd></div>
          )}
        </dl>
        <div className="text-center">{backLink}</div>
      </Card>
    );
  }

  const copy: Record<string, { title: string; body: string }> = {
    failed: { title: "Payment failed", body: "Your payment didn't go through. You haven't been charged for this attempt." },
    cancelled: { title: "Payment cancelled", body: "The payment was not approved. Nothing was charged." },
    expired: { title: "Payment expired", body: "The approval window closed before the payment was completed." },
  };
  const c = copy[data.status];

  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center" aria-live="polite">
      <PaymentStatusBadge status={data.status} />
      <h1 className="text-lg font-semibold text-ink">{c.title}</h1>
      <p className="text-sm text-muted">{data.failure_message ?? c.body}</p>
      {requestHref && (
        <Link
          href={requestHref}
          className="mt-2 inline-flex items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-strong"
        >
          Try again
        </Link>
      )}
    </Card>
  );
}

export default function PayReturnPage() {
  return (
    <Suspense fallback={null}>
      <StatusView />
    </Suspense>
  );
}
