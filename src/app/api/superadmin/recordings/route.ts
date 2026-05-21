import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { assertSuperadmin } from "@/lib/user-role";
import { normalizePhone } from "@/lib/utils";
import type { SuperadminCallRecordingRow } from "@/types";

function parseIsoTimestamp(value: string | null, label: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!value?.trim()) {
    return { ok: false, error: `${label} is required` };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: `${label} must be a valid ISO timestamp` };
  }
  return { ok: true, value: parsed.toISOString() };
}

export async function GET(req: NextRequest) {
  try {
    const requesterId = req.nextUrl.searchParams.get("user_id")?.trim();
    if (!requesterId) {
      return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
    }

    const access = await assertSuperadmin(requesterId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const fromParsed = parseIsoTimestamp(req.nextUrl.searchParams.get("from"), "from");
    if (!fromParsed.ok) {
      return NextResponse.json({ error: fromParsed.error }, { status: 400 });
    }
    const toParsed = parseIsoTimestamp(req.nextUrl.searchParams.get("to"), "to");
    if (!toParsed.ok) {
      return NextResponse.json({ error: toParsed.error }, { status: 400 });
    }

    const from = fromParsed.value;
    const to = toParsed.value;
    if (new Date(from).getTime() > new Date(to).getTime()) {
      return NextResponse.json({ error: "from must be before or equal to to" }, { status: 400 });
    }

    const agentIdFilter = req.nextUrl.searchParams.get("agent_id")?.trim() || null;
    const search = req.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";
    const limitRaw = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    const supabase = getSupabaseServerClient();
    let logsQuery = supabase
      .from("call_logs")
      .select("*")
      .gte("timestamp", from)
      .lte("timestamp", to)
      .not("user_id", "is", null)
      .not("twilio_recording_sid", "is", null)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (agentIdFilter) {
      logsQuery = logsQuery.eq("user_id", agentIdFilter);
    }

    const { data: logs, error: logsError } = await logsQuery;
    if (logsError) throw logsError;

    const agentIds = [...new Set((logs ?? []).map((row) => row.user_id as string))];
    const emailByUserId = new Map<string, string>();

    if (agentIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, email")
        .in("id", agentIds);
      if (usersError) throw usersError;
      for (const user of users ?? []) {
        emailByUserId.set(user.id as string, user.email as string);
      }
    }

    const leadNameByAgentPhone = new Map<string, string>();

    if (agentIds.length > 0) {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("phone, name, user_id")
        .in("user_id", agentIds);
      if (leadsError) throw leadsError;
      for (const lead of leads ?? []) {
        const key = `${lead.user_id as string}:${normalizePhone(lead.phone as string)}`;
        if (!key.endsWith(":") && !leadNameByAgentPhone.has(key)) {
          leadNameByAgentPhone.set(key, lead.name as string);
        }
      }
    }

    let recordings: SuperadminCallRecordingRow[] = (logs ?? []).map((row) => {
      const phone = row.phone as string;
      return {
        id: row.id as string,
        phone,
        did: row.did as string,
        direction: row.direction as SuperadminCallRecordingRow["direction"],
        result: row.result as SuperadminCallRecordingRow["result"],
        duration: row.duration as number | null,
        timestamp: row.timestamp as string,
        call_notes: (row.call_notes as string | null) ?? null,
        twilio_recording_sid: row.twilio_recording_sid as string,
        user_id: row.user_id as string,
        agent_email: emailByUserId.get(row.user_id as string) ?? "Unknown agent",
        lead_name: leadNameByAgentPhone.get(`${row.user_id as string}:${normalizePhone(phone)}`) ?? null,
      };
    });

    if (search) {
      recordings = recordings.filter((row) => {
        const haystack = [
          row.agent_email,
          row.lead_name,
          row.phone,
          row.did,
          row.direction,
          row.result,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    return NextResponse.json({ from, to, recordings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
