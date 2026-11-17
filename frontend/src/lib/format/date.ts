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

export function formatDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : "No due date";
}

export function formatDateTime(iso: string | null): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : "—";
}
