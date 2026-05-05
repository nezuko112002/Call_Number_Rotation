import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { extractAreaCode } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("did_pool").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const didRaw = body?.did as string | undefined;
    const areaCodeRaw = body?.area_code as string | undefined;
    const did = didRaw?.trim();
    const areaCode = areaCodeRaw?.trim() || (did ? extractAreaCode(did) : "");

    if (!did || !areaCode) {
      return NextResponse.json({ error: "did and area_code are required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("did_pool")
      .insert({
        did,
        area_code: areaCode,
        status: "active",
        calls_today: 0,
        total_calls: 0,
        answer_rate: 0,
        spam_score: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id as string | undefined;
    const status = body?.status as string | undefined;

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("did_pool").update({ status }).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id as string | undefined;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: didRecord, error: didError } = await supabase
      .from("did_pool")
      .select("id, did")
      .eq("id", id)
      .single();
    if (didError) throw didError;

    const { count: usageCount, error: usageError } = await supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("did", didRecord.did);
    if (usageError) throw usageError;

    if ((usageCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "This DID has call history and cannot be deleted. Set it to cooldown or retired instead." },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("did_pool").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
