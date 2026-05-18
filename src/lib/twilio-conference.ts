import twilio from "twilio";
import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizePhone } from "@/lib/utils";

export function isConferenceCallsEnabled(): boolean {
  const flag = process.env.TWILIO_CONFERENCE_CALLS?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function conferenceNameFromCallSid(callSid: string): string {
  const safe = callSid.replace(/[^A-Za-z0-9]/g, "");
  return `cnf-${safe}`;
}

export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  }
  return twilio(accountSid, authToken);
}

export function getPublicBaseUrl(fallbackOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  return configured && configured.length > 0 ? configured : fallbackOrigin;
}

export function parseAgentUserIdFromClientIdentity(identity: string | null | undefined): string | null {
  if (!identity) return null;
  const trimmed = identity.trim();
  if (trimmed.startsWith("client:")) {
    return parseAgentUserIdFromClientIdentity(trimmed.slice("client:".length));
  }
  if (trimmed.startsWith("agent-")) {
    return trimmed.slice("agent-".length) || null;
  }
  return null;
}

export async function createConferenceSession(input: {
  userId: string;
  conferenceName: string;
  direction: "inbound" | "outbound";
  leadPhone: string;
  callerId: string;
  agentIdentity?: string | null;
  leadId?: string | null;
  parentCallSid?: string | null;
  agentCallSid?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  await supabase
    .from("call_conference_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("status", "active");

  const { data, error } = await supabase
    .from("call_conference_sessions")
    .insert({
      user_id: input.userId,
      conference_name: input.conferenceName,
      direction: input.direction,
      lead_phone: normalizePhone(input.leadPhone),
      caller_id: normalizePhone(input.callerId),
      agent_identity: input.agentIdentity ?? null,
      lead_id: input.leadId ?? null,
      parent_call_sid: input.parentCallSid ?? null,
      agent_call_sid: input.agentCallSid ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveConferenceSessionForUser(userId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("call_conference_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getActiveConferenceSessionByName(conferenceName: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("call_conference_sessions")
    .select("*")
    .eq("conference_name", conferenceName)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function endConferenceSession(conferenceName: string) {
  const supabase = getSupabaseServerClient();
  await supabase
    .from("call_conference_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("conference_name", conferenceName)
    .eq("status", "active");
}

export function buildJoinConferenceTwiml(options: {
  conferenceName: string;
  callerId?: string;
  startConferenceOnEnter: boolean;
  endConferenceOnExit: boolean;
  record?: boolean;
  waitUrl?: string;
  statusCallback?: string;
}) {
  const response = new twilio.twiml.VoiceResponse();
  const dialAttrs: Record<string, string | boolean> = {};
  if (options.callerId) dialAttrs.callerId = options.callerId;
  if (options.record) dialAttrs.record = "record-from-ringing";

  const conferenceAttrs: Record<string, string | boolean> = {
    startConferenceOnEnter: options.startConferenceOnEnter,
    endConferenceOnExit: options.endConferenceOnExit,
    beep: "false",
  };
  if (options.waitUrl) conferenceAttrs.waitUrl = options.waitUrl;
  if (options.statusCallback) {
    conferenceAttrs.statusCallback = options.statusCallback;
    conferenceAttrs.statusCallbackEvent = "end";
  }

  const dial = response.dial(dialAttrs);
  dial.conference(conferenceAttrs, options.conferenceName);
  return response.toString();
}

export async function dialParticipantIntoConference(input: {
  baseUrl: string;
  to: string;
  from: string;
  conferenceName: string;
  startConferenceOnEnter?: boolean;
}) {
  const client = getTwilioClient();
  const joinUrl = new URL("/api/twilio/conference/join", input.baseUrl);
  joinUrl.searchParams.set("name", input.conferenceName);
  joinUrl.searchParams.set("callerId", input.from);
  joinUrl.searchParams.set(
    "moderator",
    input.startConferenceOnEnter ? "true" : "false",
  );

  return client.calls.create({
    to: input.to,
    from: input.from,
    url: joinUrl.toString(),
    method: "POST",
  });
}
