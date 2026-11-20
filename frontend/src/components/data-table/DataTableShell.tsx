"use client";

import { flexRender, type Header, type RowData } from "@tanstack/react-table";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "@/lib/cx";
import { useIsPhone } from "@/lib/hooks/useMediaQuery";
import { useDataTableContext } from "./context";
import DataTableCards from "./DataTableCards";
import Filters from "./Filters";
import { DataTablePagination } from "./Pagination";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./table";
import { isRowClick } from "./utils";

/** Marker: `<DataTable.Content>` renders below the rows, always (unlike the empty state, shown only with no rows). */
export function Content({ children }: { children?: ReactNode }) {
  return children;
}

export type DataTableShellProps<TData extends RowData> = {
  children?: ReactNode;
  className?: string;
  showFilters: boolean;
  emptyMessage: string;
  hideHeader: boolean;
  isLoading: boolean;
  skeletonRows: number;
  handleRowSelection?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
  label?: string;
};

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 10l4-4 4 4" className={dir === "asc" ? "opacity-100" : "opacity-30"} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 14l-4 4-4-4" className={dir === "desc" ? "opacity-100" : "opacity-30"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeaderCell<TData extends RowData>({ header }: { header: Header<TData, unknown> }) {
  const { column } = header;
  const meta = column.columnDef.meta;
  const right = meta?.align === "right";
  const sorted = column.getIsSorted();
  const content = header.isPlaceholder ? null : flexRender(column.columnDef.header, header.getContext());

  return (
    <TableHead
      scope="col"
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
      className={cx(right && "text-right", meta?.className)}
    >
      {column.getCanSort() && content ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className={cx(
            "-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase tracking-wide hover:text-ink",
            right && "flex-row-reverse",
            sorted && "text-ink",
          )}
        >
          {content}
          <SortIcon dir={sorted} />
        </button>
      ) : (
        content
      )}
    </TableHead>
  );
}

/** Lays out the table (EMR DataTableShell): toolbar, table or phone cards, empty state, totals and pagination. */
export default function DataTableShell<TData extends RowData>({
  children,
  className,
  showFilters,
  emptyMessage,
  hideHeader,
  isLoading,
  skeletonRows,
  handleRowSelection,
  rowClassName,
  label,
}: DataTableShellProps<TData>) {
  const { table, hidePagination } = useDataTableContext<TData>();
  const showCards = useIsPhone();

  const rows = table.getRowModel().rows;
  const isEmpty = !isLoading && rows.length === 0;
  const isSearchMiss = isEmpty && Boolean(table.getState().globalFilter) && table.getPreFilteredRowModel().rows.length > 0;
  const hasFooter = !isLoading && rows.length > 0 && table.getAllLeafColumns().some((col) => col.columnDef.footer);
  const columnCount = table.getVisibleLeafColumns().length;

  const isContent = (child: ReactNode): child is ReactElement => isValidElement(child) && child.type === Content;
  const childArray = Children.toArray(children);
  const bottomContent = childArray.filter(isContent);
  const emptyContent = childArray.filter((child) => !isContent(child));

  return (
    <div className={className} aria-busy={isLoading || undefined}>
      {showFilters && <Filters />}

      {showCards ? (
        <DataTableCards
          isLoading={isLoading}
          skeletonRows={skeletonRows}
          handleRowSelection={handleRowSelection}
          rowClassName={rowClassName}
        />
      ) : (
        <Table aria-label={label}>
          {!hideHeader && (
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <HeaderCell key={header.id} header={header} />
                  ))}
                </tr>
              ))}
            </TableHeader>
          )}
          <TableBody>
            {isLoading &&
              Array.from({ length: skeletonRows }, (_, r) => (
                <tr key={`skeleton-${r}`}>
                  {Array.from({ length: columnCount }, (_, c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cx(handleRowSelection && "cursor-pointer", rowClassName?.(row.original))}
                  onClick={(event) => {
                    if (isRowClick(event)) handleRowSelection?.(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell key={cell.id} className={cx(meta?.align === "right" && "text-right tabular-nums", meta?.className)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
          </TableBody>
          {hasFooter && (
            <TableFooter>
              {table.getFooterGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta;
                    return (
                      <TableCell key={header.id} className={cx(meta?.align === "right" && "text-right tabular-nums", meta?.className)}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                      </TableCell>
                    );
                  })}
                </tr>
              ))}
            </TableFooter>
          )}
        </Table>
      )}

      {bottomContent}

      {isEmpty &&
        (isSearchMiss ? (
          <EmptyState title="No matches" body="Try a different search term." />
        ) : emptyContent.length > 0 ? (
          emptyContent
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted">{emptyMessage}</p>
        ))}

      {!isLoading && !hidePagination && <DataTablePagination />}
    </div>
  );
}
