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

  const load = async () => {
    const res = await fetch("/api/did-pool");
    const json = await res.json();
    if (res.ok) setDids(json);
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
          <h1 className="text-2xl font-semibold">DID Pool Management</h1>
          <p className="text-sm text-slate-500">Per-number rotation health and suppression controls.</p>
        </div>

        <form onSubmit={onAdd} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
          <input
            value={did}
            onChange={(e) => setDid(e.target.value)}
            placeholder="+1 212 555 0100"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
            placeholder="Area code (optional)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">Add DID</button>
        </form>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
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
                <tr key={row.id} className={row.badPerformer ? "bg-rose-50" : ""}>
                  <td className="px-3 py-2">{row.did}</td>
                  <td className="px-3 py-2">{row.area_code}</td>
                  <td className="px-3 py-2">
                    <Badge
                      value={row.status}
                      tone={row.status === "active" ? "good" : row.status === "cooldown" ? "warn" : "bad"}
                    />
                  </td>
                  <td className="px-3 py-2">{row.calls_today}/{row.dailyCap}</td>
                  <td className="px-3 py-2">{row.total_calls}</td>
                  <td className="px-3 py-2">{row.answer_rate}%</td>
                  <td className="px-3 py-2">{row.spam_score}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.status === "active" ? (
                        <button onClick={() => updateStatus(row.id, "cooldown")} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                          Pause
                        </button>
                      ) : (
                        <button onClick={() => updateStatus(row.id, "active")} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => deleteDid(row.id)}
                        className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
