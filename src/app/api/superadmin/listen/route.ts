import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import {
  dialQaMonitorIntoConference,
  isConferenceCallsEnabled,
} from "@/lib/twilio-conference";
import { assertSuperadmin } from "@/lib/user-role";

export async function POST(req: NextRequest) {
  try {
    if (!isConferenceCallsEnabled()) {
      return NextResponse.json(
        {
          error:
            "Conference calling is not enabled. Set TWILIO_CONFERENCE_CALLS=true and redeploy.",
        },
        { status: 503 },
      );
    }

    const body = await req.json();
    const requesterId = (body?.user_id as string | undefined)?.trim();
    const conferenceName = (body?.conference_name as string | undefined)?.trim();

    if (!requesterId || !conferenceName) {
      return NextResponse.json({ error: "user_id and conference_name are required" }, { status: 400 });
    }

    const access = await assertSuperadmin(requesterId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = getSupabaseServerClient();
    const { data: session, error: sessionError } = await supabase
      .from("call_conference_sessions")
      .select("conference_name, caller_id, status")
      .eq("conference_name", conferenceName)
      .eq("status", "active")
      .maybeSingle();
    if (sessionError) throw sessionError;

    if (!session) {
      return NextResponse.json(
        { error: "This call is not active. Refresh the list and try again." },
        { status: 409 },
      );
    }

    const monitor = await dialQaMonitorIntoConference({
      conferenceName,
      supervisorUserId: requesterId,
      callerId: session.caller_id as string,
    });

    return NextResponse.json({
      ok: true,
      conferenceName,
      monitorCallSid: monitor.callSid,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start QA listen" },
      { status: 502 },
    );
  }
}
