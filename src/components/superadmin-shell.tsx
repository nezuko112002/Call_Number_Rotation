"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const navItems = [{ href: "/superadmin", label: "Agent dial stats" }] as const;

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    const loadSessionUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setIsUserLoading(false);
        return;
      }
      setUserEmail(data.session?.user?.email ?? null);
      setIsUserLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setIsUserLoading(false);
    });

    void loadSessionUser();
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);
    if (error) return;
    setUserEmail(null);
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-950 md:grid md:grid-cols-[280px_1fr]">
      <aside className="flex flex-col border-b border-slate-800 bg-slate-900/95 p-4 md:sticky md:top-0 md:h-screen md:overflow-hidden md:border-b-0 md:border-r md:p-5">
        <div className="mb-5 rounded-2xl border border-violet-500/30 bg-violet-950/50 p-4">
          <span className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-violet-200">
            Superadmin
          </span>
          <p className="mt-3 text-lg font-semibold leading-tight text-white">Operations console</p>
          <p className="mt-1 text-sm text-slate-400">Cross-agent reporting and shift analytics</p>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm font-medium transition md:w-full ${
                pathname === item.href
                  ? "border-violet-400 bg-violet-600 text-white shadow-sm"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4">
          <Link
            href="/"
            className="block rounded-xl border border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            Back to agent workspace
          </Link>
        </div>

        <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900 p-3 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {isUserLoading ? "Loading user..." : (userEmail ?? "No active user")}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
