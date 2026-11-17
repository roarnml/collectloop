import { Logo } from "@/components/shell/Logo";
import { SimulatedBanner } from "@/components/ui";

/** Customer-facing pages: no dashboard chrome, no login, phone-first. */
export default function PayLayout({ children }: LayoutProps<"/pay">) {
  return (
    <div className="flex min-h-screen flex-col">
      <SimulatedBanner compact />
      <header className="border-b border-line bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Logo tone="dark" />
          <span className="text-xs text-muted">Secure payment request</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 sm:py-10">{children}</main>
      <footer className="px-4 pb-6 text-center text-xs text-muted">
        PayTrain never sees or stores your wallet login. You authorise payments with your own wallet provider.
      </footer>
    </div>
  );
}
