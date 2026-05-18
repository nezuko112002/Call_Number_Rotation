import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { assertSuperadmin } from "@/lib/user-role";
import type { AgentDialStatsRow, CallLogRecord } from "@/types";

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

    const supabase = getSupabaseServerClient();
    let logsQuery = supabase
      .from("call_logs")
      .select("user_id, result")
      .eq("direction", "outbound")
      .gte("timestamp", from)
      .lte("timestamp", to)
      .not("user_id", "is", null);

    if (agentIdFilter) {
      logsQuery = logsQuery.eq("user_id", agentIdFilter);
    }

    const { data: logs, error: logsError } = await logsQuery;
    if (logsError) throw logsError;

    const counts = new Map<string, { dial_count: number; answered_count: number }>();
    for (const row of logs ?? []) {
      const uid = row.user_id as string;
      if (!uid) continue;
      const entry = counts.get(uid) ?? { dial_count: 0, answered_count: 0 };
      entry.dial_count += 1;
      if ((row.result as CallLogRecord["result"]) === "answered") {
        entry.answered_count += 1;
      }
      counts.set(uid, entry);
    }

    const { data: agentUsers, error: agentUsersError } = await supabase
      .from("users")
      .select("id, email")
      .in("role", ["agent", "admin"])
      .order("email", { ascending: true });
    if (agentUsersError) throw agentUsersError;

    const agents: AgentDialStatsRow[] = (agentUsers ?? [])
      .filter((user) => !agentIdFilter || user.id === agentIdFilter)
      .map((user) => {
        const user_id = user.id as string;
        const stats = counts.get(user_id) ?? { dial_count: 0, answered_count: 0 };
        return {
          user_id,
          email: user.email as string,
          dial_count: stats.dial_count,
          answered_count: stats.answered_count,
        };
      })
      .sort((a, b) => b.dial_count - a.dial_count || a.email.localeCompare(b.email));

    const total_dials = agents.reduce((sum, row) => sum + row.dial_count, 0);

    return NextResponse.json({
      from,
      to,
      agents,
      total_dials,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
