"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Mode = "weekly" | "compare" | "range";

interface ApiResponse {
  mode: string;
  total: number;
  ai: { count: number; ratio: number };
  human: { count: number; ratio: number };
  states: { closed: number; opened: number; snoozed: number };
  tags: { tag: string; count: number }[];
  daily: { date: string; total: number; ai: number; human: number }[];
  comparison: {
    labels: string[];
    lastWeek: { total: number; daily: number[]; startDate: string };
    thisWeek: { total: number; daily: number[]; startDate: string };
  } | null;
  period: { from: string; to: string };
}

const PIE_COLORS = ["#6366f1", "#f59e0b"];
const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b",
];

function formatShortDate(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>("compare");
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
      if (mode === "range" && fromDate && toDate) {
        url += `&from=${fromDate}&to=${toDate}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API 요청 실패");
      }
      const json: ApiResponse = await res.json();
      setData(json);
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

  const pieData = data
    ? [
        { name: "🤖 AI 봇", value: data.ai.count },
        { name: "👤 상담사", value: data.human.count },
      ]
    : [];

  const comparisonData = data?.comparison
    ? data.comparison.labels.map((label, i) => ({
        day: label,
        지난주: data.comparison!.lastWeek.daily[i],
        이번주: data.comparison!.thisWeek.daily[i],
      }))
    : [];

  const changeRate =
    data?.comparison
      ? data.comparison.lastWeek.total > 0
        ? Math.round(
            ((data.comparison.thisWeek.total - data.comparison.lastWeek.total) /
              data.comparison.lastWeek.total) *
              100
          )
        : 100
      : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
              CX
            </div>
            <h1 className="text-xl font-semibold">CX 대시보드</h1>
          </div>
          <div className="text-sm text-gray-400">
            {data && `${data.period.from} ~ ${data.period.to}`}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Mode Tabs + Date Picker */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex gap-2">
            {([
              ["weekly", "이번 주"],
              ["compare", "주간 비교"],
              ["range", "기간 선택"],
            ] as [Mode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "range" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center text-gray-500">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
              데이터 로딩 중...
            </div>
          </div>
        ) : error ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 text-lg mb-2">⚠️ 오류 발생</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-1">전체 상담</p>
                <p className="text-3xl font-bold text-white">
                  {data.total.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-1">🤖 AI 답변</p>
                <p className="text-3xl font-bold text-indigo-400">
                  {data.ai.count.toLocaleString()}
                  <span className="text-lg text-gray-500 ml-1">
                    ({data.ai.ratio}%)
                  </span>
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-1">👤 상담사 응대</p>
                <p className="text-3xl font-bold text-amber-400">
                  {data.human.count.toLocaleString()}
                  <span className="text-lg text-gray-500 ml-1">
                    ({data.human.ratio}%)
                  </span>
                </p>
              </div>
              {data.comparison && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-sm text-gray-400 mb-1">주간 증감</p>
                  <p
                    className={`text-3xl font-bold ${
                      changeRate > 0
                        ? "text-red-400"
                        : changeRate < 0
                        ? "text-green-400"
                        : "text-gray-400"
                    }`}
                  >
                    {changeRate > 0 ? "+" : ""}
                    {changeRate}%
                  </p>
                </div>
              )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Week Comparison or Daily Bar Chart */}
              <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">
                  {mode === "compare"
                    ? "📊 지난주 vs 이번주"
                    : "📊 일별 상담 건수"}
                </h2>
                <ResponsiveContainer width="100%" height={320}>
                  {mode === "compare" && comparisonData.length > 0 ? (
                    <BarChart data={comparisonData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        stroke="#6b7280"
                        fontSize={13}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        formatter={(value) => [
                          `${Number(value)}건`,
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="지난주"
                        fill="#64748b"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={35}
                      />
                      <Bar
                        dataKey="이번주"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={35}
                      />
                    </BarChart>
                  ) : (
                    <BarChart data={data.daily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatShortDate}
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        labelFormatter={(v) => `📅 ${v}`}
                      />
                      <Legend />
                      <Bar
                        dataKey="human"
                        name="상담사"
                        fill="#f59e0b"
                        stackId="stack"
                        radius={[0, 0, 0, 0]}
                        maxBarSize={40}
                      />
                      <Bar
                        dataKey="ai"
                        name="AI 봇"
                        fill="#6366f1"
                        stackId="stack"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* AI vs Human Pie Chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">
                  🤖 AI vs 상담사
                </h2>
                {data.total > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) =>
                          `${name} ${value}건`
                        }
                        labelLine={false}
                      >
                        {pieData.map((_, index) => (
                          <Cell
                            key={index}
                            fill={PIE_COLORS[index]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    데이터 없음
                  </div>
                )}
              </div>
            </div>

            {/* Tags + Status Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Tag Breakdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">🏷️ 태그별 분류</h2>
                {data.tags.length > 0 ? (
                  <div className="space-y-3">
                    {data.tags.map((tag, i) => (
                      <div key={tag.tag} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              TAG_COLORS[i % TAG_COLORS.length],
                          }}
                        />
                        <span className="text-sm flex-1 truncate">
                          {tag.tag}
                        </span>
                        <span className="text-sm font-mono text-gray-400">
                          {tag.count}건
                        </span>
                        <div className="w-24 bg-gray-800 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${
                                data.total > 0
                                  ? (tag.count / data.total) * 100
                                  : 0
                              }%`,
                              backgroundColor:
                                TAG_COLORS[i % TAG_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">태그 데이터 없음</p>
                )}
              </div>

              {/* Status Breakdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">
                  📋 상담 상태
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      ✅ 종료 (Closed)
                    </span>
                    <span className="text-lg font-bold text-green-400">
                      {data.states.closed.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      💬 진행 중 (Opened)
                    </span>
                    <span className="text-lg font-bold text-blue-400">
                      {data.states.opened.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      😴 대기 (Snoozed)
                    </span>
                    <span className="text-lg font-bold text-yellow-400">
                      {data.states.snoozed.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Comparison Summary */}
                {data.comparison && (
                  <div className="mt-6 pt-6 border-t border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">
                      주간 비교 요약
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">지난주</p>
                        <p className="text-xl font-bold text-gray-400">
                          {data.comparison.lastWeek.total}건
                        </p>
                        <p className="text-xs text-gray-600">
                          {data.comparison.lastWeek.startDate}~
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">이번주</p>
                        <p className="text-xl font-bold text-indigo-400">
                          {data.comparison.thisWeek.total}건
                        </p>
                        <p className="text-xs text-gray-600">
                          {data.comparison.thisWeek.startDate}~
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Detail Table */}
            {data.daily.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">📋 일별 상세</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">
                          날짜
                        </th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">
                          전체
                        </th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">
                          🤖 AI
                        </th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">
                          👤 상담사
                        </th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">
                          AI 비율
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily.map((item) => (
                        <tr
                          key={item.date}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="py-3 px-4">{item.date}</td>
                          <td className="text-right py-3 px-4 font-mono font-bold">
                            {item.total}
                          </td>
                          <td className="text-right py-3 px-4 font-mono text-indigo-400">
                            {item.ai}
                          </td>
                          <td className="text-right py-3 px-4 font-mono text-amber-400">
                            {item.human}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-400">
                            {item.total > 0
                              ? Math.round((item.ai / item.total) * 100)
                              : 0}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 mt-12">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          CX Dashboard · Channel Talk Integration
        </div>
      </footer>
    </div>
  );
}
