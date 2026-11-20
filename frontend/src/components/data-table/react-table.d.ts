import "@tanstack/react-table";
import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the augmented interface must repeat these generics
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * Its place on a phone, where each row is a card: "title" heads the card (else the first column), "actions" is its
     * footer, "hidden" leaves it off. Any other column is a label / value detail.
     */
    card?: "title" | "actions" | "hidden";
    /** `right` for amounts: aligns the header and every cell, so figures line up. */
    align?: "right";
    /** Extra classes for this column's header and cells. */
    className?: string;
  }
}
