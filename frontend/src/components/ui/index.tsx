"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { describeError, errorMessage, type ErrorKind } from "@/lib/api";
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

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneStyles[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function RequestStatusBadge({ status }: { status: PaymentRequestStatus }) {
  const s = REQUEST_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
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

const iconPaths: Record<ErrorKind | "alert", string> = {
  // Cloud with a slash: server unreachable
  unreachable: "M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.3 4.6 4.6 0 0 0 7 18.5zM3 3l18 18",
  // Wifi with a slash: no internet
  offline: "M3 3l18 18M8.6 15.4a5 5 0 0 1 6.8 0M5.1 12a10 10 0 0 1 4-2.3M12 19h.01M15.5 9.9A10 10 0 0 1 19 12M2 8.8a15 15 0 0 1 4.1-2.5M10.7 5.1A15 15 0 0 1 22 8.8",
  // Server with warning
  server: "M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01",
  // Lock
  unauthorized: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  // Magnifier
  not_found: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  // Circle with exclamation
  invalid: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01",
  unknown: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01",
  alert: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01",
};

export function ErrorIcon({ kind, className }: { kind: ErrorKind | "alert"; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={iconPaths[kind]} />
    </svg>
  );
}

/** Full error panel: icon, plain-language title and explanation, next action. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const d = describeError(error);
  const muted = d.kind === "not_found";
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <span
        className={cx(
          "grid size-14 place-items-center rounded-full",
          muted ? "bg-neutral-soft text-neutral" : "bg-bad-soft text-bad",
        )}
      >
        <ErrorIcon kind={d.kind} className="size-7" />
      </span>
      <h2 className="text-base font-semibold text-ink">{d.title}</h2>
      <p className="max-w-sm text-sm text-muted">{d.body}</p>
      {d.kind === "unauthorized" ? (
        <ButtonLink href="/login" variant="secondary" className="mt-1">
          Sign in again
        </ButtonLink>
      ) : (
        onRetry && (
          <Button variant="secondary" onClick={onRetry} className="mt-1">
            Try again
          </Button>
        )
      )}
    </Card>
  );
}

/** Inline error for forms: icon plus a short explanation. */
export function ErrorAlert({ error, children }: { error?: unknown; children?: ReactNode }) {
  const d = error !== undefined ? describeError(error) : null;
  const text = children ?? (d && d.kind !== "invalid" ? `${d.title}. ${d.body}` : errorMessage(error));
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-bad-soft px-3 py-2.5 text-sm text-bad">
      <ErrorIcon kind={d?.kind === "invalid" || !d ? "alert" : d.kind} className="mt-0.5 size-4 shrink-0" />
      <p>{text}</p>
    </div>
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
export * from "./skeleton";
