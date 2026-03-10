import { NextRequest, NextResponse } from "next/server";
import { classifyTag } from "@/app/lib/tags";

const API_KEY = process.env.CHANNEL_TALK_API_KEY!;
const API_SECRET = process.env.CHANNEL_TALK_API_SECRET!;
const BASE_URL = "https://api.channel.io/open/v5";

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const KST_OFFSET = 9 * 60 * 60 * 1000;

async function fetchChatsByState(state: string, sinceTs: number, maxPages = 30): Promise<any[]> {
  const chats: any[] = [];
  let next: string | null = null;
  let pages = 0;

  while (pages < maxPages) {
    const params = new URLSearchParams({ state, sortOrder: "desc", limit: "500" });
    if (next) params.set("next", next);

    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`${BASE_URL}/user-chats?${params}`, {
        headers: { "x-access-key": API_KEY, "x-access-secret": API_SECRET, "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, parseInt(res!.headers.get("retry-after") || "3", 10) * 1000));
        continue;
      }
      break;
    }
    if (!res || !res.ok) break;

    const data = await res.json();
    const batch = data.userChats || [];
    const nextCursor = data.next || null;

    let oldDataCount = 0;
    for (const chat of batch) {
      const ts = chat.openedAt || chat.createdAt || 0;
      if (ts >= sinceTs) {
        chats.push(chat);
      } else {
        oldDataCount++; // 오래된 데이터 카운트
      }
    }
    // 배치의 90% 이상이 오래된 데이터면 종료 (더 관대한 조건)
    const reachedEnd = oldDataCount > (batch.length * 0.9);

    pages++;
    if (reachedEnd || batch.length < 500 || !nextCursor) break;
    next = nextCursor;
    await new Promise((r) => setTimeout(r, 300));
  }
  return chats;
}

function getWeekStartKST(date: Date): Date {
  const kstMs = date.getTime() + KST_OFFSET;
  const kst = new Date(kstMs);
  kst.setHours(0, 0, 0, 0);
  const day = kst.getDay();
  const diff = day >= 3 ? day - 3 : day + 4;
  kst.setDate(kst.getDate() - diff);
  return new Date(kst.getTime() - KST_OFFSET);
}

