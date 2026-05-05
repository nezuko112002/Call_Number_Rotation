"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/did-pool", label: "DID Pool" },
  { href: "/leads", label: "Leads" },
  { href: "/call-logs", label: "Call Logs" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[260px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 md:sticky md:top-0 md:h-screen md:overflow-hidden md:border-b-0 md:border-r">
        <div className="mb-4">
          <p className="text-lg font-semibold leading-tight">Outbound Dialer Intelligence System</p>
          <p className="mt-1 text-xs text-slate-500">Caller Identity Name: Ridge Theory</p>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-3 py-2 text-sm md:w-full ${
                pathname === item.href
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="hidden border-b border-slate-200 bg-white px-6 py-4 md:block">
          <p className="text-sm text-slate-500">Campaign operations workspace</p>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
