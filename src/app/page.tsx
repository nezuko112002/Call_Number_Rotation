"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

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
  const isMounted = typeof window !== "undefined";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard");
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
  }, []);

  return (
    <AppShell>
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500">Real-time campaign performance and DID health.</p>
        </div>

        {error ? <div className="rounded-md bg-rose-100 p-3 text-sm text-rose-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card title="Total Calls Today" value={data?.totalCallsToday ?? 0} />
          <Card title="Active DID Numbers" value={data?.activeDids ?? 0} />
          <Card title="Average Answer Rate" value={`${data?.avgAnswerRate ?? 0}%`} />
          <Card title="Spam Risk Alerts" value={data?.spamRiskAlerts ?? 0} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 font-semibold">Top Performing Numbers</h2>
            <div className="h-72">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.topPerforming ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="did" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="answer_rate" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 font-semibold">Worst Performing Numbers</h2>
            <div className="h-72">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.worstPerforming ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="did" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="answer_rate" fill="#e11d48" />
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
