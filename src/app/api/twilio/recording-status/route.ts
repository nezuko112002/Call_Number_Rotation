import { NextRequest, NextResponse } from "next/server";
import { saveRecordingForConference } from "@/lib/call-recording";

/** Twilio Conference recordingStatusCallback — stores replay URL on call_logs. */
export async function POST(req: NextRequest) {
  const conferenceName = req.nextUrl.searchParams.get("name")?.trim();
  if (!conferenceName) {
    return new NextResponse("", { status: 204 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse("", { status: 204 });
  }

  const recordingStatus = String(form.get("RecordingStatus") ?? "").toLowerCase();
  if (recordingStatus !== "completed") {
    return new NextResponse("", { status: 204 });
  }

  const recordingSid = String(form.get("RecordingSid") ?? "").trim();
  const recordingUrl = String(form.get("RecordingUrl") ?? "").trim();
  if (!recordingSid || !recordingUrl) {
    return new NextResponse("", { status: 204 });
  }

  const durationRaw = String(form.get("RecordingDuration") ?? "0");
  const recordingDuration = Number.parseInt(durationRaw, 10);

  try {
    await saveRecordingForConference({
      conferenceName,
      recordingSid,
      recordingUrl,
      recordingDuration: Number.isFinite(recordingDuration) ? recordingDuration : null,
    });
    return new NextResponse("", { status: 204 });
  } catch (error) {
    console.error("[twilio/recording-status]", error);
    return new NextResponse("", { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
