import type { Metadata } from "next";
import { SuperadminShell } from "@/components/superadmin-shell";

export const metadata: Metadata = {
  title: "Superadmin Console | Outbound Dialer Intelligence System",
  description: "Cross-agent reporting, live QA, and call recordings",
};

export default function SuperadminConsoleLayout({ children }: { children: React.ReactNode }) {
  return <SuperadminShell>{children}</SuperadminShell>;
}
