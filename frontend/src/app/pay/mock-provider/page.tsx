"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Amount, Button, ErrorState, LoadingState } from "@/components/ui";
import { API_MODE } from "@/lib/api";
import { mockProvider } from "@/lib/api/mock";
import { useQuery } from "@/lib/hooks/useQuery";

/**
 * SIMULATED wallet consent screen. In live mode the customer goes to their
 * real wallet provider instead, and this page refuses to run.
 */
function MockProvider() {
  const router = useRouter();
  const paymentId = useSearchParams().get("payment") ?? "";
  const q = useQuery(() => mockProvider.getPayment(paymentId), [paymentId]);
  const [busy, setBusy] = useState<string | null>(null);

  if (API_MODE !== "mock") return <ErrorState error={new Error("Not available")} />;
  if (q.status === "loading") return <LoadingState label="Contacting wallet provider…" />;
  if (q.status === "error") return <ErrorState error={q.error} onRetry={q.reload} />;

  const decide = async (d: "approve" | "decline" | "fail") => {
    setBusy(d);
    await mockProvider.decide(paymentId, d);
    // A real provider redirects back with interaction details; PayTrain then asks its backend for status.
    router.push(`/pay/return?payment=${encodeURIComponent(paymentId)}`);
  };

  const p = q.data;
  const decided = p.status !== "awaiting_authorization";

  return (
    <div className="overflow-hidden rounded-card border-2 border-dashed border-neutral/40 bg-card">
      <div className="bg-neutral px-5 py-3 text-sm font-medium text-white">Simulated wallet provider</div>
      <div className="flex flex-col gap-4 p-5">
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          This screen stands in for the customer&apos;s real wallet during development. It is not part of PayTrain and no
          money moves.
        </p>
        <div>
          <p className="text-sm text-muted">Approve payment to</p>
          <p className="font-semibold text-ink">{p.business_name}</p>
        </div>
        <p className="text-3xl font-semibold tracking-tight"><Amount value={p.amount} /></p>
        <p className="font-mono text-xs text-muted">Ref {p.request_reference}</p>

        {decided ? (
          <Button onClick={() => router.push(`/pay/return?payment=${encodeURIComponent(paymentId)}`)}>
            Already answered — return to PayTrain
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button onClick={() => decide("approve")} loading={busy === "approve"} disabled={!!busy}>
              Approve payment
            </Button>
            <Button variant="secondary" onClick={() => decide("decline")} loading={busy === "decline"} disabled={!!busy}>
              Decline
            </Button>
            <Button variant="ghost" onClick={() => decide("fail")} loading={busy === "fail"} disabled={!!busy} className="text-xs">
              Test: approve, then provider rejects it
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MockProviderPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MockProvider />
    </Suspense>
  );
}
