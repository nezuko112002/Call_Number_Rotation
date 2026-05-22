import { redirect } from "next/navigation";

/** Legacy route — recordings library lives at /superadmin/recordings. */
export default function SuperadminCallHistoryRedirect() {
  redirect("/superadmin/recordings");
}
