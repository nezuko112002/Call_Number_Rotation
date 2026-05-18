import { NextRequest, NextResponse } from "next/server";
import { buildJoinConferenceTwiml } from "@/lib/twilio-conference";

export async function POST(req: NextRequest) {
  const query = req.nextUrl.searchParams;
  const name = query.get("name")?.trim();
  const callerId = query.get("callerId")?.trim();
  const moderator = query.get("moderator") === "true";

  if (!name) {
    const response = buildJoinConferenceTwiml({
      conferenceName: "invalid",
      startConferenceOnEnter: false,
      endConferenceOnExit: false,
    });
    return new NextResponse(response, { status: 400, headers: { "Content-Type": "text/xml" } });
  }

  const twiml = buildJoinConferenceTwiml({
    conferenceName: name,
    callerId: callerId || undefined,
    startConferenceOnEnter: moderator,
    endConferenceOnExit: false,
    record: true,
  });

  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
