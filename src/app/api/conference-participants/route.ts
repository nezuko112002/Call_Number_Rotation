import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizePhone } from "@/lib/utils";

function isDuplicatePhoneError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("duplicate") || lower.includes("unique");
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("conference_participants")
      .select("id, user_id, label, phone, sort_order, created_at, updated_at")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
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
    const userId = body?.user_id as string | undefined;
    const label = (body?.label as string | undefined)?.trim();
    const phone = (body?.phone as string | undefined)?.trim();

    if (!userId || !label || !phone) {
      return NextResponse.json({ error: "user_id, label, and phone are required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const digits = normalizedPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      return NextResponse.json({ error: "Enter a valid phone number with at least 10 digits." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: countError } = await supabase
      .from("conference_participants")
      .select("sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1);
    if (countError) throw countError;

    const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("conference_participants")
      .insert({
        user_id: userId,
        label,
        phone,
        normalized_phone: normalizedPhone,
        sort_order: nextSort,
        updated_at: now,
      })
      .select("id, user_id, label, phone, sort_order, created_at, updated_at")
      .single();
    if (error) {
      if (isDuplicatePhoneError(error.message)) {
        return NextResponse.json({ error: "That number is already in your list." }, { status: 409 });
      }
      throw error;
    }

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
    const userId = body?.user_id as string | undefined;
    const label = (body?.label as string | undefined)?.trim();
    const phone = (body?.phone as string | undefined)?.trim();

    if (!id || !userId) {
      return NextResponse.json({ error: "id and user_id are required" }, { status: 400 });
    }
    if (!label && !phone) {
      return NextResponse.json({ error: "label or phone is required" }, { status: 400 });
    }

    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    if (label) patch.label = label;
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      const digits = normalizedPhone.replace(/\D/g, "");
      if (digits.length < 10) {
        return NextResponse.json({ error: "Enter a valid phone number with at least 10 digits." }, { status: 400 });
      }
      patch.phone = phone;
      patch.normalized_phone = normalizedPhone;
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("conference_participants")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, user_id, label, phone, sort_order, created_at, updated_at")
      .single();
    if (error) {
      if (isDuplicatePhoneError(error.message)) {
        return NextResponse.json({ error: "Another saved contact already uses that number." }, { status: 409 });
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

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
    const userId = body?.user_id as string | undefined;

    if (!id || !userId) {
      return NextResponse.json({ error: "id and user_id are required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error, count } = await supabase
      .from("conference_participants")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;

    if (!count) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
