"use client";

import type { RowData } from "@tanstack/react-table";
import { useSyncExternalStore } from "react";
import { EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import DataTableProvider from "./DataTableProvider";
import DataTableShell, { Content } from "./DataTableShell";
import type { TableProps } from "./types";

const noopSubscribe = () => () => {};

/** Placeholder rows for the server render (and hydration) before the table mounts. */
function PrerenderPlaceholder({ rows, label }: { rows: number; label?: string }) {
  return (
    <div role="status" className="flex flex-col divide-y divide-line">
      <span className="sr-only">{label ? `Loading ${label.toLowerCase()}…` : "Loading…"}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-6 px-5 py-4">
          <Skeleton className="h-4 flex-[2]" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

/**
 * PayTrain's table, following the EMR DataTable architecture: a provider owning the TanStack table and a shell
 * laying it out, configured by column primitives. On a phone the rows become cards.
 *
 * Children: `<DataTable.EmptyState>` shows when there are no rows; `<DataTable.Content>` always shows below them.
 */
function DataTable<TData extends RowData>({
  data,
  columns,
  defaultSorting,
  enableSortingRemoval,
  searchText,
  pageSize,
  hidePagination,
  filterProps,
  getRowId,
  children,
  showFilters = false,
  emptyMessage = "No results.",
  className,
  hideHeader = false,
  isLoading = false,
  skeletonRows = 5,
  handleRowSelection,
  rowClassName,
  label,
}: TableProps<TData>) {
  // The table renders in the browser only: PayTrain loads table data client-side, and TanStack Table reads the
  // clock in development, which Next.js rejects while prerendering a page's static shell.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <PrerenderPlaceholder rows={skeletonRows} label={label} />;

  return (
    <DataTableProvider<TData>
      {...{ data, columns, defaultSorting, enableSortingRemoval, searchText, pageSize, hidePagination, filterProps, getRowId }}
    >
      <DataTableShell<TData>
        {...{
          className,
          showFilters,
          emptyMessage,
          hideHeader,
          isLoading,
          skeletonRows,
          handleRowSelection,
          rowClassName,
          label,
        }}
      >
        {children}
      </DataTableShell>
    </DataTableProvider>
  );
}

DataTable.Content = Content;
DataTable.EmptyState = EmptyState;

export { DataTable };
export default DataTable;
