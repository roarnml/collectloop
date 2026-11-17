"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Amount, Button, Card, PaymentStatusBadge, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format/date";
import { TERMINAL_PAYMENT_STATUSES, type PaymentStatusResponse } from "@/lib/types";

const POLL_MS = 2000;
const MAX_POLLS = 10;

/**
 * Where the wallet provider sends the customer back.
 *
 * Arriving here proves nothing: the redirect is an untrusted navigation
 * signal. The page only shows what the backend reports after it verifies the
 * payment with the provider.
 *
 * TODO(live): confirm what the backend's return URL carries (e.g. our payment
 * id plus Open Payments interact_ref/hash) and whether the backend handles the
 * grant continuation before redirecting here.
 */
function ReturnView() {
  const paymentId = useSearchParams().get("payment");
  const [data, setData] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [polls, setPolls] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    if (!paymentId) return;
    try {
      const res = await api.getPaymentStatus(paymentId);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setPolls((n) => n + 1);
    }
  }, [paymentId]);

  const terminal = !!data && TERMINAL_PAYMENT_STATUSES.includes(data.status);
  const gaveUp = !terminal && polls >= MAX_POLLS;

  useEffect(() => {
    if (!paymentId || terminal || gaveUp) return;
    timer.current = setTimeout(check, polls === 0 ? 0 : POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [paymentId, polls, terminal, gaveUp, check]);

  const refresh = async () => {
    setRefreshing(true);
    await check();
    setRefreshing(false);
  };

  if (!paymentId) {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-semibold text-ink">Missing payment details</h1>
        <p className="mt-2 text-sm text-muted">Open the payment link you were sent and try again.</p>
      </Card>
    );
  }

  const backLink = data && (
    <Link href={`/pay/${data.request_public_uuid}`} className="text-sm font-medium text-brand hover:underline">
      Back to payment request
    </Link>
  );

  // Still waiting on the first answer, or payment not settled yet.
  if (!terminal) {
    const awaitingAuth = data?.status === "awaiting_authorization";
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center" aria-live="polite">
        {gaveUp ? (
          <>
            <h1 className="text-lg font-semibold text-ink">Still checking your payment</h1>
            <p className="text-sm text-muted">
              {awaitingAuth
                ? "We haven't received your approval from the wallet provider yet."
                : "Your wallet provider hasn't confirmed this payment yet. This can take a few minutes. Don't pay again."}
            </p>
            <Button variant="secondary" onClick={refresh} loading={refreshing}>
              Check again
            </Button>
          </>
        ) : (
          <>
            <Spinner className="size-8 text-brand" />
            <h1 className="text-lg font-semibold text-ink">Checking payment status</h1>
            <p className="text-sm text-muted">
              We&apos;re confirming the payment with your wallet provider. Please keep this page open.
            </p>
          </>
        )}
        {!!error && <p className="text-sm text-bad">{errorMessage(error)}</p>}
        {data && <PaymentStatusBadge status={data.status} />}
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
          {data.is_simulated && (
            <p className="text-xs text-warn">Test data only. No money was moved.</p>
          )}
        </div>
        <dl className="divide-y divide-line border-y border-line text-sm">
          <div className="flex justify-between py-2.5"><dt className="text-muted">Paid to</dt><dd>{data.business_name}</dd></div>
          <div className="flex justify-between py-2.5"><dt className="text-muted">Amount</dt><dd className="font-semibold"><Amount value={data.amount} /></dd></div>
          <div className="flex justify-between py-2.5"><dt className="text-muted">Reference</dt><dd className="font-mono text-xs">{data.request_reference}</dd></div>
          <div className="flex justify-between py-2.5"><dt className="text-muted">Verified</dt><dd>{formatDateTime(data.verified_at)}</dd></div>
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
      <Link
        href={`/pay/${data.request_public_uuid}`}
        className="mt-2 inline-flex items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-strong"
      >
        Try again
      </Link>
    </Card>
  );
}

export default function PayReturnPage() {
  return (
    <Suspense fallback={null}>
      <ReturnView />
    </Suspense>
  );
}
