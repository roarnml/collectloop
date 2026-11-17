import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { SimulatedBanner } from "@/components/ui";

/** Sign-in, registration and business setup: centred card, no dashboard chrome. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <SimulatedBanner compact />
      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
        <Link href="/" className="mb-8">
          <Logo tone="dark" />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
