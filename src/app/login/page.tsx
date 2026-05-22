"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AGENT_HOME_PATH, SUPERADMIN_HOME_PATH, homePathForRole } from "@/lib/auth-routes";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { UserRole } from "@/lib/user-role";

type LoginPortal = "agent" | "superadmin";

async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const profileRes = await fetch(`/api/auth/me?user_id=${encodeURIComponent(userId)}`);
  if (!profileRes.ok) return null;
  const profile = (await profileRes.json()) as { role?: UserRole };
  return profile.role ?? null;
}

function resolvePostLoginPath(role: UserRole | null, portal: LoginPortal): string {
  if (portal === "superadmin") {
    if (role !== "superadmin") return AGENT_HOME_PATH;
    return SUPERADMIN_HOME_PATH;
  }
  return homePathForRole(role);
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portal: LoginPortal = searchParams.get("portal") === "superadmin" ? "superadmin" : "agent";
  const isSuperadminPortal = portal === "superadmin";

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const redirectAfterAuth = useCallback(
    async (userId: string) => {
      const role = await fetchUserRole(userId);
      if (portal === "superadmin" && role !== "superadmin") {
        setError("This account does not have superadmin access.");
        return;
      }
      router.replace(resolvePostLoginPath(role, portal));
      router.refresh();
    },
    [portal, router],
  );

  const syncUserRecord = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user?.id || !userData.user.email) {
      throw new Error(userError?.message ?? "Could not load current user session.");
    }

    const syncResponse = await fetch("/api/auth/sync-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: userData.user.id,
        email: userData.user.email,
      }),
    });

    if (!syncResponse.ok) {
      const payload = (await syncResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Could not sync user profile.");
    }

    return userData.user.id;
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUserId = data.session?.user?.id;
      if (!sessionUserId) return;
      const role = await fetchUserRole(sessionUserId);
      router.replace(resolvePostLoginPath(role, portal));
    };

    void checkSession();
  }, [portal, router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (isSignUpMode && isSuperadminPortal) {
      setIsSubmitting(false);
      setError("Superadmin accounts are created by an administrator.");
      return;
    }

    if (isSignUpMode) {
      const signUpResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!signUpResponse.ok) {
        const payload = (await signUpResponse.json().catch(() => null)) as { error?: string } | null;
        setIsSubmitting(false);
        setError(payload?.error ?? "Could not create account.");
        return;
      }

      const { error: signInErrorAfterSignUp } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErrorAfterSignUp) {
        setIsSubmitting(false);
        setError(signInErrorAfterSignUp.message);
        return;
      }

      try {
        const userId = await syncUserRecord();
        setIsSubmitting(false);
        await redirectAfterAuth(userId);
      } catch (syncError) {
        setIsSubmitting(false);
        setError(syncError instanceof Error ? syncError.message : "Could not sync user profile.");
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message);
      return;
    }

    try {
      const userId = await syncUserRecord();
      setIsSubmitting(false);
      await redirectAfterAuth(userId);
    } catch (syncError) {
      setIsSubmitting(false);
      setError(syncError instanceof Error ? syncError.message : "Could not sync user profile.");
    }
  };

  const mainClass = isSuperadminPortal
    ? "flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8"
    : "flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8";

  const cardClass = isSuperadminPortal
    ? "w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm"
    : "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

  const accentClass = isSuperadminPortal
    ? "text-xs font-semibold uppercase tracking-wide text-violet-300"
    : "text-xs font-semibold uppercase tracking-wide text-indigo-700";

  const titleClass = isSuperadminPortal ? "mt-2 text-2xl font-semibold text-white" : "mt-2 text-2xl font-semibold text-slate-900";

  const subtitleClass = isSuperadminPortal ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500";

  const labelClass = isSuperadminPortal ? "mb-1.5 block text-sm font-medium text-slate-300" : "mb-1.5 block text-sm font-medium text-slate-700";

  const inputClass = isSuperadminPortal
    ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
    : "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

  const submitClass = isSuperadminPortal
    ? "w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
    : "w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

  const secondaryButtonClass = isSuperadminPortal
    ? "mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700"
    : "mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";

  const footerClass = isSuperadminPortal ? "mt-4 text-center text-xs text-slate-500" : "mt-4 text-center text-xs text-slate-500";

  const footerLinkClass = isSuperadminPortal
    ? "font-medium text-violet-300 underline decoration-violet-500/40 underline-offset-4 hover:text-white"
    : "font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900";

  return (
    <main className={mainClass}>
      <div className={cardClass}>
        <p className={accentClass}>{isSuperadminPortal ? "Superadmin portal" : "Ridge Theory"}</p>
        <h1 className={titleClass}>{isSignUpMode ? "Sign up" : "Sign in"}</h1>
        <p className={subtitleClass}>
          {isSuperadminPortal
            ? "Operations console for cross-agent reporting, live QA, and recordings."
            : isSignUpMode
              ? "Create your account for the Outbound Dialer Intelligence System."
              : "Access the Outbound Dialer Intelligence System."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@company.com"
            />
          </label>

          <label className="block">
            <span className={labelClass}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className={inputClass}
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p
              className={
                isSuperadminPortal
                  ? "rounded-md border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-200"
                  : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              }
            >
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className={submitClass}>
            {isSubmitting ? (isSignUpMode ? "Signing up..." : "Signing in...") : isSignUpMode ? "Sign up" : "Sign in"}
          </button>
        </form>

        {!isSuperadminPortal ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsSignUpMode((prev) => !prev);
            }}
            className={secondaryButtonClass}
          >
            {isSignUpMode ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        ) : null}

        <p className={footerClass}>
          {isSuperadminPortal ? (
            <>
              Agent dialer?{" "}
              <Link href="/login" className={footerLinkClass}>
                Agent sign in
              </Link>
            </>
          ) : (
            <>
              Superadmin?{" "}
              <Link href="/login?portal=superadmin" className={footerLinkClass}>
                Superadmin portal
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
          <p className="text-sm text-slate-500">Loading sign in...</p>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
