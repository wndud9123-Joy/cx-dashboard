import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.CHANNEL_TALK_API_KEY!;
const BASE_URL = "https://api.channel.io/open/v5";

interface ChatCount {
  date: string;
  count: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "daily"; // daily, weekly, monthly
  const days = period === "monthly" ? 365 : period === "weekly" ? 90 : 30;

  try {
    // Fetch user chats from Channel Talk API
    const since = new Date();
    since.setDate(since.getDate() - days);

    let allChats: any[] = [];
    let after: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        state: "closed",
        sortOrder: "desc",
        limit: "50",
        since: since.getTime().toString(),
      });
      if (after) params.set("after", after);

      const res = await fetch(`${BASE_URL}/user-chats?${params}`, {
        headers: {
          "x-access-key": API_KEY,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Channel Talk API error:", res.status, errorText);
        return NextResponse.json(
          { error: `Channel Talk API error: ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const chats = data.userChats || [];
      allChats = allChats.concat(chats);

      if (chats.length < 50) {
        hasMore = false;
      } else {
        after = chats[chats.length - 1]?.id;
      }
    }

    // Also fetch open/snoozed chats
    for (const state of ["opened", "snoozed"]) {
      let stateAfter: string | null = null;
      let stateHasMore = true;

      while (stateHasMore) {
        const params = new URLSearchParams({
          state,
          sortOrder: "desc",
          limit: "50",
          since: since.getTime().toString(),
        });
        if (stateAfter) params.set("after", stateAfter);

        const res = await fetch(`${BASE_URL}/user-chats?${params}`, {
          headers: {
            "x-access-key": API_KEY,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          const chats = data.userChats || [];
          allChats = allChats.concat(chats);
          if (chats.length < 50) {
            stateHasMore = false;
          } else {
            stateAfter = chats[chats.length - 1]?.id;
          }
        } else {
          stateHasMore = false;
        }
      }
    }

    // Group by date
    const counts = groupByPeriod(allChats, period);

    return NextResponse.json({
      period,
      total: allChats.length,
      data: counts,
    });
  } catch (error: any) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

function groupByPeriod(chats: any[], period: string): ChatCount[] {
  const map = new Map<string, number>();

  for (const chat of chats) {
    const createdAt = chat.createdAt || chat.openedAt;
    if (!createdAt) continue;

    const date = new Date(createdAt);
    let key: string;

    if (period === "monthly") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    } else if (period === "weekly") {
      // Get Monday of the week
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    map.set(key, (map.get(key) || 0) + 1);
  }

  // Sort by date and fill gaps
  const sorted = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return sorted;
}
