import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizePhone } from "@/lib/utils";
import {
  dialParticipantIntoConference,
  getActiveConferenceSessionForUser,
  getPublicBaseUrl,
  isConferenceCallsEnabled,
} from "@/lib/twilio-conference";

export async function POST(req: NextRequest) {
  if (!isConferenceCallsEnabled()) {
    return NextResponse.json(
      { error: "Conference calling is not enabled. Set TWILIO_CONFERENCE_CALLS=true." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const userId = body?.user_id as string | undefined;
    const participantId = body?.participant_id as string | undefined;
    const agentCallSid = body?.agent_call_sid as string | undefined;

    if (!userId || !participantId) {
      return NextResponse.json({ error: "user_id and participant_id are required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: participant, error: participantError } = await supabase
      .from("conference_participants")
      .select("id, label, phone")
      .eq("id", participantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (participantError) throw participantError;
    if (!participant) {
      return NextResponse.json({ error: "Saved contact not found" }, { status: 404 });
    }

    let session = await getActiveConferenceSessionForUser(userId);
    if (!session && agentCallSid) {
      const { data: bySid } = await supabase
        .from("call_conference_sessions")
        .select("*")
        .eq("agent_call_sid", agentCallSid)
        .eq("status", "active")
        .maybeSingle();
      session = bySid;
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            "No active conference for this call. Start or answer a call on Leads/Callbacks first, then try Connect again.",
        },
        { status: 409 },
      );
    }

    const baseUrl = getPublicBaseUrl(req.nextUrl.origin);
    const thirdPartyPhone = normalizePhone(participant.phone);
    const call = await dialParticipantIntoConference({
      baseUrl,
      to: thirdPartyPhone,
      from: session.caller_id,
      conferenceName: session.conference_name,
      startConferenceOnEnter: true,
    });

    return NextResponse.json({
      ok: true,
      label: participant.label,
      phone: participant.phone,
      conferenceName: session.conference_name,
      participantCallSid: call.sid,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect participant" },
      { status: 502 },
    );
  }
}
