import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { UserRole } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; email?: string; role?: UserRole };
    const id = body?.id?.trim();
    const email = body?.email?.trim().toLowerCase();
    const requestedRole = body?.role;

    if (!id || !email) {
      return NextResponse.json({ error: "id and email are required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const { data, error } = await supabase
        .from("users")
        .update({ email })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("users")
      .insert({
        id,
        email,
        role: requestedRole ?? "agent",
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
