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
    if (next) params.set("since", next); // since 파라미터로 페이지네이션

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

    for (const chat of batch) {
      // 모든 채팅을 수집 (API에 날짜 필터 없음, 클라이언트에서 필터링)
      chats.push(chat);
    }

    pages++;
    // next가 null일 때만 종료 (배치 크기와 무관)
    if (!nextCursor) break;
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

function analyzeNewSegment(
  thisWeekChats: any[],
  lastWeekChats: any[],
  segmentName: "케어드" | "마켓"
) {
  // 이번주와 지난주 태그 카운트
  const thisWeekTags = new Map<string, { count: number; ai: number }>();
  const lastWeekTags = new Map<string, { count: number; ai: number }>();
  
  let thisWeekTotal = 0;
  let thisWeekAi = 0;
  let lastWeekTotal = 0;
  let lastWeekAi = 0;

  // 이번주 데이터 처리
  for (const chat of thisWeekChats) {
    const isAi = isAiChat(chat);
    for (const tag of (chat.tags || [])) {
      const result = classifyTag(tag);
      if (!result || result.segment !== segmentName) continue;
      
      const { mappedTag } = result;
      thisWeekTotal++;
      if (isAi) thisWeekAi++;
      
      const entry = thisWeekTags.get(mappedTag) || { count: 0, ai: 0 };
      entry.count++;
      if (isAi) entry.ai++;
      thisWeekTags.set(mappedTag, entry);
    }
  }

  // 지난주 데이터 처리
  for (const chat of lastWeekChats) {
    const isAi = isAiChat(chat);
    for (const tag of (chat.tags || [])) {
      const result = classifyTag(tag);
      if (!result || result.segment !== segmentName) continue;
      
      const { mappedTag } = result;
      lastWeekTotal++;
      if (isAi) lastWeekAi++;
      
      const entry = lastWeekTags.get(mappedTag) || { count: 0, ai: 0 };
      entry.count++;
      if (isAi) entry.ai++;
      lastWeekTags.set(mappedTag, entry);
    }
  }

  // 모든 태그 합치기
  const allTags = new Set([...thisWeekTags.keys(), ...lastWeekTags.keys()]);
  const tagAnalysis: Array<{
    tag: string;
    thisWeek: number;
    lastWeek: number;
    change: number;
    changeRate: number;
    aiCount: number;
    aiRatio: number;
  }> = [];

  for (const tag of allTags) {
    const thisWeek = thisWeekTags.get(tag);
    const lastWeek = lastWeekTags.get(tag);
    const thisWeekCount = thisWeek?.count || 0;
    const lastWeekCount = lastWeek?.count || 0;
    const change = thisWeekCount - lastWeekCount;
    const changeRate = lastWeekCount > 0 ? Math.round((change / lastWeekCount) * 100) : (thisWeekCount > 0 ? 100 : 0);
    
    tagAnalysis.push({
      tag,
      thisWeek: thisWeekCount,
      lastWeek: lastWeekCount,
      change,
      changeRate,
      aiCount: thisWeek?.ai || 0,
      aiRatio: thisWeekCount > 0 ? Math.round(((thisWeek?.ai || 0) / thisWeekCount) * 100) : 0
    });
  }

  // 이번주 기준으로 정렬
  tagAnalysis.sort((a, b) => b.thisWeek - a.thisWeek);

  // 전체 증감 계산
  const totalChange = lastWeekTotal > 0 ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) : 0;
  const thisWeekAiRatio = thisWeekTotal > 0 ? Math.round((thisWeekAi / thisWeekTotal) * 100) : 0;
  const lastWeekAiRatio = lastWeekTotal > 0 ? Math.round((lastWeekAi / lastWeekTotal) * 100) : 0;

  return {
    thisWeek: { total: thisWeekTotal, ai: thisWeekAi, aiRatio: thisWeekAiRatio },
    lastWeek: { total: lastWeekTotal, ai: lastWeekAi, aiRatio: lastWeekAiRatio },
    change: thisWeekTotal - lastWeekTotal,
    changeRate: totalChange,
    tags: tagAnalysis
  };
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

  let thisWeekStartUTC: Date;
  let lastWeekStartUTC: Date;
  let thisWeekEnd: Date;
  let lastWeekEnd: Date;
  let sinceTs: number;
  let untilTs: number;

  if (mode === "range" && from && to) {
    // 사용자 지정 모드: 선택한 기간을 "이번주"로 보고, 같은 길이의 이전 기간을 "지난주"로 설정
    const fromDate = new Date(from + "T00:00:00+09:00");
    const toDate = new Date(to + "T23:59:59.999+09:00");
    const periodDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    
    thisWeekStartUTC = fromDate;
    thisWeekEnd = toDate;
    lastWeekStartUTC = new Date(fromDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    lastWeekEnd = new Date(fromDate.getTime() - 1);
    
    // 더 넓은 범위로 데이터 수집 (지난주 포함)
    sinceTs = lastWeekStartUTC.getTime();
    untilTs = thisWeekEnd.getTime();
  } else {
    // 기본 모드: 수-화 주간 기준
    const now = new Date();
    thisWeekStartUTC = getWeekStartKST(now);
    lastWeekStartUTC = new Date(thisWeekStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000);
    thisWeekEnd = new Date(thisWeekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    lastWeekEnd = new Date(thisWeekStartUTC.getTime() - 1);
    
    // 모든 데이터 가져오기 (API에 날짜 필터 없음)
    sinceTs = 0;
    untilTs = Date.now() + 24 * 60 * 60 * 1000;
  }

  const cacheKey = `v18-custom-date-fix-${Date.now()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const [closed, opened, snoozed] = await Promise.all([
      fetchChatsByState("closed", sinceTs, 5), // 타임아웃 방지: ~2,500건
      fetchChatsByState("opened", sinceTs, 3),  // 타임아웃 방지: ~1,500건  
      fetchChatsByState("snoozed", sinceTs, 2), // 타임아웃 방지: ~1,000건
    ]);

    let allChats = [...closed, ...opened, ...snoozed];
    const seen = new Set<string>();
    allChats = allChats.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      const ts = c.createdAt || c.openedAt || 0; // createdAt 기준 (상담 인입)
      return ts >= sinceTs && ts <= untilTs;
    });

    // 이미 설정된 기간 사용 (사용자 지정 또는 기본 주간)
    const thisWeekChats = allChats.filter((c) => {
      const ts = c.createdAt || c.openedAt || 0; // createdAt 기준 (상담 인입)
      return ts >= thisWeekStartUTC.getTime() && ts <= thisWeekEnd.getTime();
    });
    const lastWeekChats = allChats.filter((c) => {
      const ts = c.createdAt || c.openedAt || 0; // createdAt 기준 (상담 인입)
      return ts >= lastWeekStartUTC.getTime() && ts <= lastWeekEnd.getTime();
    });

    const collectDebug = {
      fetchCounts: {
        closed: closed.length,
        opened: opened.length, 
        snoozed: snoozed.length,
        total: allChats.length
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

    // 새로운 분석 로직
    const caredAnalysis = analyzeNewSegment(thisWeekChats, lastWeekChats, "케어드");
    const marketAnalysis = analyzeNewSegment(thisWeekChats, lastWeekChats, "마켓");

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
      cared: caredAnalysis,
      market: marketAnalysis,
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
