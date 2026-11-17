import { AuthProvider } from "@/components/auth/AuthProvider";
import { DashboardShell } from "@/components/shell/DashboardShell";

/** Signed-in business pages. AuthProvider redirects to /login or /setup as needed. */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
