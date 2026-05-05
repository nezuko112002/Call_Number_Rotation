import { getSupabaseServerClient } from "./supabase";
import { extractAreaCode, normalizePhone, toFixedNum } from "./utils";
import { getClosestAreaCodeMatch, getDidWarmupCap, scoreDid, updateDidScoreAfterCall } from "./did-engine";
import type { CallLogRecord, CallResult, DidRecord, LeadRecord } from "@/types";

export async function listDidPool() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("did_pool").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DidRecord[];
}

export async function listLeads() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadRecord[];
}

export async function listCallLogs() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("call_logs").select("*").order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CallLogRecord[];
}

export async function selectBestDid(leadPhone: string) {
  const leadAreaCode = extractAreaCode(leadPhone);
  const dids = await listDidPool();

  const activeDids = dids.filter(
    (did) => did.status === "active" && did.calls_today < getDidWarmupCap(did) && did.spam_score < 80,
  );

  if (!activeDids.length) {
    return { bestDid: null, leadAreaCode };
  }

  const scored = activeDids.map((did) => ({
    did,
    score: scoreDid(did, leadAreaCode),
  }));

  scored.sort((a, b) => b.score - a.score);
  let best = scored[0]?.did ?? null;

  if (best && best.area_code !== leadAreaCode) {
    const closest = getClosestAreaCodeMatch(activeDids, leadAreaCode);
    if (closest) {
      const bestScore = scored[0]?.score ?? Number.NEGATIVE_INFINITY;
      const closestScore = scoreDid(closest, leadAreaCode);
      if (closestScore >= bestScore - 8) {
        best = closest;
      }
    }
  }

  return { bestDid: best, leadAreaCode };
}

export async function updateDidAfterCall(didNumber: string, callResult: CallResult) {
  const supabase = getSupabaseServerClient();
  const normalizedDidNumber = normalizePhone(didNumber);
  const { data: didExact, error } = await supabase.from("did_pool").select("*").eq("did", didNumber).single();
  if (error && error.code !== "PGRST116") throw error;

  let did = didExact as DidRecord | null;
  if (!did) {
    const { data: dids, error: listError } = await supabase.from("did_pool").select("*");
    if (listError) throw listError;
    did =
      ((dids ?? []) as DidRecord[]).find((row) => normalizePhone(row.did) === normalizedDidNumber) ?? null;
  }
  if (!did) throw new Error("DID not found");

  const nextScore = updateDidScoreAfterCall(did as DidRecord, callResult);
  const [totalCallsRes, answeredCallsRes] = await Promise.all([
    supabase.from("call_logs").select("id, did", { count: "exact" }),
    supabase.from("call_logs").select("id, did", { count: "exact" }).eq("result", "answered"),
  ]);
  if (totalCallsRes.error) throw totalCallsRes.error;
  if (answeredCallsRes.error) throw answeredCallsRes.error;

  const totalCallCount = (totalCallsRes.data ?? []).filter((log) => normalizePhone(log.did) === normalizePhone(did.did)).length;
  const answeredCallCount = (answeredCallsRes.data ?? []).filter((log) => normalizePhone(log.did) === normalizePhone(did.did)).length;
  const answerRate = totalCallCount > 0 ? toFixedNum((answeredCallCount / totalCallCount) * 100) : 0;

  const { error: updateError } = await supabase
    .from("did_pool")
    .update({
      ...nextScore,
      answer_rate: answerRate,
      calls_today: (did.calls_today ?? 0) + 1,
      total_calls: totalCallCount,
      last_used: new Date().toISOString(),
    })
    .eq("id", did.id);

  if (updateError) throw updateError;
}

export async function getDashboardAnalytics() {
  const [dids, logs] = await Promise.all([listDidPool(), listCallLogs()]);
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((log) => log.timestamp.slice(0, 10) === today);

  const answeredToday = todayLogs.filter((log) => log.result === "answered").length;
  const answerRate = todayLogs.length ? (answeredToday / todayLogs.length) * 100 : 0;

  const ranked = [...dids].sort((a, b) => b.answer_rate - a.answer_rate);
  const worst = [...dids].sort((a, b) => a.answer_rate - b.answer_rate);

  return {
    totalCallsToday: todayLogs.length,
    activeDids: dids.filter((d) => d.status === "active").length,
    avgAnswerRate: Number(answerRate.toFixed(2)),
    spamRiskAlerts: dids.filter((d) => d.spam_score >= 80).length,
    topPerforming: ranked.slice(0, 5),
    worstPerforming: worst.slice(0, 5),
    recentResults: todayLogs.slice(0, 12).reverse(),
  };
}
