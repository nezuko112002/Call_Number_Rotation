"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { CallLogRecord } from "@/types";

export default function CallLogsPage() {
  const [logs, setLogs] = useState<CallLogRecord[]>([]);

  const formatDuration = (value: number | null) => {
    if (value == null) return "-";
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getResultTone = (result: CallLogRecord["result"]) => {
    if (result === "answered") return "bg-emerald-100 text-emerald-700";
    if (result === "no_answer" || result === "busy") return "bg-amber-100 text-amber-700";
    if (result === "failed" || result === "spam_flagged") return "bg-rose-100 text-rose-700";
    return "bg-slate-100 text-slate-700";
  };

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/call-logs");
      const json = await res.json();
      if (res.ok) setLogs(json);
    };
    load();
  }, []);

  return (
    <AppShell>
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Call Logs</h1>
          <p className="mt-1 text-sm text-slate-500">Historical outbound call events and execution outcomes.</p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Lead Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">DID Used</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100 transition hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{log.lead_name ?? "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{log.phone}</td>
                  <td className="px-3 py-2 text-slate-700">{log.did}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getResultTone(log.result)}`}>
                      {log.result.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {formatDuration(log.duration)}
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                    No call logs yet. Completed calls will appear here.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
