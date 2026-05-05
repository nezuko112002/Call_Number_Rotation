"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { CallLogRecord } from "@/types";

export default function CallLogsPage() {
  const [logs, setLogs] = useState<CallLogRecord[]>([]);

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
          <h1 className="text-2xl font-semibold">Call Logs</h1>
          <p className="text-sm text-slate-500">Historical outbound call events and execution outcomes.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">DID Used</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-3 py-2">{log.phone}</td>
                  <td className="px-3 py-2">{log.did}</td>
                  <td className="px-3 py-2">{log.result}</td>
                  <td className="px-3 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2">{log.duration ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
