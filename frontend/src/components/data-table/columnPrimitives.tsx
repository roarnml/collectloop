"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { Amount, PaidProgress, RequestStatusBadge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format/date";
import { add, toMinor, zero } from "@/lib/format/money";
import { percent } from "@/lib/reconcile";
import type { Money, PaymentRequestStatus } from "@/lib/types";

/**
 * Column builders (EMR columnPrimitives pattern). Each takes a column id and a getter from the row, and sets the
 * sorting, alignment and phone-card placement that kind of value needs.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- column value types vary per column
type Col<T> = ColumnDef<T, any>;
type Base<T> = Omit<Col<T>, "id" | "accessorKey" | "accessorFn" | "cell" | "header" | "footer"> & {
  header?: string;
};

const sentence = (id: string) => {
  const words = id.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Any value, sorted and searched by `get`, shown by `cell` (or as text). */
export function addColumn<T extends RowData>(
  id: string,
  get: (row: T) => string | number | bigint | null | undefined,
  { header, cell, ...options }: Base<T> & { cell?: (row: T) => ReactNode } = {},
): Col<T> {
  return {
    id,
    accessorFn: (row) => get(row) ?? undefined,
    header: header ?? sentence(id),
    cell: ({ row }) => (cell ? cell(row.original) : String(get(row.original) ?? "—")),
    sortUndefined: "last",
    ...options,
  };
}

/** Who or what the row is: heads the row's card on a phone. Links to `href` when given. */
export function titleColumn<T extends RowData>(
  id: string,
  {
    title,
    subtitle,
    href,
    ...options
  }: Base<T> & { title: (row: T) => string; subtitle?: (row: T) => ReactNode; href?: (row: T) => string },
): Col<T> {
  return {
    ...addColumn<T>(id, title, {
      ...options,
      cell: (row) => (
        <div className="min-w-0">
          {href ? (
            <Link href={href(row)} className="font-medium text-brand hover:underline">
              {title(row)}
            </Link>
          ) : (
            <p className="font-medium text-ink">{title(row)}</p>
          )}
          {subtitle && <p className="truncate text-xs text-muted">{subtitle(row)}</p>}
        </div>
      ),
    }),
    meta: { card: "title", className: "max-w-80", ...options.meta },
  };
}

/** Short text such as a reference. `mono` for codes. */
export function textColumn<T extends RowData>(
  id: string,
  get: (row: T) => string | null | undefined,
  { mono, muted, ...options }: Base<T> & { mono?: boolean; muted?: boolean } = {},
): Col<T> {
  return addColumn<T>(id, get, {
    ...options,
    cell: (row) => (
      <span className={cx(mono && "font-mono text-xs", muted && "text-muted", "whitespace-nowrap")}>{get(row) || "—"}</span>
    ),
  });
}

/**
 * An amount: right-aligned, sorted by value. `total` adds a footer summing the filtered rows (all pages) in the first
 * row's currency.
 */
export function moneyColumn<T extends RowData>(
  id: string,
  get: (row: T) => Money,
  {
    total,
    tone,
    emphasis,
    ...options
  }: Base<T> & { total?: boolean; tone?: (row: T) => "ok" | "bad" | undefined; emphasis?: boolean } = {},
): Col<T> {
  return {
    ...addColumn<T>(id, (row) => toMinor(get(row)), {
      ...options,
      cell: (row) => {
        const t = tone?.(row);
        return (
          <Amount
            value={get(row)}
            className={cx("whitespace-nowrap", emphasis && "font-medium", t === "ok" && "text-ok", t === "bad" && "text-bad")}
          />
        );
      },
    }),
    footer: total
      ? ({ table }) => {
          const rows = table.getFilteredRowModel().rows;
          if (rows.length === 0) return null;
          const first = get(rows[0].original);
          const sum = rows
            .map((r) => get(r.original))
            .filter((m) => m.assetCode === first.assetCode && m.assetScale === first.assetScale)
            .reduce((s, m) => add(s, m), zero(first));
          return <Amount value={sum} className="whitespace-nowrap" />;
        }
      : undefined,
    meta: { align: "right", ...options.meta },
  };
}

/** A date; rows without one sort last and show `emptyText`. */
export function dateColumn<T extends RowData>(
  id: string,
  get: (row: T) => string | null,
  { tone, emptyText = "—", ...options }: Base<T> & { tone?: (row: T) => "bad" | undefined; emptyText?: string } = {},
): Col<T> {
  return addColumn<T>(id, get, {
    ...options,
    cell: (row) => {
      const value = get(row);
      return (
        <span className={cx("whitespace-nowrap", tone?.(row) === "bad" ? "text-bad" : "text-muted")}>
          {value ? formatDate(value) : emptyText}
        </span>
      );
    },
  });
}

const STATUS_ORDER: PaymentRequestStatus[] = ["overdue", "partially_paid", "open", "paid", "cancelled", "expired"];

/** A payment request's status badge; sorts most urgent first. */
export function requestStatusColumn<T extends RowData>(
  id: string,
  get: (row: T) => PaymentRequestStatus,
  options: Base<T> = {},
): Col<T> {
  return addColumn<T>(id, (row) => STATUS_ORDER.indexOf(get(row)), {
    header: "Status",
    ...options,
    cell: (row) => <RequestStatusBadge status={get(row)} />,
  });
}

/** How much of `total` is paid, as a bar and percentage; sorts by percentage. */
export function progressColumn<T extends RowData>(
  id: string,
  get: (row: T) => { paid: Money; total: Money },
  options: Base<T> = {},
): Col<T> {
  return {
    ...addColumn<T>(id, (row) => percent(get(row).paid, get(row).total), {
      ...options,
      cell: (row) => {
        const { paid, total } = get(row);
        return (
          <div className="flex min-w-28 items-center gap-2">
            <PaidProgress paid={paid} total={total} />
            <span className="w-10 text-right text-xs tabular-nums text-muted">{Math.round(percent(paid, total))}%</span>
          </div>
        );
      },
    }),
    meta: { className: "w-40", ...options.meta },
  };
}
