import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

/** Table atoms (EMR ui-kit pattern): plain elements with the shared PayTrain styling. */

export function Table({ className, wrapperClassName, ...props }: ComponentProps<"table"> & { wrapperClassName?: string }) {
  return (
    <div data-slot="table-container" className={cx("relative w-full overflow-x-auto print:overflow-visible", wrapperClassName)}>
      <table data-slot="table" className={cx("w-full caption-bottom text-left text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cx("border-b border-line text-xs uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cx("divide-y divide-line", className)} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return <tfoot data-slot="table-footer" className={cx("border-t border-line bg-surface font-semibold", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cx("transition-colors hover:bg-surface", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cx("h-10 whitespace-nowrap px-5 align-middle font-medium", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cx("px-5 py-3.5 align-middle", className)} {...props} />;
}
