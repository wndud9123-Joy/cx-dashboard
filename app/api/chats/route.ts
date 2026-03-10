import { NextRequest, NextResponse } from "next/server";
import { classifyTag, type Segment, type SubSegment } from "@/app/lib/tags";

const API_KEY = process.env.CHANNEL_TALK_API_KEY!;
const API_SECRET = process.env.CHANNEL_TALK_API_SECRET!;
const BASE_URL = "https://api.channel.io/open/v5";

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchChatsByState(
  state: string,
  sinceTs: number,
  maxPages: number = 100
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
        const retryAfter = parseInt(res.headers.get("retry-after") || "3", 10);
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

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day >= 3 ? day - 3 : day + 4;
  d.setDate(d.getDate() - diff);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

interface SegmentData {
  total: number;
  subSegments: Record<string, number>;
  tags: { tag: string; count: number; subSegment: string }[];
}

function analyzeChats(chats: any[]) {
  // AI vs Human
  const aiChats = chats.filter(
    (c) => !c.assigneeId && (!c.managerIds || c.managerIds.length === 0)
  );

  // Segment analysis
  const segments: Record<Segment, { counts: Record<SubSegment, number>; tags: Record<string, { count: number; subSegment: string }> }> = {
    "케어드": { counts: { "판매": 0, "구매": 0, "기타": 0, "판매자": 0, "구매자": 0, "공통": 0 }, tags: {} },
    "마켓": { counts: { "판매": 0, "구매": 0, "기타": 0, "판매자": 0, "구매자": 0, "공통": 0 }, tags: {} },
    "미분류": { counts: { "판매": 0, "구매": 0, "기타": 0, "판매자": 0, "구매자": 0, "공통": 0 }, tags: {} },
  };

  const unclassifiedTags = new Map<string, number>();

  for (const chat of chats) {
    const tags = chat.tags || [];
    for (const tag of tags) {
      const { segment, subSegment } = classifyTag(tag);

      if (segment === "미분류") {
        unclassifiedTags.set(tag, (unclassifiedTags.get(tag) || 0) + 1);
        continue;
      }

      segments[segment].counts[subSegment]++;
      if (!segments[segment].tags[tag]) {
        segments[segment].tags[tag] = { count: 0, subSegment };
      }
      segments[segment].tags[tag].count++;
    }
  }

  // Build segment data
  const buildSegmentData = (seg: Segment, subKeys: SubSegment[]): SegmentData => {
    const s = segments[seg];
    const subSegments: Record<string, number> = {};
    for (const k of subKeys) {
      subSegments[k] = s.counts[k];
    }
    const total = Object.values(subSegments).reduce((a, b) => a + b, 0);
    const tags = Object.entries(s.tags)
      .map(([tag, data]) => ({ tag, count: data.count, subSegment: data.subSegment }))
      .sort((a, b) => b.count - a.count);
    return { total, subSegments, tags };
  };

  // Daily breakdown
  const dailyMap = new Map<string, { total: number; ai: number; human: number; cared: number; market: number }>();
  for (const chat of chats) {
    const ts = chat.createdAt || chat.openedAt;
    if (!ts) continue;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = dailyMap.get(key) || { total: 0, ai: 0, human: 0, cared: 0, market: 0 };
    entry.total++;
    const isAi = !chat.assigneeId && (!chat.managerIds || chat.managerIds.length === 0);
    if (isAi) entry.ai++;
    else entry.human++;

    // Classify chat by its tags
    const chatTags = chat.tags || [];
    let hasCared = false, hasMarket = false;
    for (const tag of chatTags) {
      const { segment } = classifyTag(tag);
      if (segment === "케어드") hasCared = true;
      if (segment === "마켓") hasMarket = true;
    }
    if (hasCared) entry.cared++;
    if (hasMarket) entry.market++;
    dailyMap.set(key, entry);
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  // State breakdown
  const states = { closed: 0, opened: 0, snoozed: 0 };
  for (const chat of chats) {
    const state = chat.state as keyof typeof states;
    if (state in states) states[state]++;
  }

  return {
    total: chats.length,
    ai: { count: aiChats.length, ratio: chats.length > 0 ? Math.round((aiChats.length / chats.length) * 100) : 0 },
    human: { count: chats.length - aiChats.length, ratio: chats.length > 0 ? Math.round(((chats.length - aiChats.length) / chats.length) * 100) : 0 },
    cared: buildSegmentData("케어드", ["판매", "구매", "기타"]),
    market: buildSegmentData("마켓", ["판매자", "구매자", "공통"]),
    unclassifiedTags: Array.from(unclassifiedTags.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    daily,
    states,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "compare";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const now = new Date();
  const thisWeekStart = getWeekStart(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let sinceTs: number;
  let untilTs: number;

  if (mode === "range" && from && to) {
    sinceTs = new Date(from).getTime();
    untilTs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
  } else {
    sinceTs = lastWeekStart.getTime();
    untilTs = getWeekEnd(thisWeekStart).getTime();
  }

  const cacheKey = `v2-${mode}-${sinceTs}-${untilTs}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const [closed, opened, snoozed] = await Promise.all([
      fetchChatsByState("closed", sinceTs, 100),
      fetchChatsByState("opened", sinceTs, 40),
      fetchChatsByState("snoozed", sinceTs, 10),
    ]);

    let allChats = [...closed, ...opened, ...snoozed];

    // Deduplicate
    const seen = new Set<string>();
    allChats = allChats.filter((chat) => {
      if (seen.has(chat.id)) return false;
      seen.add(chat.id);
      return true;
    });

    // Filter by time range
    allChats = allChats.filter((chat) => {
      const ts = chat.createdAt || chat.openedAt || 0;
      return ts >= sinceTs && ts <= untilTs;
    });

    // Split weeks
    const thisWeekEnd = getWeekEnd(thisWeekStart);
    const lastWeekEnd = getWeekEnd(lastWeekStart);

    const thisWeekChats = allChats.filter((c) => {
      const ts = c.createdAt || c.openedAt || 0;
      return ts >= thisWeekStart.getTime() && ts <= thisWeekEnd.getTime();
    });
    const lastWeekChats = allChats.filter((c) => {
      const ts = c.createdAt || c.openedAt || 0;
      return ts >= lastWeekStart.getTime() && ts <= lastWeekEnd.getTime();
    });

    const displayChats = mode === "range" ? allChats : thisWeekChats;
    const thisWeekAnalysis = analyzeChats(thisWeekChats);
    const lastWeekAnalysis = analyzeChats(lastWeekChats);

    // Week comparison by day (Wed=0...Tue=6)
    const dayLabels = ["수", "목", "금", "토", "일", "월", "화"];
    const lastWeekDaily = new Array(7).fill(0);
    const thisWeekDaily = new Array(7).fill(0);
    for (const chat of lastWeekChats) {
      const ts = chat.createdAt || chat.openedAt;
      if (!ts) continue;
      const day = new Date(ts).getDay();
      const idx = day >= 3 ? day - 3 : day + 4;
      lastWeekDaily[idx]++;
    }
    for (const chat of thisWeekChats) {
      const ts = chat.createdAt || chat.openedAt;
      if (!ts) continue;
      const day = new Date(ts).getDay();
      const idx = day >= 3 ? day - 3 : day + 4;
      thisWeekDaily[idx]++;
    }

    const result = {
      mode,
      totalFetched: allChats.length,
      thisWeek: {
        ...thisWeekAnalysis,
        startDate: thisWeekStart.toISOString().split("T")[0],
        endDate: thisWeekEnd.toISOString().split("T")[0],
      },
      lastWeek: {
        ...lastWeekAnalysis,
        startDate: lastWeekStart.toISOString().split("T")[0],
        endDate: lastWeekEnd.toISOString().split("T")[0],
      },
      comparison: {
        labels: dayLabels,
        lastWeekDaily,
        thisWeekDaily,
        changeRate: lastWeekAnalysis.total > 0
          ? Math.round(((thisWeekAnalysis.total - lastWeekAnalysis.total) / lastWeekAnalysis.total) * 100)
          : thisWeekAnalysis.total > 0 ? 100 : 0,
        caredChange: lastWeekAnalysis.cared.total > 0
          ? Math.round(((thisWeekAnalysis.cared.total - lastWeekAnalysis.cared.total) / lastWeekAnalysis.cared.total) * 100)
          : 0,
        marketChange: lastWeekAnalysis.market.total > 0
          ? Math.round(((thisWeekAnalysis.market.total - lastWeekAnalysis.market.total) / lastWeekAnalysis.market.total) * 100)
          : 0,
      },
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
