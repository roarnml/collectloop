"use client";

import { inputClass } from "@/components/ui";
import { useDataTableContext } from "./context";

/** The table's toolbar: a search box over every row (EMR Filters, without server-side filters). */
export default function Filters() {
  const { table, filterProps } = useDataTableContext();
  if (filterProps?.hideSearch) return null;
  const value = (table.getState().globalFilter as string) ?? "";
  const placeholder = filterProps?.searchPlaceholder ?? "Search…";

  return (
    <div className="border-b border-line p-4">
      <input
        type="search"
        value={value}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, "")}
        className={`${inputClass} sm:max-w-72`}
      />
    </div>
  );
}
