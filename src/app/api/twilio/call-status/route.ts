import { NextRequest, NextResponse } from "next/server";
import { mergePendingRecordingOntoCallLog } from "@/lib/call-recording";
import { updateDidAfterCall } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase";
import { conferenceNameFromCallSid } from "@/lib/twilio-conference";
import { normalizePhone } from "@/lib/utils";
import type { CallResult } from "@/types";

function mapTwilioStatusToResult(status: string, duration: number): CallResult {
  const normalized = status.toLowerCase();
  if (normalized === "busy") return "busy";
  if (normalized === "no-answer") return "no_answer";
  if (normalized === "completed") return duration > 0 ? "answered" : "no_answer";
  return "failed";
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const leadId = req.nextUrl.searchParams.get("leadId");
    const to = req.nextUrl.searchParams.get("to");
    const callerId = req.nextUrl.searchParams.get("callerId");

    if (!userId || !leadId || !to || !callerId) {
      return NextResponse.json({ error: "Missing callback query params" }, { status: 400 });
    }

    const form = await req.formData();
    const callStatusRaw = String(form.get("CallStatus") ?? "failed");
    const durationRaw = String(form.get("CallDuration") ?? "0");
    const duration = Number.parseInt(durationRaw, 10);
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    const result = mapTwilioStatusToResult(callStatusRaw, safeDuration);

    const normalizedTo = normalizePhone(to);
    const normalizedDid = normalizePhone(callerId);
    const timestamp = new Date().toISOString();
    const agentCallSid = String(form.get("CallSid") ?? "").trim();
    const conferenceName = agentCallSid ? conferenceNameFromCallSid(agentCallSid) : null;

    const supabase = getSupabaseServerClient();
    const { data: insertedLog, error: logError } = await supabase
      .from("call_logs")
      .insert({
        phone: normalizedTo,
        did: normalizedDid,
        direction: "outbound",
        result,
        timestamp,
        duration: safeDuration,
        user_id: userId,
        conference_name: conferenceName,
      })
      .select("id")
      .single();
    if (logError) throw logError;

    if (insertedLog?.id && conferenceName) {
      await mergePendingRecordingOntoCallLog(conferenceName, insertedLog.id as string);
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update({
        status: "completed",
        assigned_did: normalizedDid,
        result,
      })
      .eq("id", leadId)
      .eq("user_id", userId);
    if (leadError) throw leadError;

    await updateDidAfterCall(normalizedDid, result, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
