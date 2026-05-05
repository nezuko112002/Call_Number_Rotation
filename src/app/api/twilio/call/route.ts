import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getSupabaseServerClient } from "@/lib/supabase";
import { updateDidAfterCall } from "@/lib/db";
import { normalizePhone } from "@/lib/utils";
import type { CallResult } from "@/types";

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

    // Keep DID metrics in sync for the Twilio Device call path.
    const result: CallResult = "answered";
    const supabase = getSupabaseServerClient();
    const timestamp = new Date().toISOString();
    const normalizedTo = normalizePhone(to);
    const normalizedDid = normalizePhone(callerId);

    try {
      await supabase.from("call_logs").insert({
        phone: normalizedTo,
        did: normalizedDid,
        result,
        timestamp,
        duration: null,
      });
      await updateDidAfterCall(normalizedDid, result);
    } catch (metricsError) {
      console.error("Failed to update DID metrics after Twilio call", metricsError);
    }

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
