"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts";

interface TagData {
  tag: string;
  thisWeek: number;
  lastWeek: number;
  change: number;
  changeRate: number;
  aiCount: number;
  aiRatio: number;
}

interface SegmentAnalysis {
  thisWeek: { total: number; ai: number; aiRatio: number };
  lastWeek: { total: number; ai: number; aiRatio: number };
  change: number;
  changeRate: number;
  tags: TagData[];
}

interface ApiData {
  totalFetched: number;
  overview: {
    thisWeek: { total: number; ai: number; aiRatio: number };
    lastWeek: { total: number; ai: number; aiRatio: number };
    totalChange: number;
    aiChange: number;
  };
  cared: SegmentAnalysis;
  market: SegmentAnalysis;
  period: {
    thisWeek: { from: string; to: string };
    lastWeek: { from: string; to: string };
  };
}

export default function Dashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "cared" | "market" | "daily">("summary");

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">❌ 데이터 로드 실패</p>
          <p className="text-gray-400">API 연결을 확인해주세요</p>
        </div>
      </div>
    );
  }

  const totalThisWeek = data.cared.thisWeek.total + data.market.thisWeek.total;
  const totalLastWeek = data.cared.lastWeek.total + data.market.lastWeek.total;
  const totalChange = totalLastWeek > 0 ? Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100) : 0;
  const totalChangeAbs = totalThisWeek - totalLastWeek;

  const totalAiThisWeek = data.cared.thisWeek.ai + data.market.thisWeek.ai;
  const totalAiRatio = totalThisWeek > 0 ? Math.round((totalAiThisWeek / totalThisWeek) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">CX</div>
            <h1 className="text-xl font-semibold">상담 분석 대시보드</h1>
            <span className="text-xs text-green-400 bg-green-900 px-2 py-1 rounded">✅ {data.totalFetched.toLocaleString()}건 수집</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 탭 네비게이션 */}
        <div className="flex space-x-1 mb-8 bg-gray-900 p-1 rounded-lg">
          {[
            { id: "summary", name: "📊 전체 요약" },
            { id: "cared", name: "🛠️ 케어드 태그" },
            { id: "market", name: "🏪 마켓 태그" },
            { id: "daily", name: "📈 일별 추이" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-gray-300 hover:bg-gray-800"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* 전체 요약 탭 */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-6">📊 전체 문의 현황</h2>
            
            {/* 메인 지표 카드들 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard
                label="이번주 전체"
                value={totalThisWeek}
                sub={`${data.period.thisWeek.from} ~ ${data.period.thisWeek.to}`}
                color="text-blue-400"
              />
              <StatCard
                label="지난주 전체"
                value={totalLastWeek}
                sub={`${data.period.lastWeek.from} ~ ${data.period.lastWeek.to}`}
                color="text-gray-400"
              />
              <StatCard
                label="증감 수"
                value={`${totalChangeAbs >= 0 ? '+' : ''}${totalChangeAbs}`}
                sub={`${totalChange >= 0 ? '↑' : '↓'}${Math.abs(totalChange)}%`}
                color={totalChange >= 0 ? "text-red-400" : "text-green-400"}
              />
              <StatCard
                label="AI 처리율"
                value={`${totalAiRatio}%`}
                sub={`${totalAiThisWeek.toLocaleString()}건 자동처리`}
                color="text-indigo-400"
              />
              <StatCard
                label="상담사 처리율"
                value={`${100 - totalAiRatio}%`}
                sub={`${(totalThisWeek - totalAiThisWeek).toLocaleString()}건 수동처리`}
                color="text-amber-400"
              />
            </div>

            {/* 세그먼트별 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SegmentCard
                title="🛠️ 케어드 문의"
                data={data.cared}
                color="bg-blue-900 border-blue-700"
              />
              <SegmentCard
                title="🏪 마켓 문의"
                data={data.market}
                color="bg-purple-900 border-purple-700"
              />
            </div>
          </div>
        )}

        {/* 케어드 태그 탭 */}
        {activeTab === "cared" && (
          <TagAnalysisTab
            title="🛠️ 케어드 태그 분석"
            data={data.cared}
            color="blue"
          />
        )}

        {/* 마켓 태그 탭 */}
        {activeTab === "market" && (
          <TagAnalysisTab
            title="🏪 마켓 태그 분석"
            data={data.market}
            color="purple"
          />
        )}

        {/* 일별 추이 탭 */}
        {activeTab === "daily" && (
          <DailyAnalysisTab />
        )}
      </main>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ label, value, sub, color = "text-white" }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
      <h3 className="text-gray-400 text-sm mb-2">{label}</h3>
      <p className={`text-2xl font-bold ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// 세그먼트 카드 컴포넌트
function SegmentCard({ title, data, color }: {
  title: string;
  data: SegmentAnalysis;
  color: string;
}) {
  const changeAbs = data.thisWeek.total - data.lastWeek.total;
  const aiChange = data.thisWeek.ai - data.lastWeek.ai;
  
  return (
    <div className={`${color} border rounded-xl p-6`}>
      <h3 className="text-white text-xl font-bold mb-4">{title}</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-gray-300 text-sm">이번주</p>
          <p className="text-2xl font-bold text-white">{data.thisWeek.total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-300 text-sm">지난주</p>
          <p className="text-2xl font-bold text-gray-400">{data.lastWeek.total.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-300">증감</span>
          <span className={`font-bold ${changeAbs >= 0 ? "text-red-300" : "text-green-300"}`}>
            {changeAbs >= 0 ? '+' : ''}{changeAbs} ({data.changeRate >= 0 ? '+' : ''}{data.changeRate}%)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-300">AI 처리</span>
          <span className="text-indigo-300 font-bold">
            {data.thisWeek.ai} ({data.thisWeek.aiRatio}%)
          </span>
        </div>
      </div>
    </div>
  );
}

// 태그 분석 탭 컴포넌트
function TagAnalysisTab({ title, data, color }: {
  title: string;
  data: SegmentAnalysis;
  color: "blue" | "purple";
}) {
  const topTags = data.tags.slice(0, 10);
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="이번주 총 문의"
          value={data.thisWeek.total}
          color={`text-${color}-400`}
        />
        <StatCard
          label="지난주 총 문의"
          value={data.lastWeek.total}
          color="text-gray-400"
        />
        <StatCard
          label="증감율"
          value={`${data.changeRate >= 0 ? '+' : ''}${data.changeRate}%`}
          color={data.changeRate >= 0 ? "text-red-400" : "text-green-400"}
        />
        <StatCard
          label="AI 처리율"
          value={`${data.thisWeek.aiRatio}%`}
          color="text-indigo-400"
        />
      </div>

      {/* 태그 순위 테이블 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">상위 10개 태그 분석</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">순위</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">태그명</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-300">이번주</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-300">지난주</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-300">증감</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-300">AI 처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {topTags.map((tag, index) => (
                <tr key={tag.tag} className="hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index < 3 ? 'bg-yellow-600 text-yellow-100' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-white max-w-xs truncate">
                    {tag.tag}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-white">
                    {tag.thisWeek.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-400">
                    {tag.lastWeek.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={`font-semibold ${
                      tag.change > 0 ? 'text-red-400' : tag.change < 0 ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      {tag.change > 0 ? '+' : ''}{tag.change}
                      <br />
                      <span className="text-xs">
                        ({tag.changeRate > 0 ? '+' : ''}{tag.changeRate}%)
                      </span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className="text-indigo-400 font-semibold">
                      {tag.aiCount.toLocaleString()}
                      <br />
                      <span className="text-xs text-gray-400">
                        ({tag.aiRatio}%)
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 일별 분석 탭 컴포넌트  
function DailyAnalysisTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">📈 일별 상담 인입 추이</h2>
      
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">일별 문의 인입량</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="ai" stroke="#6366f1" strokeWidth={2} />
              <Line type="monotone" dataKey="human" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-gray-400 text-sm mt-2">일별 데이터는 곧 추가 예정입니다.</p>
      </div>
    </div>
  );
}