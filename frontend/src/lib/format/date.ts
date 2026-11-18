const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse "YYYY-MM-DD" as a local calendar date (not UTC midnight). */
function parseDate(value: string): Date {
  const m = DATE_ONLY.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

/** Today's local date as "YYYY-MM-DD". */
export function todayDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when a "YYYY-MM-DD" due date is before today (local). */
export function isPastDue(dueDate: string | null): boolean {
  return !!dueDate && dueDate < todayDate();
}

export function formatDate(value: string | null): string {
  return value ? dateFmt.format(parseDate(value)) : "No due date";
}

export function formatDateTime(iso: string | null): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : "—";
}
