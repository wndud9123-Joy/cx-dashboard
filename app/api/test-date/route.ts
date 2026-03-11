import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "default";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  return NextResponse.json({
    message: "새로운 엔드포인트 테스트",
    mode,
    from,
    to,
    timestamp: new Date().toISOString()
  });
}