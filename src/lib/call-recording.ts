import { getSupabaseServerClient } from "@/lib/supabase";

export function buildRecordingStatusCallbackUrl(baseUrl: string, conferenceName: string): string {
  const url = new URL("/api/twilio/recording-status", baseUrl);
  url.searchParams.set("name", conferenceName);
  return url.toString();
}

export async function saveRecordingForConference(input: {
  conferenceName: string;
  recordingSid: string;
  recordingUrl: string;
  recordingDuration?: number | null;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const duration =
    input.recordingDuration != null && Number.isFinite(input.recordingDuration)
      ? input.recordingDuration
      : null;

  const { data: updated, error: updateError } = await supabase
    .from("call_logs")
    .update({
      twilio_recording_sid: input.recordingSid,
      recording_url: input.recordingUrl,
      ...(duration != null && duration > 0 ? { duration } : {}),
    })
    .eq("conference_name", input.conferenceName)
    .select("id");
  if (updateError) throw updateError;

  if ((updated ?? []).length > 0) {
    await supabase.from("pending_call_recordings").delete().eq("conference_name", input.conferenceName);
    return;
  }

  const { error: pendingError } = await supabase.from("pending_call_recordings").upsert(
    {
      conference_name: input.conferenceName,
      twilio_recording_sid: input.recordingSid,
      recording_url: input.recordingUrl,
      recording_duration: duration,
    },
    { onConflict: "conference_name" },
  );
  if (pendingError) throw pendingError;
}

/** Apply buffered recording metadata after a new call_logs row is created. */
export async function mergePendingRecordingOntoCallLog(
  conferenceName: string | null | undefined,
  callLogId: string,
): Promise<void> {
  if (!conferenceName?.trim()) return;

  const supabase = getSupabaseServerClient();
  const { data: pending, error: pendingError } = await supabase
    .from("pending_call_recordings")
    .select("twilio_recording_sid, recording_url, recording_duration")
    .eq("conference_name", conferenceName)
    .maybeSingle();
  if (pendingError) throw pendingError;
  if (!pending) return;

  const duration = pending.recording_duration as number | null;
  const { error: updateError } = await supabase
    .from("call_logs")
    .update({
      twilio_recording_sid: pending.twilio_recording_sid as string,
      recording_url: pending.recording_url as string,
      ...(duration != null && duration > 0 ? { duration } : {}),
    })
    .eq("id", callLogId);
  if (updateError) throw updateError;

  await supabase.from("pending_call_recordings").delete().eq("conference_name", conferenceName);
}
