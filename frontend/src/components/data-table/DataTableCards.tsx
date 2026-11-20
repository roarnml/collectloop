"use client";

import { type Cell, type Column, flexRender, type Row, type RowData } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "@/lib/cx";
import { useDataTableContext } from "./context";
import { columnLabel, isRowClick } from "./utils";

type TColumn = Column<RowData, unknown>;

const isActionColumn = (column: TColumn) => column.columnDef.meta?.card === "actions";
const isVisible = (column: TColumn) => column.columnDef.meta?.card !== "hidden";

const renderCell = <TData extends RowData>(cell: Cell<TData, unknown>) =>
  flexRender(cell.column.columnDef.cell, cell.getContext());

/**
 * A table's rows as cards, for a phone (EMR DataTableCards): the row's subject on top, the other columns as
 * label / value pairs, its actions along the bottom, and any column totals as a last card.
 */
export default function DataTableCards<TData extends RowData>({
  isLoading,
  skeletonRows,
  handleRowSelection,
  rowClassName,
}: {
  isLoading: boolean;
  skeletonRows: number;
  handleRowSelection?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
}) {
  const { table } = useDataTableContext<TData>();
  const rows = table.getRowModel().rows;
  const totals = (table.getFooterGroups()[0]?.headers ?? []).filter(
    (header) => header.column.columnDef.footer && isVisible(header.column as TColumn),
  );

  if (isLoading) {
    return (
      <CardList>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
            <Skeleton className="h-5 w-1/2" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          </li>
        ))}
      </CardList>
    );
  }

  if (rows.length === 0) return null;

  return (
    <CardList>
      {rows.map((row) => (
        <RowCard key={row.id} row={row} onSelect={handleRowSelection} className={rowClassName?.(row.original)} />
      ))}
      {totals.length > 0 && (
        <li className="rounded-xl border border-line bg-surface p-4 font-semibold">
          <FieldGrid
            fields={totals.map((header) => ({
              id: header.id,
              label: columnLabel(header.column as TColumn),
              value: flexRender(header.column.columnDef.footer, header.getContext()),
            }))}
          />
        </li>
      )}
    </CardList>
  );
}

function CardList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-3 p-3">{children}</ul>;
}

function FieldGrid({ fields }: { fields: { id: string; label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {fields.map(({ id, label, value }) => (
        <div key={id} className="min-w-0">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RowCard<TData extends RowData>({
  row,
  onSelect,
  className,
}: {
  row: Row<TData>;
  onSelect?: (row: TData) => void;
  className?: string;
}) {
  const cells = row.getAllCells().filter((cell) => isVisible(cell.column as TColumn));
  const actions = cells.find((cell) => isActionColumn(cell.column as TColumn));
  const content = cells.filter((cell) => cell !== actions);
  const title = content.find((cell) => cell.column.columnDef.meta?.card === "title") ?? content[0];
  const details = content.filter((cell) => cell !== title);

  return (
    <li
      className={cx(
        "flex flex-col gap-3 rounded-xl border border-line bg-card p-4",
        onSelect && "cursor-pointer hover:border-brand/40",
        className,
      )}
      onClick={(event) => isRowClick(event) && onSelect?.(row.original)}
    >
      {title && <div className="min-w-0">{renderCell(title)}</div>}
      {details.length > 0 && (
        <FieldGrid
          fields={details.map((cell) => ({
            id: cell.id,
            label: columnLabel(cell.column as TColumn),
            value: renderCell(cell),
          }))}
        />
      )}
      {actions && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">{renderCell(actions)}</div>}
    </li>
  );
}
