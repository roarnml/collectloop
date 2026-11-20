"use client";

import {
  type FilterFn,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowData,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { DataTableContextProvider } from "./context";
import type { DataTableProviderProps } from "./types";

/**
 * Owns the TanStack table and its state (EMR DataTableProvider pattern). PayTrain lists arrive whole, so sorting,
 * search and paging run in the browser rather than against the API.
 */
export default function DataTableProvider<TData extends RowData>({
  data,
  columns,
  children,
  defaultSorting = [],
  enableSortingRemoval = true,
  searchText,
  pageSize = 20,
  hidePagination = false,
  filterProps,
  getRowId,
}: DataTableProviderProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  // One custom search for the whole row, instead of TanStack's per-column string match: rows hold
  // objects (money, customers) whose searchable text isn't any single column's value.
  const globalFilterFn: FilterFn<TData> = (row, columnId, value: string) => {
    const term = String(value ?? "").trim().toLowerCase();
    if (!term) return true;
    const text = searchText ? searchText(row.original) : String(row.getValue(columnId) ?? "");
    return text.toLowerCase().includes(term);
  };

  const table = useReactTable<TData>({
    data,
    columns,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn,
    getColumnCanGlobalFilter: () => true,
    enableSortingRemoval,
    // Every column sorts ascending → descending → off (EMR behaviour), numbers included.
    sortDescFirst: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <DataTableContextProvider
      value={{
        // A new object each render so context consumers re-render (TanStack mutates the table in place).
        table: { ...table },
        hidePagination: hidePagination || table.getPageCount() <= 1,
        filterProps,
      }}
    >
      {children}
    </DataTableContextProvider>
  );
}
