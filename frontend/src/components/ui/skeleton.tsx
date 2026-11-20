import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Loading placeholders shaped like the content they stand in for, so the
 * layout doesn't jump when data arrives. Announced once to screen readers.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("rounded-md bg-neutral-soft motion-safe:animate-pulse", className)} />;
}

function Loading({ label = "Loading…", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-card border border-line bg-card", className)}>{children}</div>;
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <CardShell key={i} className="p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
        </CardShell>
      ))}
    </div>
  );
}

/** Placeholder rows: table on wide screens, cards on phones. Used inside DetailSkeleton. */
function ListRowsSkeleton({ rows = 4, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <>
      <div className="hidden md:block">
        <div className="flex gap-6 border-b border-line px-5 py-3">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-0">
            {Array.from({ length: columns }, (_, c) => (
              <Skeleton key={c} className={cx("h-4 flex-1", c === columns - 1 && "h-5 rounded-full")} />
            ))}
          </div>
        ))}
      </div>
      <div className="divide-y divide-line md:hidden">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex flex-col gap-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}



function PageHeaderSkeleton() {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-7 w-64 max-w-full" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

/** Request or customer detail: header, totals card, side card, section card. */
export function DetailSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <Loading label={label}>
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <CardShell className="p-5 lg:col-span-2">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-5 h-2 w-full rounded-full" />
        </CardShell>
        <CardShell className="flex flex-col gap-3 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardShell>
      </div>
      <CardShell className="mt-4">
        <div className="border-b border-line px-5 py-4">
          <Skeleton className="h-5 w-24" />
        </div>
        <ListRowsSkeleton rows={2} columns={5} />
      </CardShell>
    </Loading>
  );
}

export function FormSkeleton({ fields = 4, label = "Loading…" }: { fields?: number; label?: string }) {
  return (
    <Loading label={label}>
      <CardShell className="flex flex-col gap-5 p-5 sm:p-6">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-10 w-20 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </CardShell>
    </Loading>
  );
}

/** Customer-facing payment request page. */
export function PayPageSkeleton() {
  return (
    <Loading label="Loading payment request…" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-6 w-52" />
      </div>
      <CardShell className="p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-44" />
        <Skeleton className="mt-2 h-4 w-24" />
        <div className="mt-5 flex flex-col gap-4 border-t border-line pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </CardShell>
      <CardShell className="flex flex-col gap-4 p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </CardShell>
    </Loading>
  );
}
