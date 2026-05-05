import { NextRequest, NextResponse } from "next/server";
import { getDashboardAnalytics } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
    }

    const dashboard = await getDashboardAnalytics(userId);
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
