import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { endConferenceSession, getPublicBaseUrl } from "@/lib/twilio-conference";

function toInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isAgentAnswered(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "completed" || normalized === "in-progress";
}

/** Retry dialing the agent into an inbound conference when the first attempt fails. */
export async function POST(req: NextRequest) {
  const query = req.nextUrl.searchParams;
  const userId = query.get("userId");
  const leadPhone = query.get("leadPhone");
  const did = query.get("did");
  const conferenceName = query.get("conferenceName");
  const retry = Math.max(0, toInt(query.get("retry"), 0));
  const maxRetry = Math.max(1, toInt(query.get("maxRetry"), 6));

  const form = await req.formData();
  const callStatus = String(form.get("CallStatus") ?? "failed");

  const response = new twilio.twiml.VoiceResponse();

  if (!userId || !leadPhone || !did || !conferenceName) {
    response.hangup();
    return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  if (isAgentAnswered(callStatus)) {
    return new NextResponse("", { status: 204 });
  }

  const baseUrl = getPublicBaseUrl(req.nextUrl.origin);

  if (retry < maxRetry) {
    const agentStatusUrl = new URL("/api/twilio/conference/agent-status", baseUrl);
    agentStatusUrl.searchParams.set("userId", userId);
    agentStatusUrl.searchParams.set("leadPhone", leadPhone);
    agentStatusUrl.searchParams.set("did", did);
    agentStatusUrl.searchParams.set("conferenceName", conferenceName);
    agentStatusUrl.searchParams.set("retry", String(retry + 1));
    agentStatusUrl.searchParams.set("maxRetry", String(maxRetry));

    const joinUrl = new URL("/api/twilio/conference/join", baseUrl);
    joinUrl.searchParams.set("name", conferenceName);
    joinUrl.searchParams.set("callerId", did);
    joinUrl.searchParams.set("moderator", "true");

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );

    await client.calls.create({
      to: `client:agent-${userId}`,
      from: did,
      url: joinUrl.toString(),
      method: "POST",
      statusCallback: agentStatusUrl.toString(),
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["completed", "busy", "no-answer", "failed", "canceled"],
    });

    return new NextResponse("", { status: 204 });
  }

  await endConferenceSession(conferenceName);
  return new NextResponse("", { status: 204 });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
