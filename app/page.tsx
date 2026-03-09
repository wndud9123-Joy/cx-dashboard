"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Period = "daily" | "weekly" | "monthly";

interface ChatData {
  date: string;
  count: number;
}

interface ApiResponse {
  period: string;
  total: number;
  data: ChatData[];
}

const PERIOD_LABELS: Record<Period, string> = {
  daily: "일별",
  weekly: "주별",
  monthly: "월별",
};

const PERIOD_COLORS: Record<Period, string> = {
  daily: "#6366f1",
  weekly: "#8b5cf6",
  monthly: "#a855f7",
};

function formatDate(date: string, period: Period): string {
  if (period === "monthly") {
    const [y, m] = date.split("-");
    return `${m}월`;
  }
  if (period === "weekly") {
    const [, m, d] = date.split("-");
    return `${parseInt(m)}/${parseInt(d)}주`;
  }
  const [, m, d] = date.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("daily");
  const [data, setData] = useState<ChatData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/chats?period=${period}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "API 요청 실패");
        }
        const json: ApiResponse = await res.json();
        setData(json.data);
        setTotal(json.total);
      } catch (e: any) {
        setError(e.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [period]);

  const avg =
    data.length > 0
      ? Math.round(data.reduce((s, d) => s + d.count, 0) / data.length)
      : 0;
  const max = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
              CX
            </div>
            <h1 className="text-xl font-semibold">CX 대시보드</h1>
          </div>
          <div className="text-sm text-gray-400">
            채널톡 상담 현황
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Period Tabs */}
        <div className="flex gap-2 mb-8">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">총 상담 건수</p>
            <p className="text-3xl font-bold text-white">
              {loading ? "—" : total.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">
              평균 ({PERIOD_LABELS[period]})
            </p>
            <p className="text-3xl font-bold text-indigo-400">
              {loading ? "—" : avg.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">
              최대 ({PERIOD_LABELS[period]})
            </p>
            <p className="text-3xl font-bold text-purple-400">
              {loading ? "—" : max.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6">
            📊 상담 건수 ({PERIOD_LABELS[period]})
          </h2>

          {loading ? (
            <div className="h-80 flex items-center justify-center text-gray-500">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                데이터 로딩 중...
              </div>
            </div>
          ) : error ? (
            <div className="h-80 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 text-lg mb-2">⚠️ 오류 발생</p>
                <p className="text-gray-500 text-sm">{error}</p>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-gray-500">
              해당 기간에 상담 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={data}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1f2937"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDate(v, period)}
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
                  formatter={(value) => [
                    `${Number(value).toLocaleString()}건`,
                    "상담",
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {data.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PERIOD_COLORS[period]}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Table */}
        {!loading && !error && data.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">📋 상세 데이터</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      기간
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      상담 건수
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      비율
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.date}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="py-3 px-4">{item.date}</td>
                      <td className="text-right py-3 px-4 font-mono">
                        {item.count.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-400">
                        {total > 0
                          ? ((item.count / total) * 100).toFixed(1)
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
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 mt-12">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-600">
          CX Dashboard · Channel Talk Integration
        </div>
      </footer>
    </div>
  );
}
