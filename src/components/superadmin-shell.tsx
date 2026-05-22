"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type SuperadminNavGlyphId = "agentWorkspace" | "dialStats" | "liveQa" | "recordings" | "logout";

function SuperadminNavGlyph({ id }: { id: SuperadminNavGlyphId }) {
  const cls = "h-5 w-5 shrink-0";
  switch (id) {
    case "agentWorkspace":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      );
    case "dialStats":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "liveQa":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
        </svg>
      );
    case "recordings":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

const navItems: { href: string; label: string; glyph: SuperadminNavGlyphId }[] = [
  { href: "/superadmin", label: "Agent dial stats", glyph: "dialStats" },
  { href: "/superadmin/live-calls", label: "Live QA listen", glyph: "liveQa" },
  { href: "/superadmin/recordings", label: "Call recordings", glyph: "recordings" },
];

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
    router.replace("/login?portal=superadmin");
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
              className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition md:w-full ${
                (item.href === "/superadmin"
                  ? pathname === "/superadmin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`))
                  ? "border-violet-400 bg-violet-600 text-white shadow-sm"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <SuperadminNavGlyph id={item.glyph} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <Link
            href="/"
            className="inline-flex w-full items-center gap-2.5 rounded-xl border border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            aria-label="Open agent workspace"
          >
            <SuperadminNavGlyph id="agentWorkspace" />
            <span>Agent workspace</span>
          </Link>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {isUserLoading ? "Loading user..." : (userEmail ?? "No active user")}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SuperadminNavGlyph id="logout" />
            <span>{isSigningOut ? "Logging out..." : "Logout"}</span>
          </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
