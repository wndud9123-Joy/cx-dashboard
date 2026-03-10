"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

type Mode = "compare" | "range";
type SegTab = "전체" | "케어드" | "마켓";

interface SegmentData {
  total: number;
  subSegments: Record<string, number>;
  tags: { tag: string; count: number; subSegment: string }[];
}

interface WeekData {
  total: number;
  ai: { count: number; ratio: number };
  human: { count: number; ratio: number };
  cared: SegmentData;
  market: SegmentData;
  unclassifiedTags: { tag: string; count: number }[];
  daily: { date: string; total: number; ai: number; human: number; cared: number; market: number }[];
  states: { closed: number; opened: number; snoozed: number };
  startDate: string;
  endDate: string;
}

interface ApiResponse {
  mode: string;
  totalFetched: number;
  thisWeek: WeekData;
  lastWeek: WeekData;
  comparison: {
    labels: string[];
    lastWeekDaily: number[];
    thisWeekDaily: number[];
    changeRate: number;
    caredChange: number;
    marketChange: number;
  };
  period: { from: string; to: string };
}

const PIE_COLORS = ["#6366f1", "#f59e0b"];
const SUB_COLORS: Record<string, string> = {
  "판매": "#6366f1", "구매": "#f59e0b", "기타": "#64748b",
  "판매자": "#8b5cf6", "구매자": "#ec4899", "공통": "#06b6d4",
};
const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b",
  "#ef4444", "#14b8a6", "#f97316", "#84cc16", "#e879f9",
];

