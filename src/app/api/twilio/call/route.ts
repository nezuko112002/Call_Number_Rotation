import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

interface CreateCallBody {
  to?: string;
  callerId?: string;
  agentIdentity?: string;
}

export async function POST(req: NextRequest) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!accountSid || !authToken || !baseUrl) {
    return NextResponse.json(
      {
        error: "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or NEXT_PUBLIC_BASE_URL",
      },
      { status: 500 },
    );
  }

  const body = (await req.json()) as CreateCallBody;
  const to = body.to?.trim();
  const callerId = body.callerId?.trim();
  const agentIdentity = body.agentIdentity?.trim();

  if (!to || !callerId || !agentIdentity) {
    return NextResponse.json(
      { error: "to, callerId, and agentIdentity are required" },
      { status: 400 },
    );
  }

  const client = twilio(accountSid, authToken);

  try {
    const call = await client.calls.create({
      from: callerId,
      to: `client:${agentIdentity}`,
      url: `${baseUrl}/api/twilio/voice?to=${encodeURIComponent(to)}&callerId=${encodeURIComponent(callerId)}`,
      method: "POST",
    });

    return NextResponse.json({ callSid: call.sid, status: call.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Twilio call creation failed",
      },
      { status: 502 },
    );
  }
}