function getWeekEndKST(weekStartUTC: Date): Date {
  const d = new Date(weekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return d;
}

function toKSTDateStr(utcDate: Date): string {
  const kst = new Date(utcDate.getTime() + KST_OFFSET);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function isAiChat(chat: any): boolean {
  return !chat.assigneeId && (!chat.managerIds || chat.managerIds.length === 0);
}

interface TagStat {
  tag: string;
  subSegment: string;
  thisWeek: number;
  lastWeek: number;
  change: number;
  aiCount: number;
  aiRatio: number;
}

function analyzeSegment(
  thisWeekChats: any[],
  lastWeekChats: any[],
  segmentName: string,
  subKeys: string[],
) {
  // Count tags for this week & last week
  const thisTagMap = new Map<string, { count: number; ai: number; subSegment: string }>();
  const lastTagMap = new Map<string, { count: number; ai: number; subSegment: string }>();
  const thisSub: Record<string, number> = {};
  const lastSub: Record<string, number> = {};
  subKeys.forEach((k) => { thisSub[k] = 0; lastSub[k] = 0; });

  let thisAi = 0, lastAi = 0;

  for (const chat of thisWeekChats) {
    const ai = isAiChat(chat);
    if (ai) thisAi++;
    for (const tag of (chat.tags || [])) {
      const result = classifyTag(tag);
      if (!result || result.segment !== segmentName) continue;
      const { subSegment, mappedTag } = result;
      thisSub[subSegment] = (thisSub[subSegment] || 0) + 1;
      const entry = thisTagMap.get(mappedTag) || { count: 0, ai: 0, subSegment };
      entry.count++;
      if (ai) entry.ai++;
      thisTagMap.set(mappedTag, entry);
    }
  }

  for (const chat of lastWeekChats) {
    if (isAiChat(chat)) lastAi++;
    for (const tag of (chat.tags || [])) {
      const result = classifyTag(tag);
      if (!result || result.segment !== segmentName) continue;
      const { subSegment, mappedTag } = result;
      lastSub[subSegment] = (lastSub[subSegment] || 0) + 1;
      const entry = lastTagMap.get(mappedTag) || { count: 0, ai: 0, subSegment };
      entry.count++;
      if (isAiChat(chat)) entry.ai++;
      lastTagMap.set(mappedTag, entry);
    }
  }

  // Merge all tags
  const allTags = new Set([...thisTagMap.keys(), ...lastTagMap.keys()]);
  const tagStats: TagStat[] = [];
  for (const tag of allTags) {
    const tw = thisTagMap.get(tag);
    const lw = lastTagMap.get(tag);
    const thisCount = tw?.count || 0;
    const lastCount = lw?.count || 0;
    const change = lastCount > 0 ? Math.round(((thisCount - lastCount) / lastCount) * 100) : (thisCount > 0 ? 100 : 0);
    tagStats.push({
      tag,
      subSegment: tw?.subSegment || lw?.subSegment || "기타",
      thisWeek: thisCount,
      lastWeek: lastCount,
      change,
      aiCount: tw?.ai || 0,
      aiRatio: thisCount > 0 ? Math.round(((tw?.ai || 0) / thisCount) * 100) : 0,
    });
  }

  // Sort by this week count, top 10
  tagStats.sort((a, b) => b.thisWeek - a.thisWeek);
  const top10 = tagStats.slice(0, 10);

  // AI top tags (sorted by AI count)
  const aiTopTags = [...tagStats].sort((a, b) => b.aiCount - a.aiCount).slice(0, 10);

  const thisTotal = Object.values(thisSub).reduce((a, b) => a + b, 0);
  const lastTotal = Object.values(lastSub).reduce((a, b) => a + b, 0);

  return {
    thisWeek: { total: thisTotal, subSegments: thisSub, ai: thisAi, aiRatio: thisWeekChats.length > 0 ? Math.round((thisAi / thisWeekChats.length) * 100) : 0 },
    lastWeek: { total: lastTotal, subSegments: lastSub, ai: lastAi, aiRatio: lastWeekChats.length > 0 ? Math.round((lastAi / lastWeekChats.length) * 100) : 0 },
    change: lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : (thisTotal > 0 ? 100 : 0),
    top10,
    aiTopTags,
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
    sinceTs = new Date(from + "T00:00:00+09:00").getTime();
    untilTs = new Date(to + "T23:59:59.999+09:00").getTime();
  } else {
    // 지난주 시작부터 수집 (더 정확한 범위)
    sinceTs = lastWeekStartUTC.getTime();
    untilTs = getWeekEndKST(thisWeekStartUTC).getTime();
  }

  const cacheKey = `v6-${sinceTs}-${untilTs}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const [closed, opened, snoozed] = await Promise.all([
      fetchChatsByState("closed", sinceTs, 500), // 최대한 증가: 250,000건
      fetchChatsByState("opened", sinceTs, 200), // 최대한 증가: 100,000건
      fetchChatsByState("snoozed", sinceTs, 100), // 최대한 증가: 50,000건
    ]);

    let allChats = [...closed, ...opened, ...snoozed];
    const seen = new Set<string>();
    allChats = allChats.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      const ts = c.openedAt || c.createdAt || 0;
      return ts >= sinceTs && ts <= untilTs;
    });

    const thisWeekEnd = getWeekEndKST(thisWeekStartUTC);
    const lastWeekEnd = getWeekEndKST(lastWeekStartUTC);

    const thisWeekChats = allChats.filter((c) => {
      const ts = c.openedAt || c.createdAt || 0;
      return ts >= thisWeekStartUTC.getTime() && ts <= thisWeekEnd.getTime();
    });
    const lastWeekChats = allChats.filter((c) => {
      const ts = c.openedAt || c.createdAt || 0;
      return ts >= lastWeekStartUTC.getTime() && ts <= lastWeekEnd.getTime();
    });

    // 임시 디버깅: 수집 현황 확인
    const collectDebug = {
      fetchCounts: {
        closed: closed.length,
        opened: opened.length, 
        snoozed: snoozed.length,
        total: allChats.length
      },
      dateRange: {
        sinceTs: new Date(sinceTs).toISOString(),
        untilTs: new Date(untilTs).toISOString(),
        lastWeekStart: lastWeekStartUTC.toISOString(),
        lastWeekEnd: lastWeekEnd.toISOString()
      },
      filterResults: {
        thisWeek: thisWeekChats.length,
        lastWeek: lastWeekChats.length
      }
    };



    // Overall
    const thisAiTotal = thisWeekChats.filter(isAiChat).length;
    const lastAiTotal = lastWeekChats.filter(isAiChat).length;
    const totalChange = lastWeekChats.length > 0
      ? Math.round(((thisWeekChats.length - lastWeekChats.length) / lastWeekChats.length) * 100) : 0;
    const aiChange = lastAiTotal > 0
      ? Math.round(((thisAiTotal - lastAiTotal) / lastAiTotal) * 100) : 0;

    // AI top tags across all segments
    const aiTagMap = new Map<string, number>();
    for (const chat of thisWeekChats) {
      if (!isAiChat(chat)) continue;
      for (const tag of (chat.tags || [])) {
        const result = classifyTag(tag);
        if (!result) continue;
        aiTagMap.set(result.mappedTag, (aiTagMap.get(result.mappedTag) || 0) + 1);
      }
    }
    const aiTopAll = Array.from(aiTagMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Segments
    const cared = analyzeSegment(thisWeekChats, lastWeekChats, "케어드", ["판매", "구매", "기타"]);
    const market = analyzeSegment(thisWeekChats, lastWeekChats, "마켓", ["판매자", "구매자", "공통"]);

    const result = {
      mode,
      totalFetched: allChats.length,
      overview: {
        thisWeek: { total: thisWeekChats.length, ai: thisAiTotal, aiRatio: thisWeekChats.length > 0 ? Math.round((thisAiTotal / thisWeekChats.length) * 100) : 0 },
        lastWeek: { total: lastWeekChats.length, ai: lastAiTotal, aiRatio: lastWeekChats.length > 0 ? Math.round((lastAiTotal / lastWeekChats.length) * 100) : 0 },
        totalChange,
        aiChange,
        aiTopTags: aiTopAll,
      },
      cared,
      market,
      period: {
        thisWeek: { from: toKSTDateStr(thisWeekStartUTC), to: toKSTDateStr(thisWeekEnd) },
        lastWeek: { from: toKSTDateStr(lastWeekStartUTC), to: toKSTDateStr(lastWeekEnd) },
      },
      collectDebug,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
