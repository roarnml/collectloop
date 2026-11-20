"use client";

import type { RowData } from "@tanstack/react-table";
import { createContext, use } from "react";
import type { DataTableContextValue } from "./types";

const DataTableContext = createContext<DataTableContextValue | null>(null);

export function useDataTableContext<TData extends RowData = RowData>(): DataTableContextValue<TData> {
  const value = use(DataTableContext);
  if (value == null) throw new Error("useDataTableContext must be used within a DataTableProvider");
  return value as DataTableContextValue<TData>;
}

export const DataTableContextProvider = DataTableContext;
