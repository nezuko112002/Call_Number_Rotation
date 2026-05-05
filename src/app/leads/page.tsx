"use client";

import { FormEvent, useEffect, useState } from "react";
import Papa from "papaparse";
import { AppShell } from "@/components/app-shell";
import type { LeadRecord } from "@/types";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [callingLeadIds, setCallingLeadIds] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const { identity, deviceReady, callStatus, activeCall, deviceError, hangup, mute } = useTwilioDevice();

  useEffect(() => {
    if (callStatus !== "in-progress") return;
    const timer = window.setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callStatus]);

  const load = async () => {
    const res = await fetch("/api/leads");
    const json = await res.json();
    if (res.ok) setLeads(json);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const addLead = async (e: FormEvent) => {
    e.preventDefault();
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setName("");
    setPhone("");
    load();
  };

  const onCsvUpload = async (file: File) => {
    const text = await file.text();
    const parsed = Papa.parse<{ name: string; phone: string }>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const valid = parsed.data.filter((row) => row.phone);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valid),
    });
    load();
  };

  const dialLead = async (lead: LeadRecord) => {
    if (callingLeadIds[lead.id]) return;

    setCallingLeadIds((prev) => ({ ...prev, [lead.id]: true }));
    setError("");
    setCallDurationSeconds(0);
    try {
      const rotateRes = await fetch("/api/rotate-did", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadPhone: lead.phone }),
      });
      const rotateData = await rotateRes.json();
      if (!rotateRes.ok) {
        setError(rotateData.error ?? "Failed to rotate DID.");
        return;
      }

      const callRes = await fetch("/api/twilio/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.phone,
          callerId: rotateData.did,
          agentIdentity: identity,
        }),
      });
      const callData = await callRes.json();
      if (!callRes.ok) {
        setError(callData.error ?? "Call failed.");
        return;
      }

      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          status: "dialed",
          assigned_did: rotateData.did,
        }),
      });

      await load();
    } finally {
      setCallingLeadIds((prev) => ({ ...prev, [lead.id]: false }));
    }
  };

  return (
    <AppShell>
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Leads Management</h1>
          <p className="text-sm text-slate-500">Import, route, and execute calls against pending leads.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={`inline-flex items-center gap-2 ${deviceReady ? "text-emerald-700" : "text-rose-700"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${deviceReady ? "bg-emerald-500" : "bg-rose-500"}`} />
              {deviceReady ? "Device Ready" : "Device Not Ready"}
            </span>
            <span className="text-slate-600">Identity: {identity || "loading..."}</span>
            <span className="text-slate-600">Call Status: {callStatus}</span>
            {callStatus === "in-progress" ? (
              <span className="text-slate-600">Duration: {callDurationSeconds}s</span>
            ) : null}
          </div>
          {deviceError ? <p className="mt-2 text-sm text-rose-600">{deviceError}</p> : null}
          {activeCall ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  const nextMuted = !isMuted;
                  mute(nextMuted);
                  setIsMuted(nextMuted);
                }}
                className="rounded bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800"
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={() => {
                  hangup();
                  setCallDurationSeconds(0);
                }}
                className="rounded bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700"
              >
                Hang Up
              </button>
            </div>
          ) : null}
        </div>

        <form onSubmit={addLead} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lead name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 415 555 0102"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <label className="flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm">
            CSV Upload
            <input
              type="file"
              accept=".csv"
              className="ml-2 w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsvUpload(f);
              }}
            />
          </label>
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">Add Lead</button>
        </form>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Area Code</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Assigned DID</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-3 py-2">{lead.name}</td>
                  <td className="px-3 py-2">{lead.phone}</td>
                  <td className="px-3 py-2">{lead.area_code}</td>
                  <td className="px-3 py-2">{lead.status}</td>
                  <td className="px-3 py-2">{lead.assigned_did ?? "-"}</td>
                  <td className="px-3 py-2">{lead.result ?? "-"}</td>
                  <td className="px-3 py-2">
                    <button
                      disabled={Boolean(callingLeadIds[lead.id]) || !deviceReady || !identity}
                      onClick={() => dialLead(lead)}
                      className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 disabled:opacity-50"
                    >
                      {callingLeadIds[lead.id]
                        ? "Calling..."
                        : lead.status === "completed"
                          ? "Redial"
                          : "Dial Now"}
                    </button>
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