const DAY_NAMES: Record<string, string> = {
  "0": "일", "1": "월", "2": "화", "3": "수", "4": "목", "5": "금", "6": "토",
};
function getDayName(dateStr: string) {
  return DAY_NAMES[new Date(dateStr).getDay().toString()] || "";
}
function formatShortDate(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}
function changeArrow(rate: number) {
  if (rate > 0) return `↑+${rate}%`;
  if (rate < 0) return `↓${rate}%`;
  return "0%";
}
function changeColor(rate: number) {
  if (rate > 0) return "text-red-400";
  if (rate < 0) return "text-green-400";
  return "text-gray-400";
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-white"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function SegmentBar({ data, subKeys }: { data: SegmentData; subKeys: string[] }) {
  if (data.total === 0) return <p className="text-gray-500 text-sm">데이터 없음</p>;
  return (
    <div className="space-y-3">
      {/* Sub-segment bars */}
      <div className="flex h-8 rounded-lg overflow-hidden">
        {subKeys.map((key) => {
          const pct = data.total > 0 ? (data.subSegments[key] / data.total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className="flex items-center justify-center text-xs font-medium text-white"
              style={{ width: `${pct}%`, backgroundColor: SUB_COLORS[key], minWidth: pct > 3 ? "auto" : "0" }}
            >
              {pct >= 8 && `${key} ${Math.round(pct)}%`}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {subKeys.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SUB_COLORS[key] }} />
            <span className="text-sm text-gray-400">{key}</span>
            <span className="text-sm font-mono font-bold text-white">{data.subSegments[key]}건</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagList({ tags, maxShow = 20 }: { tags: { tag: string; count: number; subSegment: string }[]; maxShow?: number }) {
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? tags : tags.slice(0, maxShow);
  const maxCount = tags.length > 0 ? tags[0].count : 1;

  return (
    <div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {display.map((tag, i) => (
          <div key={tag.tag} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: SUB_COLORS[tag.subSegment] || TAG_COLORS[i % TAG_COLORS.length] }}
            />
            <span className="text-xs text-gray-500 w-10">{tag.subSegment}</span>
            <span className="text-sm flex-1 truncate">{tag.tag}</span>
            <span className="text-xs font-mono text-gray-400 w-10 text-right">{tag.count}</span>
            <div className="w-16 bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full"
                style={{
                  width: `${(tag.count / maxCount) * 100}%`,
                  backgroundColor: SUB_COLORS[tag.subSegment] || TAG_COLORS[i % TAG_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {tags.length > maxShow && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
        >
          {showAll ? "접기" : `+${tags.length - maxShow}개 더 보기`}
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>("compare");
  const [segTab, setSegTab] = useState<SegTab>("전체");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/chats?mode=${mode}`;
      if (mode === "range" && fromDate && toDate) url += `&from=${fromDate}&to=${toDate}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API 요청 실패");
      }
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mode, fromDate, toDate]);

  useEffect(() => {
    if (mode === "range" && (!fromDate || !toDate)) return;
    fetchData();
  }, [mode, fetchData, fromDate, toDate]);

  const tw = data?.thisWeek;
  const lw = data?.lastWeek;
  const cmp = data?.comparison;

  const comparisonData = cmp
    ? cmp.labels.map((label, i) => ({
        day: label,
        지난주: cmp.lastWeekDaily[i],
        이번주: cmp.thisWeekDaily[i],
      }))
    : [];

  const pieData = tw
    ? [
        { name: "🤖 AI 봇", value: tw.ai.count },
        { name: "👤 상담사", value: tw.human.count },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">CX</div>
            <h1 className="text-xl font-semibold">CX 대시보드</h1>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">수~화 기준</span>
          </div>
          <div className="text-sm text-gray-400">
            {tw && <span>{tw.startDate} ~ {tw.endDate}</span>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex gap-2">
            <button onClick={() => setMode("compare")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "compare" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              📊 주간 비교
            </button>
            <button onClick={() => setMode("range")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "range" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              📅 기간 선택
            </button>
          </div>
          {mode === "range" && (
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              <span className="text-gray-500">~</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          )}
        </div>

        {/* Segment Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
          {(["전체", "케어드", "마켓"] as SegTab[]).map((tab) => (
            <button key={tab} onClick={() => setSegTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${segTab === tab ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>
              {tab}
              {tw && tab === "케어드" && <span className="ml-1 text-xs opacity-70">({tw.cared.total})</span>}
              {tw && tab === "마켓" && <span className="ml-1 text-xs opacity-70">({tw.market.total})</span>}
              {tw && tab === "전체" && <span className="ml-1 text-xs opacity-70">({tw.total})</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center text-gray-500">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span>채널톡 데이터 로딩 중...</span>
              <span className="text-xs text-gray-600">최초 로딩 시 30초~1분 소요</span>
            </div>
          </div>
        ) : error ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 text-lg mb-2">⚠️ 오류</p>
              <p className="text-gray-500 text-sm">{error}</p>
              <button onClick={fetchData} className="mt-4 px-4 py-2 bg-indigo-600 rounded-lg text-sm hover:bg-indigo-700">다시 시도</button>
            </div>
          </div>
        ) : tw && lw && cmp ? (
          <>
            {/* ===== 전체 탭 ===== */}
            {segTab === "전체" && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                  <StatCard label="이번주 전체" value={tw.total} sub={`${tw.startDate}~`} />
                  <StatCard label="지난주 전체" value={lw.total} sub={`${lw.startDate}~`} color="text-gray-400" />
                  <StatCard label="주간 증감" value={changeArrow(cmp.changeRate)} color={changeColor(cmp.changeRate)} />
                  <StatCard label="🤖 AI 봇" value={tw.ai.count} sub={`${tw.ai.ratio}%`} color="text-indigo-400" />
                  <StatCard label="👤 상담사" value={tw.human.count} sub={`${tw.human.ratio}%`} color="text-amber-400" />
                  <StatCard label="총 페치" value={data!.totalFetched} sub="2주 합계" color="text-gray-500" />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  {/* Comparison Bar */}
                  <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">📊 지난주 vs 이번주 (수~화)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="day" stroke="#6b7280" fontSize={13} tickLine={false} axisLine={false} />
                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                          formatter={(value) => [`${Number(value)}건`]} />
                        <Legend />
                        <Bar dataKey="지난주" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={35} />
                        <Bar dataKey="이번주" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={35} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* AI Pie */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-2">🤖 AI vs 상담사</h2>
                    <p className="text-xs text-gray-500 mb-3">상담사 미배정 = AI 봇</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                          formatter={(value) => [`${Number(value)}건`]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-around mt-2">
                      <div className="text-center">
                        <p className="text-xl font-bold text-indigo-400">{tw.ai.ratio}%</p>
                        <p className="text-xs text-gray-500">AI 봇</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-amber-400">{tw.human.ratio}%</p>
                        <p className="text-xs text-gray-500">상담사</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segment Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold">🏷️ 케어드</h2>
                      <span className={`text-sm font-bold ${changeColor(cmp.caredChange)}`}>{changeArrow(cmp.caredChange)}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold">{tw.cared.total}</span>
                      <span className="text-gray-500 text-sm">이번주</span>
                      <span className="text-gray-600 text-sm">/ {lw.cared.total} 지난주</span>
                    </div>
                    <SegmentBar data={tw.cared} subKeys={["판매", "구매", "기타"]} />
                  </div>

                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold">🛒 마켓</h2>
                      <span className={`text-sm font-bold ${changeColor(cmp.marketChange)}`}>{changeArrow(cmp.marketChange)}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold">{tw.market.total}</span>
                      <span className="text-gray-500 text-sm">이번주</span>
                      <span className="text-gray-600 text-sm">/ {lw.market.total} 지난주</span>
                    </div>
                    <SegmentBar data={tw.market} subKeys={["판매자", "구매자", "공통"]} />
                  </div>
                </div>

                {/* Status + Unclassified */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">📋 상담 상태</h2>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-gray-400">✅ 종료</span><span className="font-bold text-green-400">{tw.states.closed}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">💬 진행 중</span><span className="font-bold text-blue-400">{tw.states.opened}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">😴 대기</span><span className="font-bold text-yellow-400">{tw.states.snoozed}</span></div>
                    </div>
                  </div>

                  {tw.unclassifiedTags.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                      <h2 className="text-lg font-semibold mb-4">❓ 미분류 태그</h2>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {tw.unclassifiedTags.map((t) => (
                          <div key={t.tag} className="flex justify-between text-sm">
                            <span className="text-gray-400">{t.tag}</span>
                            <span className="font-mono text-gray-500">{t.count}건</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily Table */}
                {tw.daily.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">📋 일별 상세</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="text-left py-2 px-3 text-gray-400">날짜</th>
                            <th className="text-left py-2 px-2 text-gray-400">요일</th>
                            <th className="text-right py-2 px-3 text-gray-400">전체</th>
                            <th className="text-right py-2 px-3 text-gray-400">🤖 AI</th>
                            <th className="text-right py-2 px-3 text-gray-400">👤 상담</th>
                            <th className="text-right py-2 px-3 text-gray-400">케어드</th>
                            <th className="text-right py-2 px-3 text-gray-400">마켓</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tw.daily.map((d) => (
                            <tr key={d.date} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="py-2 px-3">{d.date}</td>
                              <td className="py-2 px-2 text-gray-500">{getDayName(d.date)}</td>
                              <td className="text-right py-2 px-3 font-mono font-bold">{d.total}</td>
                              <td className="text-right py-2 px-3 font-mono text-indigo-400">{d.ai}</td>
                              <td className="text-right py-2 px-3 font-mono text-amber-400">{d.human}</td>
                              <td className="text-right py-2 px-3 font-mono text-purple-400">{d.cared}</td>
                              <td className="text-right py-2 px-3 font-mono text-cyan-400">{d.market}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== 케어드 탭 ===== */}
            {segTab === "케어드" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  <StatCard label="이번주 케어드" value={tw.cared.total} />
                  <StatCard label="지난주 케어드" value={lw.cared.total} color="text-gray-400" />
                  <StatCard label="증감" value={changeArrow(cmp.caredChange)} color={changeColor(cmp.caredChange)} />
                  <StatCard label="판매" value={tw.cared.subSegments["판매"]} color="text-indigo-400" sub={`지난주 ${lw.cared.subSegments["판매"]}`} />
                  <StatCard label="구매" value={tw.cared.subSegments["구매"]} color="text-amber-400" sub={`지난주 ${lw.cared.subSegments["구매"]}`} />
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4">📊 케어드 소분류 비중</h2>
                  <SegmentBar data={tw.cared} subKeys={["판매", "구매", "기타"]} />
                </div>

                {/* Comparison: this vs last week sub-segments */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4">📊 지난주 vs 이번주 (소분류)</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { sub: "판매", 지난주: lw.cared.subSegments["판매"], 이번주: tw.cared.subSegments["판매"] },
                      { sub: "구매", 지난주: lw.cared.subSegments["구매"], 이번주: tw.cared.subSegments["구매"] },
                      { sub: "기타", 지난주: lw.cared.subSegments["기타"], 이번주: tw.cared.subSegments["기타"] },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="sub" stroke="#6b7280" fontSize={13} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                        formatter={(value) => [`${Number(value)}건`]} />
                      <Legend />
                      <Bar dataKey="지난주" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="이번주" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">🏷️ 케어드 태그 상세</h2>
                    <span className="text-xs text-gray-500">{tw.cared.tags.length}개</span>
                  </div>
                  <TagList tags={tw.cared.tags} />
                </div>
              </>
            )}

            {/* ===== 마켓 탭 ===== */}
            {segTab === "마켓" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  <StatCard label="이번주 마켓" value={tw.market.total} />
                  <StatCard label="지난주 마켓" value={lw.market.total} color="text-gray-400" />
                  <StatCard label="증감" value={changeArrow(cmp.marketChange)} color={changeColor(cmp.marketChange)} />
                  <StatCard label="판매자" value={tw.market.subSegments["판매자"]} color="text-purple-400" sub={`지난주 ${lw.market.subSegments["판매자"]}`} />
                  <StatCard label="구매자" value={tw.market.subSegments["구매자"]} color="text-pink-400" sub={`지난주 ${lw.market.subSegments["구매자"]}`} />
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4">📊 마켓 소분류 비중</h2>
                  <SegmentBar data={tw.market} subKeys={["판매자", "구매자", "공통"]} />
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4">📊 지난주 vs 이번주 (소분류)</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { sub: "판매자", 지난주: lw.market.subSegments["판매자"], 이번주: tw.market.subSegments["판매자"] },
                      { sub: "구매자", 지난주: lw.market.subSegments["구매자"], 이번주: tw.market.subSegments["구매자"] },
                      { sub: "공통", 지난주: lw.market.subSegments["공통"], 이번주: tw.market.subSegments["공통"] },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="sub" stroke="#6b7280" fontSize={13} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                        formatter={(value) => [`${Number(value)}건`]} />
                      <Legend />
                      <Bar dataKey="지난주" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="이번주" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">🏷️ 마켓 태그 상세</h2>
                    <span className="text-xs text-gray-500">{tw.market.tags.length}개</span>
                  </div>
                  <TagList tags={tw.market.tags} />
                </div>
              </>
            )}
          </>
        ) : null}
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 mt-12">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          CX Dashboard · Channel Talk · 수~화 주간 기준
        </div>
      </footer>
    </div>
  );
}
