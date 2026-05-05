import { NextRequest, NextResponse } from "next/server";
import { selectBestDid } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leadPhone = body?.leadPhone as string | undefined;
    const userId = body?.user_id as string | undefined;

    if (!leadPhone || !userId) {
      return NextResponse.json({ error: "leadPhone and user_id are required" }, { status: 400 });
    }

    const { bestDid, leadAreaCode } = await selectBestDid(leadPhone, userId);

    if (!bestDid) {
      return NextResponse.json({ error: "No available DID found" }, { status: 404 });
    }

    return NextResponse.json({
      leadAreaCode,
      did: bestDid.did,
      didRecord: bestDid,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
