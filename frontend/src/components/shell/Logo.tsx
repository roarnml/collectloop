import { cx } from "@/lib/cx";

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      className={cx(
        "flex items-center gap-2 text-lg font-semibold tracking-tight",
        tone === "light" ? "text-white" : "text-ink",
      )}
    >
      <span className="grid size-7 place-items-center rounded-md bg-brand text-sm font-bold text-white" aria-hidden="true">
        P
      </span>
      <span>
        Pay<span className="text-accent">Train</span>
      </span>
    </span>
  );
}
