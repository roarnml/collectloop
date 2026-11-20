"use client";

import { useDataTableContext } from "./context";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DataTablePagination() {
  const { table } = useDataTableContext();
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(total, (pageIndex + 1) * pageSize);

  const buttonClass =
    "grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label="Table pages" className="flex items-center justify-end gap-4 border-t border-line px-4 py-2 text-sm">
      <p className="tabular-nums text-muted" aria-live="polite">
        {start}–{end} of {total}
      </p>
      <div className="flex">
        <button type="button" className={buttonClass} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          <span className="sr-only">Previous page</span>
          <Chevron dir="left" />
        </button>
        <button type="button" className={buttonClass} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          <span className="sr-only">Next page</span>
          <Chevron dir="right" />
        </button>
      </div>
    </nav>
  );
}
