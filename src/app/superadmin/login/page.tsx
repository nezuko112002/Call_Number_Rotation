import { redirect } from "next/navigation";

/** Dedicated entry for the superadmin console (same auth, separate portal). */
export default function SuperadminLoginPage() {
  redirect("/login?portal=superadmin");
}
