import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.CHANNEL_TALK_API_KEY!;
const API_SECRET = process.env.CHANNEL_TALK_API_SECRET!;
const BASE_URL = "https://api.channel.io/open/v5";

interface ChatCount {
  date: string;
  count: number;
}

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

    const res = await fetch(`${BASE_URL}/user-chats?${params}`, {
      headers: {
        "x-access-key": API_KEY,
        "x-access-secret": API_SECRET,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) break;

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
  }

  return chats;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "daily";
  const days = period === "monthly" ? 365 : period === "weekly" ? 90 : 30;
  const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;

  // Check cache
  const cacheKey = `${period}-${Math.floor(sinceTs / CACHE_TTL)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch all states in parallel
    const [closed, opened, snoozed] = await Promise.all([
      fetchChatsByState("closed", sinceTs),
      fetchChatsByState("opened", sinceTs, 5),
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

    const counts = groupByPeriod(allChats, period);
    const result = { period, total: allChats.length, data: counts };

    // Cache result
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

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
