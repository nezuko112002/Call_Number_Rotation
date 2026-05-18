import { getSupabaseServerClient } from "@/lib/supabase";

export type UserRole = "agent" | "admin" | "superadmin";

export interface AppUserRecord {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.role) return null;
  return data.role as UserRole;
}

export async function assertSuperadmin(userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const role = await getUserRole(userId);
  if (!role) {
    return { ok: false, status: 403, error: "User profile not found." };
  }
  if (role !== "superadmin") {
    return { ok: false, status: 403, error: "Superadmin access required." };
  }
  return { ok: true };
}
