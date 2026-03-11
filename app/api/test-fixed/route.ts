import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    period: {
      thisWeek: { from: "2026-03-04", to: "2026-03-10" },
      lastWeek: { from: "2026-02-25", to: "2026-03-03" }
    },
    daily: {
      today: { total: 85, ai: 41, cared: 72, market: 13, date: "2026-03-11" },
      yesterday: { total: 67, ai: 29, cared: 58, market: 9, date: "2026-03-10" }
    },
    message: "고정 기간 테스트 API"
  });
}