"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { API_MODE, errorMessage, isUnauthorized } from "@/lib/api";
import { cx } from "@/lib/cx";
import { formatMoney, percentOf } from "@/lib/format/money";
import { PAYMENT_STATUS, REQUEST_STATUS, type Tone } from "@/lib/format/status";
import type { Money, PaymentRequestStatus, PaymentStatus } from "@/lib/types";

export { cx };

// ---------- buttons ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong disabled:bg-brand/50",
  secondary: "bg-card text-ink border border-line hover:bg-surface disabled:text-muted",
  ghost: "text-brand hover:bg-brand-soft disabled:text-muted",
  danger: "bg-card text-bad border border-bad/30 hover:bg-bad-soft",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonBase, buttonStyles[variant], className)}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...rest} className={cx(buttonBase, buttonStyles[variant], className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------- surfaces ----------

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section {...rest} className={cx("rounded-card border border-line bg-card", className)} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ---------- status ----------

const toneStyles: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-neutral",
  info: "bg-info-soft text-info",
  success: "bg-ok-soft text-ok",
  warning: "bg-warn-soft text-warn",
  danger: "bg-bad-soft text-bad",
};

function Badge({ tone, children, simulated }: { tone: Tone; children: ReactNode; simulated?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneStyles[tone],
        // Simulated success must never look identical to a real confirmed payment.
        simulated && tone === "success" && "border border-dashed border-ok/60 bg-transparent",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
      {simulated && tone === "success" && <span className="font-normal opacity-80">(simulated)</span>}
    </span>
  );
}

export function RequestStatusBadge({ status }: { status: PaymentRequestStatus }) {
  const s = REQUEST_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentStatusBadge({ status, simulated }: { status: PaymentStatus; simulated?: boolean }) {
  const s = PAYMENT_STATUS[status];
  return (
    <Badge tone={s.tone} simulated={simulated}>
      {s.label}
    </Badge>
  );
}

export function SimulatedBanner({ compact }: { compact?: boolean }) {
  if (API_MODE !== "mock") return null;
  return (
    <div
      role="note"
      className={cx(
        "border-b border-dashed border-warn/40 bg-warn-soft text-warn",
        compact ? "px-4 py-1.5 text-xs" : "px-4 py-2 text-sm",
      )}
    >
      <strong className="font-semibold">Simulated mode.</strong> Mock data stored in this browser. No real Open
      Payments calls are made and no money moves.
    </div>
  );
}

// ---------- money ----------

export function Amount({ value, className }: { value: Money; className?: string }) {
  return <span className={cx("tabular-nums", className)}>{formatMoney(value)}</span>;
}

export function PaidProgress({ paid, total }: { paid: Money; total: Money }) {
  const pct = percentOf(paid, total);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-soft"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Amount paid"
    >
      <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- states ----------

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-12 text-sm text-muted" role="status">
      <Spinner className="size-5 text-brand" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3 border-bad/30 p-6" role="alert">
      <p className="font-medium text-bad">{errorMessage(error)}</p>
      {isUnauthorized(error) ? (
        <ButtonLink href="/login" variant="secondary">
          Sign in again
        </ButtonLink>
      ) : onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------- forms ----------

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-bad">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-bad";
