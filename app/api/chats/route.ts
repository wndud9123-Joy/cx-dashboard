import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.CHANNEL_TALK_API_KEY!;
const API_SECRET = process.env.CHANNEL_TALK_API_SECRET!;
const BASE_URL = "https://api.channel.io/open/v5";

// In-memory cache (5 min TTL)
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchChatsByState(
  state: string,
  sinceTs: number,
  maxPages: number = 20
): Promise<any[]> {
  const chats: any[] = [];
  let next: string | null = null;
  let pages = 0;

  while (pages < maxPages) {
    const params = new URLSearchParams({
      state,
      sortOrder: "desc",
      limit: "50",
    });
    if (next) params.set("next", next);

    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`${BASE_URL}/user-chats?${params}`, {
        headers: {
          "x-access-key": API_KEY,
          "x-access-secret": API_SECRET,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "2", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      break;
    }

    if (!res || !res.ok) break;

    const data = await res.json();
    const batch = data.userChats || [];
    const nextCursor = data.next || null;

    let reachedEnd = false;
    for (const chat of batch) {
      const ts = chat.createdAt || chat.openedAt || 0;
      if (ts >= sinceTs) {
        chats.push(chat);
      } else {
        reachedEnd = true;
      }
    }

    pages++;
    if (reachedEnd || batch.length < 50 || !nextCursor) break;
    next = nextCursor;
    await new Promise((r) => setTimeout(r, 200));
  }

  return chats;
}

// Get Wednesday-based week start (previous Wednesday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 3=Wed
  const diff = day >= 3 ? day - 3 : day + 4; // days since last Wednesday
  d.setDate(d.getDate() - diff);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  d.setMilliseconds(-1);
  return d;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "weekly"; // weekly, range, compare
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to"); // YYYY-MM-DD

  let sinceTs: number;
  let untilTs: number = Date.now();
  let compareFrom: number | null = null;
  let compareUntil: number | null = null;

  const now = new Date();

  if (mode === "compare") {
    // This week (Wed~Tue) vs Last week (Wed~Tue)
    const thisWeekStart = getWeekStart(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    sinceTs = lastWeekStart.getTime();
    untilTs = getWeekEnd(thisWeekStart).getTime();
    compareFrom = lastWeekStart.getTime();
    compareUntil = thisWeekStart.getTime() - 1;
  } else if (mode === "range" && from && to) {
    sinceTs = new Date(from).getTime();
    untilTs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
  } else {
    // Default: this week (Wed~Tue)
    const weekStart = getWeekStart(now);
    sinceTs = weekStart.getTime();
    untilTs = getWeekEnd(weekStart).getTime();
  }

  // Cache key
  const cacheKey = `${mode}-${sinceTs}-${untilTs}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const [closed, opened, snoozed] = await Promise.all([
      fetchChatsByState("closed", sinceTs),
      fetchChatsByState("opened", sinceTs, 10),
      fetchChatsByState("snoozed", sinceTs, 5),
    ]);

    let allChats = [...closed, ...opened, ...snoozed];

    // Deduplicate
    const seen = new Set<string>();
    allChats = allChats.filter((chat) => {
      if (seen.has(chat.id)) return false;
      seen.add(chat.id);
      return true;
    });

    // Filter by untilTs
    allChats = allChats.filter((chat) => {
      const ts = chat.createdAt || chat.openedAt || 0;
      return ts >= sinceTs && ts <= untilTs;
    });

    // AI vs Human classification
    // No assigneeId or empty managerIds = AI bot
    const aiChats = allChats.filter(
      (chat) => !chat.assigneeId && (!chat.managerIds || chat.managerIds.length === 0)
    );
    const humanChats = allChats.filter(
      (chat) => chat.assigneeId || (chat.managerIds && chat.managerIds.length > 0)
    );

    // Tag breakdown
    const tagMap = new Map<string, number>();
    for (const chat of allChats) {
      const tags = chat.tags || [];
      if (tags.length === 0) {
        tagMap.set("태그없음", (tagMap.get("태그없음") || 0) + 1);
      } else {
        for (const tag of tags) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }
      }
    }
    const tagBreakdown = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    // Daily breakdown
    const dailyMap = new Map<string, { total: number; ai: number; human: number }>();
    for (const chat of allChats) {
      const ts = chat.createdAt || chat.openedAt;
      if (!ts) continue;
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const entry = dailyMap.get(key) || { total: 0, ai: 0, human: 0 };
      entry.total++;
      const isAi = !chat.assigneeId && (!chat.managerIds || chat.managerIds.length === 0);
      if (isAi) entry.ai++;
      else entry.human++;
      dailyMap.set(key, entry);
    }
    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // State breakdown
    const stateMap = { closed: 0, opened: 0, snoozed: 0 };
    for (const chat of allChats) {
      const state = chat.state as keyof typeof stateMap;
      if (state in stateMap) stateMap[state]++;
    }

    // Week comparison data
    let comparison = null;
    if (mode === "compare" && compareFrom !== null && compareUntil !== null) {
      const thisWeekStart = getWeekStart(now);
      const thisWeekEnd = getWeekEnd(thisWeekStart);

      const lastWeekChats = allChats.filter((c) => {
        const ts = c.createdAt || c.openedAt || 0;
        return ts >= compareFrom! && ts <= compareUntil!;
      });
      const thisWeekChats = allChats.filter((c) => {
        const ts = c.createdAt || c.openedAt || 0;
        return ts >= thisWeekStart.getTime() && ts <= thisWeekEnd.getTime();
      });

      // Daily breakdown for each week (Wed=0, Thu=1, ..., Tue=6)
      const dayLabels = ["수", "목", "금", "토", "일", "월", "화"];
      const lastWeekDaily = new Array(7).fill(0);
      const thisWeekDaily = new Array(7).fill(0);

      for (const chat of lastWeekChats) {
        const ts = chat.createdAt || chat.openedAt;
        if (!ts) continue;
        const d = new Date(ts);
        const day = d.getDay();
        const idx = day >= 3 ? day - 3 : day + 4;
        lastWeekDaily[idx]++;
      }
      for (const chat of thisWeekChats) {
        const ts = chat.createdAt || chat.openedAt;
        if (!ts) continue;
        const d = new Date(ts);
        const day = d.getDay();
        const idx = day >= 3 ? day - 3 : day + 4;
        thisWeekDaily[idx]++;
      }

      comparison = {
        labels: dayLabels,
        lastWeek: {
          total: lastWeekChats.length,
          daily: lastWeekDaily,
          startDate: new Date(compareFrom).toISOString().split("T")[0],
        },
        thisWeek: {
          total: thisWeekChats.length,
          daily: thisWeekDaily,
          startDate: thisWeekStart.toISOString().split("T")[0],
        },
      };
    }

    const result = {
      mode,
      total: allChats.length,
      ai: { count: aiChats.length, ratio: allChats.length > 0 ? Math.round((aiChats.length / allChats.length) * 100) : 0 },
      human: { count: humanChats.length, ratio: allChats.length > 0 ? Math.round((humanChats.length / allChats.length) * 100) : 0 },
      states: stateMap,
      tags: tagBreakdown,
      daily,
      comparison,
      period: {
        from: new Date(sinceTs).toISOString().split("T")[0],
        to: new Date(untilTs).toISOString().split("T")[0],
      },
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chats" },
      { status: 500 }
    );
  }
}
