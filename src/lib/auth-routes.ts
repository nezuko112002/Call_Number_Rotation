import type { UserRole } from "@/lib/user-role";

export const AGENT_HOME_PATH = "/";
export const SUPERADMIN_HOME_PATH = "/superadmin";

export function homePathForRole(role: UserRole | null | undefined): string {
  return role === "superadmin" ? SUPERADMIN_HOME_PATH : AGENT_HOME_PATH;
}
