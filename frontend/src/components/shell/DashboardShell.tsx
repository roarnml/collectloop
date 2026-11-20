"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/shell/Logo";
import { cx } from "@/lib/cx";

export { Logo };

const NAV: { href: string; label: string; soon?: boolean }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/requests", label: "Payment requests" },
  { href: "/customers", label: "Customers" },
  { href: "/transactions", label: "Transactions", soon: true },
  { href: "/reconciliation", label: "Reconciliation" },
];

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavItems pathname={usePathname()} onNavigate={onNavigate} />;
}

/** usePathname is runtime data on dynamic routes, so it streams in behind Suspense. */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavItems pathname="" onNavigate={onNavigate} />}>
      <ActiveNavLinks onNavigate={onNavigate} />
    </Suspense>
  );
}

function NavItems({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white/40"
              aria-disabled="true"
            >
              {item.label}
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/8 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BusinessSwitcher() {
  const { businesses, business, selectBusiness } = useAuth();
  if (!business) return <div className="mx-3 h-12 animate-pulse rounded-lg bg-white/5" aria-hidden="true" />;
  return (
    <div className="flex flex-col gap-1.5 px-3">
      <label htmlFor="business-switcher" className="text-[11px] font-medium uppercase tracking-wide text-white/50">
        Business
      </label>
      {businesses.length > 1 ? (
        <select
          id="business-switcher"
          value={business.id}
          onChange={(e) => selectBusiness(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-navy-soft px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      ) : (
        <p id="business-switcher" className="truncate text-sm font-medium text-white">
          {business.name}
        </p>
      )}
    </div>
  );
}

function AccountFooter() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
      <p className="truncate px-3 text-xs text-white/60" title={user?.email}>
        {user?.email ?? "\u00a0"}
      </p>
      <button
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOut();
        }}
        className="rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/8 hover:text-white disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <BusinessSwitcher />
      <NavLinks onNavigate={onNavigate} />
      <AccountFooter />
    </>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 bg-navy px-4 py-6 lg:flex">
          <Link href="/" className="px-3">
            <Logo />
          </Link>
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="rounded-lg p-2 text-white hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-6 bg-navy px-4 py-6">
            <div className="flex items-center justify-between px-3">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
