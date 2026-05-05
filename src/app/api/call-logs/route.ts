import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizePhone } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const [{ data: logs, error: logsError }, { data: leads, error: leadsError }] = await Promise.all([
      supabase.from("call_logs").select("*").order("timestamp", { ascending: false }),
      supabase.from("leads").select("name, phone").order("created_at", { ascending: false }),
    ]);
    if (logsError) throw logsError;
    if (leadsError) throw leadsError;

    const nameByPhone = new Map<string, string>();
    for (const lead of leads ?? []) {
      const key = normalizePhone(lead.phone);
      if (!key || nameByPhone.has(key)) continue;
      nameByPhone.set(key, lead.name);
    }

    const logsWithLeadName = (logs ?? []).map((log) => ({
      ...log,
      lead_name: nameByPhone.get(normalizePhone(log.phone)) ?? null,
    }));

    return NextResponse.json(logsWithLeadName);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
