import { NextRequest, NextResponse } from "next/server";
import { classifyTag, type Segment, type SubSegment } from "@/app/lib/tags";

const API_KEY = process.env.CHANNEL_TALK_API_KEY!;
const API_SECRET = process.env.CHANNEL_TALK_API_SECRET!;
const BASE_URL = "https://api.channel.io/open/v5";

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const KST_OFFSET = 9 * 60 * 60 * 1000; // UTC+9

async function fetchChatsByState(
  state: string,
  sinceTs: number,
  maxPages: number = 30
): Promise<any[]> {
  const chats: any[] = [];
  let next: string | null = null;
  let pages = 0;

  while (pages < maxPages) {
    const params = new URLSearchParams({
      state,
      sortOrder: "desc",
      limit: "500",
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
      const ts = chat.openedAt || chat.createdAt || 0;
      if (ts >= sinceTs) {
        chats.push(chat);
      } else {
        reachedEnd = true;
      }
    }

    pages++;
    if (reachedEnd || batch.length < 500 || !nextCursor) break;
    next = nextCursor;
    await new Promise((r) => setTimeout(r, 300));
  }

  return chats;
}

// KST-based week: Wed 00:00 KST ~ Tue 23:59:59 KST
function getWeekStartKST(date: Date): Date {
  // Convert to KST
  const kstMs = date.getTime() + KST_OFFSET;
  const kst = new Date(kstMs);
  kst.setHours(0, 0, 0, 0);
  const day = kst.getDay(); // 0=Sun, 3=Wed
  const diff = day >= 3 ? day - 3 : day + 4;
  kst.setDate(kst.getDate() - diff);
  // Convert back to UTC
  return new Date(kst.getTime() - KST_OFFSET);
}

function getWeekEndKST(weekStartUTC: Date): Date {
  const d = new Date(weekStartUTC.getTime());
  d.setDate(d.getDate() + 7);
  d.setMilliseconds(-1);
  return d;
}

function toKSTDateStr(utcDate: Date): string {
  const kst = new Date(utcDate.getTime() + KST_OFFSET);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

interface SegmentData {
  total: number;
  subSegments: Record<string, number>;
  tags: { tag: string; count: number; subSegment: string }[];
}

function analyzeChats(chats: any[]) {
  const aiChats = chats.filter(
    (c) => !c.assigneeId && (!c.managerIds || c.managerIds.length === 0)
  );

  const segments: Record<string, { counts: Record<string, number>; tags: Record<string, { count: number; subSegment: string }> }> = {
    "케어드": { counts: { "판매": 0, "구매": 0, "기타": 0 }, tags: {} },
    "마켓": { counts: { "판매자": 0, "구매자": 0, "공통": 0 }, tags: {} },
  };

  for (const chat of chats) {
    const tags = chat.tags || [];
    for (const tag of tags) {
      const result = classifyTag(tag);
      if (!result) continue; // 미분류 제외
      const { segment, subSegment, mappedTag } = result;
      segments[segment].counts[subSegment] = (segments[segment].counts[subSegment] || 0) + 1;
      if (!segments[segment].tags[mappedTag]) {
        segments[segment].tags[mappedTag] = { count: 0, subSegment };
      }
      segments[segment].tags[mappedTag].count++;
    }
  }

  const buildSegmentData = (seg: string): SegmentData => {
    const s = segments[seg];
    const total = Object.values(s.counts).reduce((a, b) => a + b, 0);
    const tags = Object.entries(s.tags)
      .map(([tag, data]) => ({ tag, count: data.count, subSegment: data.subSegment }))
      .sort((a, b) => b.count - a.count);
    return { total, subSegments: s.counts, tags };
  };

  // Daily breakdown (KST dates)
  const dailyMap = new Map<string, { total: number; ai: number; human: number; cared: number; market: number }>();
  for (const chat of chats) {
    const ts = chat.openedAt || chat.createdAt;
    if (!ts) continue;
    const kstDate = new Date(ts + KST_OFFSET);
    const key = `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, "0")}-${String(kstDate.getDate()).padStart(2, "0")}`;
    const entry = dailyMap.get(key) || { total: 0, ai: 0, human: 0, cared: 0, market: 0 };
    entry.total++;
    const isAi = !chat.assigneeId && (!chat.managerIds || chat.managerIds.length === 0);
    if (isAi) entry.ai++;
    else entry.human++;
    const chatTags = chat.tags || [];
    let hasCared = false, hasMarket = false;
    for (const tag of chatTags) {
      const result = classifyTag(tag);
      if (!result) continue;
      if (result.segment === "케어드") hasCared = true;
      if (result.segment === "마켓") hasMarket = true;
    }
    if (hasCared) entry.cared++;
    if (hasMarket) entry.market++;
    dailyMap.set(key, entry);
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  const states = { closed: 0, opened: 0, snoozed: 0 };
  for (const chat of chats) {
    const state = chat.state as keyof typeof states;
    if (state in states) states[state]++;
  }

  return {
    total: chats.length,
    ai: { count: aiChats.length, ratio: chats.length > 0 ? Math.round((aiChats.length / chats.length) * 100) : 0 },
    human: { count: chats.length - aiChats.length, ratio: chats.length > 0 ? Math.round(((chats.length - aiChats.length) / chats.length) * 100) : 0 },
    cared: buildSegmentData("케어드"),
    market: buildSegmentData("마켓"),
    unclassifiedTags: [] as { tag: string; count: number }[],
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
  const thisWeekStartUTC = getWeekStartKST(now);
  const lastWeekStartUTC = new Date(thisWeekStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sinceTs: number;
  let untilTs: number;

  if (mode === "range" && from && to) {
    // from/to are in KST date strings, convert to UTC
    sinceTs = new Date(from + "T00:00:00+09:00").getTime();
    untilTs = new Date(to + "T23:59:59.999+09:00").getTime();
  } else {
    // 2 weeks: last Wed ~ this Tue (KST)
    sinceTs = lastWeekStartUTC.getTime();
    untilTs = getWeekEndKST(thisWeekStartUTC).getTime();
  }

  const cacheKey = `v3-${sinceTs}-${untilTs}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const [closed, opened, snoozed] = await Promise.all([
      fetchChatsByState("closed", sinceTs, 30),
      fetchChatsByState("opened", sinceTs, 15),
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

    // Filter by time range
    allChats = allChats.filter((chat) => {
      const ts = chat.openedAt || chat.createdAt || 0;
      return ts >= sinceTs && ts <= untilTs;
    });

    // Split weeks
    const thisWeekEndUTC = getWeekEndKST(thisWeekStartUTC);
    const lastWeekEndUTC = getWeekEndKST(lastWeekStartUTC);

    const thisWeekChats = allChats.filter((c) => {
      const ts = c.createdAt || c.openedAt || 0;
      return ts >= thisWeekStartUTC.getTime() && ts <= thisWeekEndUTC.getTime();
    });
    const lastWeekChats = allChats.filter((c) => {
      const ts = c.createdAt || c.openedAt || 0;
      return ts >= lastWeekStartUTC.getTime() && ts <= lastWeekEndUTC.getTime();
    });

    const thisWeekAnalysis = analyzeChats(thisWeekChats);
    const lastWeekAnalysis = analyzeChats(lastWeekChats);

    // Week comparison by day (Wed=0...Tue=6)
    const dayLabels = ["수", "목", "금", "토", "일", "월", "화"];
    const lastWeekDaily = new Array(7).fill(0);
    const thisWeekDaily = new Array(7).fill(0);
    for (const chat of lastWeekChats) {
      const ts = chat.openedAt || chat.createdAt;
      if (!ts) continue;
      const kstDay = new Date(ts + KST_OFFSET).getDay();
      const idx = kstDay >= 3 ? kstDay - 3 : kstDay + 4;
      lastWeekDaily[idx]++;
    }
    for (const chat of thisWeekChats) {
      const ts = chat.openedAt || chat.createdAt;
      if (!ts) continue;
      const kstDay = new Date(ts + KST_OFFSET).getDay();
      const idx = kstDay >= 3 ? kstDay - 3 : kstDay + 4;
      thisWeekDaily[idx]++;
    }

    const result = {
      mode,
      totalFetched: allChats.length,
      thisWeek: {
        ...thisWeekAnalysis,
        startDate: toKSTDateStr(thisWeekStartUTC),
        endDate: toKSTDateStr(thisWeekEndUTC),
      },
      lastWeek: {
        ...lastWeekAnalysis,
        startDate: toKSTDateStr(lastWeekStartUTC),
        endDate: toKSTDateStr(lastWeekEndUTC),
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
        from: toKSTDateStr(new Date(sinceTs)),
        to: toKSTDateStr(new Date(untilTs)),
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
