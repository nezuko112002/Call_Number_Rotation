import { NextRequest, NextResponse } from "next/server";
import { getTwilioClient } from "@/lib/twilio-conference";
import { getSupabaseServerClient } from "@/lib/supabase";
import { assertSuperadmin } from "@/lib/user-role";

/** Streams a Twilio call recording MP3 for superadmin replay (Twilio URLs require auth). */
export async function GET(req: NextRequest) {
  try {
    const requesterId = req.nextUrl.searchParams.get("user_id")?.trim();
    const callLogId = req.nextUrl.searchParams.get("call_log_id")?.trim();

    if (!requesterId || !callLogId) {
      return NextResponse.json({ error: "user_id and call_log_id are required" }, { status: 400 });
    }

    const access = await assertSuperadmin(requesterId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = getSupabaseServerClient();
    const { data: log, error: logError } = await supabase
      .from("call_logs")
      .select("twilio_recording_sid, recording_url")
      .eq("id", callLogId)
      .maybeSingle();
    if (logError) throw logError;

    if (!log) {
      return NextResponse.json({ error: "Call log not found" }, { status: 404 });
    }

    const recordingSid = (log.twilio_recording_sid as string | null)?.trim();
    if (!recordingSid) {
      return NextResponse.json({ error: "No recording available for this call" }, { status: 404 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return NextResponse.json({ error: "Twilio credentials are not configured" }, { status: 500 });
    }

    let mediaUrl = (log.recording_url as string | null)?.trim() || "";
    if (!mediaUrl) {
      const client = getTwilioClient();
      const recording = await client.recordings(recordingSid).fetch();
      const uri = recording.uri?.replace(".json", ".mp3") ?? "";
      mediaUrl = uri.startsWith("http") ? uri : `https://api.twilio.com${uri}`;
    }

    const twilioRes = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    });

    if (!twilioRes.ok) {
      return NextResponse.json({ error: "Could not fetch recording from Twilio" }, { status: 502 });
    }

    const bytes = await twilioRes.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": twilioRes.headers.get("Content-Type") ?? "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
