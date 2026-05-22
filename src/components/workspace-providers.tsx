"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CallbackReminderBar } from "@/components/callback-reminder-bar";
import { WorkspaceDataCacheProvider } from "@/components/workspace-data-cache";

function isAgentWorkspacePath(pathname: string): boolean {
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  return true;
}

export function WorkspaceProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showAgentChrome = isAgentWorkspacePath(pathname);

  if (!showAgentChrome) {
    return <>{children}</>;
  }

  return (
    <WorkspaceDataCacheProvider>
      <CallbackReminderBar />
      {children}
    </WorkspaceDataCacheProvider>
  );
}
