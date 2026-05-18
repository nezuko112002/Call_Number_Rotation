import { NextRequest, NextResponse } from "next/server";
import { getTwilioClient } from "@/lib/twilio-conference";

export type ParticipantCallOutcome = "pending" | "answered" | "not_answered";

function resolveOutcome(status: string, durationSeconds: number): ParticipantCallOutcome {
  const normalized = status.toLowerCase();

  if (normalized === "in-progress") {
    return "answered";
  }

  if (normalized === "completed") {
    return durationSeconds > 0 ? "answered" : "not_answered";
  }

  if (
    normalized === "busy" ||
    normalized === "failed" ||
    normalized === "no-answer" ||
    normalized === "canceled" ||
    normalized === "cancelled"
  ) {
    return "not_answered";
  }

  return "pending";
}

export async function GET(req: NextRequest) {
  const callSid = req.nextUrl.searchParams.get("call_sid")?.trim();
  if (!callSid) {
    return NextResponse.json({ error: "call_sid query param is required" }, { status: 400 });
  }

  try {
    const client = getTwilioClient();
    const call = await client.calls(callSid).fetch();
    const durationRaw = Number.parseInt(String(call.duration ?? "0"), 10);
    const durationSeconds = Number.isFinite(durationRaw) ? durationRaw : 0;
    const outcome = resolveOutcome(call.status, durationSeconds);

    return NextResponse.json({
      outcome,
      status: call.status,
      durationSeconds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch call status" },
      { status: 502 },
    );
  }
}
