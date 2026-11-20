import type { ColumnDef, RowData, SortingState, Table } from "@tanstack/react-table";
import type { ReactNode } from "react";

export type TFilterProps = {
  searchPlaceholder?: string;
  hideSearch?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the context holds tables of any row type
export type DataTableContextValue<TData extends RowData = any> = {
  table: Table<TData>;
  hidePagination: boolean;
  filterProps?: TFilterProps;
};

export type DataTableProviderProps<TData extends RowData> = {
  data: TData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column value types vary per column
  columns: ColumnDef<TData, any>[];
  children: ReactNode;
  defaultSorting?: SortingState;
  enableSortingRemoval?: boolean;
  /** Text the search box matches against, per row. Defaults to every column's value. */
  searchText?: (row: TData) => string;
  pageSize?: number;
  hidePagination?: boolean;
  filterProps?: TFilterProps;
  /** Stable id per row (defaults to the row index). */
  getRowId?: (row: TData) => string;
};

export type TableProps<TData extends RowData> = Omit<DataTableProviderProps<TData>, "children"> & {
  children?: ReactNode;
  /** Show the search box above the table. */
  showFilters?: boolean;
  emptyMessage?: string;
  className?: string;
  hideHeader?: boolean;
  isLoading?: boolean;
  skeletonRows?: number;
  /** Called when a row (or its card) is picked. */
  handleRowSelection?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
  /** Accessible name for the table. */
  label?: string;
};
