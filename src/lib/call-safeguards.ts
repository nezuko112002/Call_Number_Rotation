import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "./utils";
import type { DidRecord } from "@/types";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Minimum seconds between outbound calls from the same DID. */
export const DID_MIN_INTERVAL_SEC = envInt("DID_MIN_INTERVAL_SECONDS", 60);

/** Seconds before the same lead number can be dialed again. */
export const LEAD_DIAL_COOLDOWN_SEC = envInt("LEAD_DIAL_COOLDOWN_SECONDS", 1800);

/** Consecutive non-answered results on a DID before auto cooldown. */
export const BAD_STREAK_COUNT = envInt("BAD_STREAK_COUNT", 5);

const BAD_RESULTS = new Set(["no_answer", "busy", "failed", "spam_flagged"]);

export async function fetchDidForPlaceCall(
  supabase: SupabaseClient,
  params: { didId?: string | null; selectedDid: string },
): Promise<DidRecord | null> {
  if (params.didId) {
    const { data, error } = await supabase.from("did_pool").select("*").eq("id", params.didId).single();
    if (error) return null;
    return data as DidRecord;
  }
  const { data, error } = await supabase.from("did_pool").select("*").eq("did", params.selectedDid).single();
  if (error) return null;
  return data as DidRecord;
}

export function assertDidRateLimit(did: DidRecord): { ok: false; message: string } | { ok: true } {
  if (!did.last_used) return { ok: true };
  const last = new Date(did.last_used).getTime();
  if (Number.isNaN(last)) return { ok: true };
  const elapsedSec = (Date.now() - last) / 1000;
  if (elapsedSec < DID_MIN_INTERVAL_SEC) {
    const wait = Math.ceil(DID_MIN_INTERVAL_SEC - elapsedSec);
    return {
      ok: false,
      message: `This DID was used recently. Wait ${wait}s before placing another call from it (spam-risk throttle).`,
    };
  }
  return { ok: true };
}

export async function assertLeadDialCooldown(
  supabase: SupabaseClient,
  leadPhone: string,
): Promise<{ ok: false; message: string } | { ok: true }> {
  const normalized = normalizePhone(leadPhone);
  const variants = Array.from(new Set([normalized, leadPhone.trim()].filter(Boolean)));

  const { data, error } = await supabase
    .from("call_logs")
    .select("timestamp")
    .in("phone", variants)
    .order("timestamp", { ascending: false })
    .limit(1);

  if (error) return { ok: true };
  const last = data?.[0]?.timestamp as string | undefined;
  if (!last) return { ok: true };

  const lastMs = new Date(last).getTime();
  if (Number.isNaN(lastMs)) return { ok: true };
  const elapsedSec = (Date.now() - lastMs) / 1000;
  if (elapsedSec < LEAD_DIAL_COOLDOWN_SEC) {
    const wait = Math.ceil(LEAD_DIAL_COOLDOWN_SEC - elapsedSec);
    return {
      ok: false,
      message: `This lead was dialed recently. Cooldown ${wait}s remaining before redial.`,
    };
  }
  return { ok: true };
}

export async function maybeQuarantineDidAfterBadStreak(
  supabase: SupabaseClient,
  params: { didId: string; logDid: string },
): Promise<void> {
  if (!params.logDid) return;

  const { data: rows, error } = await supabase
    .from("call_logs")
    .select("result")
    .eq("did", params.logDid)
    .order("timestamp", { ascending: false })
    .limit(BAD_STREAK_COUNT);

  if (error || !rows?.length) return;
  if (rows.length < BAD_STREAK_COUNT) return;

  const allBad = rows.every((r) => BAD_RESULTS.has(String(r.result)));
  if (!allBad) return;

  await supabase.from("did_pool").update({ status: "cooldown" }).eq("id", params.didId).eq("status", "active");
}
