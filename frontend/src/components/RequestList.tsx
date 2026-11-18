"use client";

import Link from "next/link";
import { Amount, RequestStatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format/date";
import type { PaymentRequest } from "@/lib/types";

/** Table on wide screens, stacked cards on phones. */
export function RequestList({ requests }: { requests: PaymentRequest[] }) {
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Reference</th>
            <th scope="col" className="px-5 py-3 font-medium">Customer</th>
            <th scope="col" className="px-5 py-3 font-medium">Description</th>
            <th scope="col" className="px-5 py-3 text-right font-medium">Total</th>
            <th scope="col" className="px-5 py-3 text-right font-medium">Outstanding</th>
            <th scope="col" className="px-5 py-3 font-medium">Due</th>
            <th scope="col" className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {requests.map((r) => (
            <tr key={r.id} className="group relative hover:bg-surface">
              <td className="px-5 py-3.5 font-mono text-xs">
                <Link href={`/requests/${r.id}`} className="font-medium text-brand after:absolute after:inset-0">
                  {r.reference}
                </Link>
              </td>
              <td className="px-5 py-3.5">{r.customer.name}</td>
              <td className="max-w-64 truncate px-5 py-3.5 text-muted">{r.description}</td>
              <td className="px-5 py-3.5 text-right"><Amount value={r.amount} /></td>
              <td className="px-5 py-3.5 text-right font-medium"><Amount value={r.outstanding_amount} /></td>
              <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDate(r.due_date)}</td>
              <td className="px-5 py-3.5"><RequestStatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {requests.map((r) => (
          <li key={r.id}>
            <Link href={`/requests/${r.id}`} className="flex flex-col gap-2 px-4 py-4 hover:bg-surface">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{r.customer.name}</p>
                  <p className="truncate text-sm text-muted">{r.description}</p>
                </div>
                <RequestStatusBadge status={r.status} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-muted">{r.reference} · {formatDate(r.due_date)}</span>
                <span>
                  <span className="text-muted">Owed </span>
                  <Amount value={r.outstanding_amount} className="font-semibold" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
