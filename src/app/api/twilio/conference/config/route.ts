import { NextRequest, NextResponse } from "next/server";
import { getPublicBaseUrl, isConferenceCallsEnabled } from "@/lib/twilio-conference";

/** Lets the Connect Call UI verify conference mode on this server vs the Twilio webhook base URL. */
export async function GET(req: NextRequest) {
  const webhookBaseUrl = getPublicBaseUrl(req.nextUrl.origin).replace(/\/$/, "");
  const appOrigin = req.headers.get("x-forwarded-host")
    ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host")}`
    : req.nextUrl.origin;

  const normalizedApp = appOrigin.replace(/\/$/, "");
  const webhookMatchesApp =
    normalizedApp === webhookBaseUrl ||
    webhookBaseUrl.includes(normalizedApp.replace(/^https?:\/\//, ""));

  return NextResponse.json({
    conferenceCallsEnabled: isConferenceCallsEnabled(),
    webhookBaseUrl,
    appOrigin: normalizedApp,
    webhookMatchesApp,
  });
}
