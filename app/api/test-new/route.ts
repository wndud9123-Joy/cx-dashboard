import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  return NextResponse.json({
    success: "NEW API WORKS!",
    mode: mode,
    from: from,
    to: to,
    timestamp: new Date().toISOString(),
    test: mode === "range" && from && to ? "USER DATE MODE" : "DEFAULT MODE"
  });
}