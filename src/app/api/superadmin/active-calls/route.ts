import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { isConferenceCallsEnabled } from "@/lib/twilio-conference";
import { assertSuperadmin } from "@/lib/user-role";
import type { ActiveConferenceSessionRow } from "@/types";

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

    const supabase = getSupabaseServerClient();
    const { data: sessions, error: sessionsError } = await supabase
      .from("call_conference_sessions")
      .select("id, user_id, conference_name, direction, lead_phone, caller_id, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (sessionsError) throw sessionsError;

    const agentIds = [...new Set((sessions ?? []).map((row) => row.user_id as string))];
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

    const calls: ActiveConferenceSessionRow[] = (sessions ?? []).map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      agent_email: emailByUserId.get(row.user_id as string) ?? "Unknown agent",
      conference_name: row.conference_name as string,
      direction: row.direction as ActiveConferenceSessionRow["direction"],
      lead_phone: row.lead_phone as string,
      caller_id: row.caller_id as string,
      created_at: row.created_at as string,
    }));

    return NextResponse.json({
      conference_calls_enabled: isConferenceCallsEnabled(),
      calls,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
