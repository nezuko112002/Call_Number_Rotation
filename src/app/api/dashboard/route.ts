import { NextResponse } from "next/server";
import { getDashboardAnalytics } from "@/lib/db";

export async function GET() {
  try {
    const dashboard = await getDashboardAnalytics();
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
