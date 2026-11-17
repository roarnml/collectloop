"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Amount, Button, Card, ErrorState, Field, LoadingState, RequestStatusBadge, inputClass } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format/date";
import { parseAmount, toDecimalString, toMinor } from "@/lib/format/money";
import { useQuery } from "@/lib/hooks/useQuery";
import type { PublicPaymentRequest } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

function Checkout({ request: r }: { request: PublicPaymentRequest }) {
  const router = useRouter();
  const [amountInput, setAmountInput] = useState(() => toDecimalString(r.outstanding_amount));
  // One key per checkout attempt: a double click or retry after a network error
  // reuses it, so the backend can't create two payments. A new amount = a new attempt.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const closed = r.status === "paid" || r.status === "cancelled" || r.status === "expired";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setAmountError(null);

    let amount = r.outstanding_amount;
    if (r.allow_partial) {
      const minor = parseAmount(amountInput, r.amount.assetScale);
      if (minor === null || minor <= 0n) return setAmountError("Enter a valid amount greater than zero.");
      if (minor > toMinor(r.outstanding_amount)) return setAmountError("That is more than the remaining balance.");
      amount = { ...r.amount, value: minor.toString() };
    }

    setSubmitting(true);
    try {
      const res = await api.startPayment(r.public_uuid, { amount, idempotency_key: idempotencyKey });
      if (res.next_action_type === "redirect" && res.redirect_url) {
        // Usually an external wallet/provider URL, so a full navigation.
        window.location.assign(res.redirect_url);
        return; // Keep the button disabled while the browser navigates away.
      }
      router.push(`/pay/return?payment=${encodeURIComponent(res.payment_id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.amount) setAmountError(err.fieldErrors.amount);
      else setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted">Payment request from</p>
        <h1 className="text-xl font-semibold text-ink">{r.business_name}</h1>
      </div>

      <Card className="p-5">
        <p className="text-sm text-muted">{r.description}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          <Amount value={r.outstanding_amount} />
        </p>
        <p className="mt-1 text-sm text-muted">{closed ? "Nothing left to pay" : "Amount due"}</p>

        <dl className="mt-4 divide-y divide-line border-t border-line">
          <Row label="Reference"><span className="font-mono text-xs">{r.reference}</span></Row>
          <Row label="Total"><Amount value={r.amount} /></Row>
          {toMinor(r.amount_paid) > 0n && <Row label="Already paid"><Amount value={r.amount_paid} /></Row>}
          <Row label="Due">{formatDate(r.due_at)}</Row>
          <Row label="Status"><RequestStatusBadge status={r.status} /></Row>
        </dl>
      </Card>

      {closed ? (
        <Card className="p-5 text-center text-sm text-muted">
          {r.status === "paid"
            ? "This request has been paid in full. Thank you."
            : "This request is no longer accepting payments. Contact the business if you think this is a mistake."}
        </Card>
      ) : (
        <Card className="p-5">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {r.allow_partial && (
              <Field
                label={`Amount to pay now (${r.amount.assetCode})`}
                htmlFor="pay-amount"
                error={amountError ?? undefined}
                hint="You can pay part now, such as a deposit, and the rest later."
              >
                <input
                  id="pay-amount"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setIdempotencyKey(crypto.randomUUID());
                  }}
                  aria-invalid={!!amountError}
                  aria-describedby={amountError ? "pay-amount-error" : undefined}
                  className={`${inputClass} text-base tabular-nums`}
                />
              </Field>
            )}
            {!r.allow_partial && amountError && <p className="text-sm text-bad">{amountError}</p>}

            <div className="rounded-lg bg-brand-soft p-3 text-sm text-navy">
              Next, you&apos;ll leave PayTrain and go to your wallet provider to review and approve this payment.
              You&apos;ll come back here afterwards.
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="w-full py-3 text-base">
              {submitting ? "Connecting to your wallet…" : "Continue to payment"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function PayView() {
  const { publicId } = useParams<{ publicId: string }>();
  const q = useQuery(() => api.getPublicPaymentRequest(publicId), [publicId]);

  if (q.status === "loading") return <LoadingState label="Loading payment request…" />;
  if (q.status === "error") {
    return q.error instanceof ApiError && q.error.status === 404 ? (
      <Card className="p-6 text-center">
        <h1 className="font-semibold text-ink">Payment request not found</h1>
        <p className="mt-2 text-sm text-muted">Check the link you were sent, or ask the business for a new one.</p>
      </Card>
    ) : (
      <ErrorState error={q.error} onRetry={q.reload} />
    );
  }
  return <Checkout request={q.data} />;
}

export default function PayPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading payment request…" />}>
      <PayView />
    </Suspense>
  );
}
