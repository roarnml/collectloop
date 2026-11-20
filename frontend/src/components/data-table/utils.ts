import type { Column, RowData } from "@tanstack/react-table";

/**
 * Whether a click should pick the row: it came from inside the row (not a portal), and not from a link,
 * button or input in it, which handle themselves.
 */
export function isRowClick(event: { target: EventTarget; currentTarget: Element }): boolean {
  if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target)) return false;
  return !event.target.closest("a, button, input, select, textarea, label");
}

/** A column's label: its header when that's text, else its id ("amount_paid" → "Amount paid"). */
export function columnLabel<TData extends RowData>(column: Column<TData, unknown>): string {
  const { header } = column.columnDef;
  if (typeof header === "string") return header;
  const words = column.id.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
