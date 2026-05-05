"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase";

interface DashboardData {
  totalCallsToday: number;
  activeDids: number;
  avgAnswerRate: number;
  spamRiskAlerts: number;
  topPerforming: Array<{ did: string; answer_rate: number }>;
  worstPerforming: Array<{ did: string; answer_rate: number }>;
  recentResults: Array<{ did: string; result: string }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const isMounted = typeof window !== "undefined";
  const supabase = getSupabaseBrowserClient();
  const stats = [
    {
      title: "Total Calls Today",
      value: data?.totalCallsToday ?? 0,
      tone: "text-indigo-700 bg-indigo-50 border-indigo-100",
    },
    {
      title: "Active DID Numbers",
      value: data?.activeDids ?? 0,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
    },
    {
      title: "Average Answer Rate",
      value: `${data?.avgAnswerRate ?? 0}%`,
      tone: "text-blue-700 bg-blue-50 border-blue-100",
    },
    {
      title: "Spam Risk Alerts",
      value: data?.spamRiskAlerts ?? 0,
      tone: "text-rose-700 bg-rose-50 border-rose-100",
    },
  ] as const;

  const getResultTone = (result: string) => {
    if (result === "answered") return "bg-emerald-100 text-emerald-700";
    if (result === "no_answer" || result === "busy") return "bg-amber-100 text-amber-700";
    if (result === "failed" || result === "spam_flagged") return "bg-rose-100 text-rose-700";
    return "bg-slate-100 text-slate-700";
  };

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setError("You must be signed in to view dashboard analytics.");
        return;
      }
      setUserId(user.id);
    };

    void bootstrap();
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?user_id=${encodeURIComponent(userId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load dashboard");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error");
      }
    };

    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [userId]);

  return (
    <AppShell>
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Real-time campaign performance and DID health.</p>
        </div>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.title} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className={`absolute right-4 top-4 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stat.tone}`}>
                Live
              </span>
              <p className="text-sm font-medium text-slate-500">{stat.title}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Outcomes</h2>
            <div className="space-y-2">
              {(data?.recentResults ?? []).length === 0 ? (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">No recent call results yet.</p>
              ) : (
                (data?.recentResults ?? []).map((result, idx) => (
                  <div key={`${result.did}-${result.result}-${idx}`} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                    <span className="max-w-[65%] truncate text-sm font-medium text-slate-800">{result.did}</span>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getResultTone(result.result)}`}>
                      {result.result.replace("_", " ")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Top Performing Numbers</h2>
            <div className="h-72">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.topPerforming ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="did" hide />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="answer_rate" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Worst Performing Numbers</h2>
            <div className="h-72">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.worstPerforming ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="did" hide />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="answer_rate" fill="#e11d48" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
