"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui";
import { getDidWarmupCap } from "@/lib/did-engine";
import type { DidRecord } from "@/types";

export default function DidPoolPage() {
  const [dids, setDids] = useState<DidRecord[]>([]);
  const [did, setDid] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/did-pool");
      const json = await res.json();
      if (res.ok) setDids(json);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/did-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ did, area_code: areaCode }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to add DID");
      return;
    }
    setDid("");
    setAreaCode("");
    await load();
  };

  const updateStatus = async (id: string, status: "active" | "cooldown") => {
    await fetch("/api/did-pool", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  const deleteDid = async (id: string) => {
    setError("");
    const confirmDelete = window.confirm("Delete this DID number? This action cannot be undone.");
    if (!confirmDelete) return;

    const res = await fetch("/api/did-pool", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to delete DID");
      return;
    }

    await load();
  };

  const rows = useMemo(
    () =>
      dids.map((row) => ({
        ...row,
        badPerformer: row.answer_rate < 20 || row.spam_score > 70,
        dailyCap: getDidWarmupCap(row),
      })),
    [dids],
  );

  return (
    <AppShell>
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">DID Pool Management</h1>
          <p className="mt-1 text-sm text-slate-500">Per-number rotation health and suppression controls.</p>
        </div>

        <form
          onSubmit={onAdd}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"
        >
          <input
            value={did}
            onChange={(e) => setDid(e.target.value)}
            placeholder="+1 212 555 0100"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            required
          />
          <input
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
            placeholder="Area code (optional)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Add DID
          </button>
        </form>
        {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Calls Today</th>
                <th className="px-3 py-2">Total Calls</th>
                <th className="px-3 py-2">Answer Rate</th>
                <th className="px-3 py-2">Spam Score</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-slate-100 transition hover:bg-slate-50 ${row.badPerformer ? "bg-rose-50/60" : ""}`}
                >
                  <td className="px-3 py-2 font-medium text-slate-900">{row.did}</td>
                  <td className="px-3 py-2 text-slate-700">{row.area_code || "-"}</td>
                  <td className="px-3 py-2">
                    <Badge
                      value={row.status}
                      tone={row.status === "active" ? "good" : row.status === "cooldown" ? "warn" : "bad"}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <span className="font-semibold text-slate-900">{row.calls_today}</span>
                    <span className="text-slate-400"> / {row.dailyCap}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.total_calls}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.answer_rate >= 40 ? "bg-emerald-100 text-emerald-700" : row.answer_rate >= 20 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {row.answer_rate}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.spam_score > 70 ? "bg-rose-100 text-rose-700" : row.spam_score > 40 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {row.spam_score}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.status === "active" ? (
                        <button
                          onClick={() => updateStatus(row.id, "cooldown")}
                          className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
                        >
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(row.id, "active")}
                          className="rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200"
                        >
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => deleteDid(row.id)}
                        className="rounded-md bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                    Loading DID pool...
                  </td>
                </tr>
              ) : null}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                    No DIDs yet. Add a DID to begin rotation.
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
