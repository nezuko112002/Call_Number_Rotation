import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

/** Hold loop for inbound callers waiting in a conference before the agent joins. */
export async function POST(req: NextRequest) {
  const response = new twilio.twiml.VoiceResponse();
  response.say("Please hold while we connect you to your agent.");
  response.pause({ length: 8 });
  const loopUrl = new URL("/api/twilio/conference/wait", req.nextUrl.origin);
  response.redirect({ method: "POST" }, loopUrl.toString());
  return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
