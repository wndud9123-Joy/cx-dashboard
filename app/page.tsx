"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
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
  daily?: {
    today: { total: number; ai: number; cared: number; market: number; date: string };
    yesterday: { total: number; ai: number; cared: number; market: number; date: string };
  };
}

export default function Dashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "cared" | "market" | "daily">("summary");

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chats?mode=compare');
      const apiData = await response.json();
      setData(apiData);
    } catch (error) {
      console.error('API 호출 실패:', error);
      // Fallback 데이터
      setData({
        totalFetched: 115,
        overview: {
          thisWeek: { total: 115, ai: 58, aiRatio: 50 },
          lastWeek: { total: 1318, ai: 569, aiRatio: 43 },
          totalChange: -91,
          aiChange: -90
        },
        cared: {
          thisWeek: { total: 52, ai: 36, aiRatio: 69 },
          lastWeek: { total: 1009, ai: 499, aiRatio: 49 },
          change: -957,
          changeRate: -95,
          tags: [
            { tag: "kg판매", thisWeek: 5, lastWeek: 35, change: -30, changeRate: -86, aiCount: 3, aiRatio: 60 },
            { tag: "반품수거일정", thisWeek: 4, lastWeek: 25, change: -21, changeRate: -84, aiCount: 4, aiRatio: 100 },
            { tag: "검수일정", thisWeek: 3, lastWeek: 80, change: -77, changeRate: -96, aiCount: 3, aiRatio: 100 },
            { tag: "환불일정", thisWeek: 2, lastWeek: 58, change: -56, changeRate: -97, aiCount: 2, aiRatio: 100 },
            { tag: "수거취소", thisWeek: 2, lastWeek: 11, change: -9, changeRate: -82, aiCount: 2, aiRatio: 100 }
          ]
        },
        market: {
          thisWeek: { total: 63, ai: 22, aiRatio: 35 },
          lastWeek: { total: 309, ai: 70, aiRatio: 23 },
          change: -246,
          changeRate: -80,
          tags: [
            { tag: "판매자/재판매 가능 여부 문의", thisWeek: 64, lastWeek: 39, change: 25, changeRate: 64, aiCount: 0, aiRatio: 0 },
            { tag: "구매자/반품 가능 문의(구매 확정)", thisWeek: 0, lastWeek: 5, change: -5, changeRate: -100, aiCount: 0, aiRatio: 0 }
          ]
        },
        period: {
          thisWeek: { from: "2026-03-05", to: "2026-03-11" },
          lastWeek: { from: "2026-02-26", to: "2026-03-04" }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-transparent border-t-indigo-500 rounded-full animate-spin mx-auto mb-6"></div>
          <div className="space-y-2">
            <p className="text-slate-300 text-lg font-medium">데이터 로딩 중</p>
            <p className="text-slate-500 text-sm">Channel Talk API에서 최신 상담 데이터를 가져오고 있습니다</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-900/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 text-lg font-medium mb-2">연결 실패</p>
          <p className="text-slate-400 mb-6">API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.</p>
          <button
            onClick={fetchData}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
          >
            다시 시도
          </button>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Linear-style Header with Gradient */}
      <header className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg shadow-indigo-500/25">
                CX
              </div>
              <div>
                <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Customer Service Dashboard
                </h1>
                <p className="text-slate-500 text-sm">실시간 상담 분석 및 인사이트</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">{data?.totalFetched?.toLocaleString() || "0"}건 수집</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm text-slate-300 px-4 py-2 rounded-lg text-sm">
                <span className="text-slate-400">📅</span>
                <span className="ml-2">수~화 주간 기준</span>
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="group px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-600 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-lg shadow-indigo-500/25"
              >
                <span className="group-hover:scale-110 inline-block transition-transform duration-200">⟳</span>
                <span className="ml-2">새로고침</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Linear-style Tab Navigation */}
        <div className="flex space-x-1 mb-10 bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm p-1 rounded-xl">
          {[
            { id: "summary", name: "전체 요약", icon: "📊" },
            { id: "cared", name: "케어드", icon: "🛠️" },
            { id: "market", name: "마켓", icon: "🏪" },
            { id: "daily", name: "일별 추이", icon: "📈" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 transform ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105"
                  : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/30 hover:scale-102"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        {/* 전체 요약 탭 */}
        {activeTab === "summary" && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-300 bg-clip-text text-transparent mb-3">
                전체 상담 현황
              </h2>
              <p className="text-slate-400">Channel Talk 데이터 기반 실시간 분석</p>
            </div>
            
            {/* Intercom-style Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <MetricCard
                label="이번주 총 문의"
                value={totalThisWeek}
                subtitle="수~화 (7일간)"
                icon="📞"
                gradient="from-blue-600 to-cyan-600"
                glowColor="blue-500"
              />
              <MetricCard
                label="지난주 총 문의"
                value={totalLastWeek}
                subtitle="수~화 (7일간)"
                icon="📋"
                gradient="from-slate-600 to-slate-700"
                glowColor="slate-500"
              />
              <MetricCard
                label="주간 증감"
                value={`${totalChangeAbs >= 0 ? '+' : ''}${totalChangeAbs}`}
                subtitle={`${totalChange >= 0 ? '↗️' : '↘️'} ${Math.abs(totalChange)}%`}
                icon={totalChange >= 0 ? "📈" : "📉"}
                gradient={totalChange >= 0 ? "from-red-600 to-pink-600" : "from-green-600 to-emerald-600"}
                glowColor={totalChange >= 0 ? "red-500" : "green-500"}
              />
              <MetricCard
                label="AI 자동 처리"
                value={`${totalAiRatio}%`}
                subtitle={`${totalAiThisWeek.toLocaleString()}건`}
                icon="🤖"
                gradient="from-indigo-600 to-purple-600"
                glowColor="indigo-500"
              />
              <MetricCard
                label="상담사 처리"
                value={`${100 - totalAiRatio}%`}
                subtitle={`${(totalThisWeek - totalAiThisWeek).toLocaleString()}건`}
                icon="👥"
                gradient="from-amber-600 to-orange-600"
                glowColor="amber-500"
              />
            </div>

            {/* Enhanced Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Total Trend Chart */}
              <ChartCard
                title="전체 문의 트렌드"
                subtitle="주간 비교 분석"
                icon="📊"
              >
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: '전체 문의', 지난주: totalLastWeek, 이번주: totalThisWeek }
                    ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                          border: '1px solid #334155', 
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)'
                        }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Bar dataKey="지난주" fill="url(#lastWeekGradient)" name="지난주" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="이번주" fill="url(#thisWeekGradient)" name="이번주" radius={[6, 6, 0, 0]} />
                      <defs>
                        <linearGradient id="lastWeekGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#64748b" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#475569" stopOpacity={0.6}/>
                        </linearGradient>
                        <linearGradient id="thisWeekGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.6}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center mt-6 p-4 bg-slate-800/30 rounded-lg">
                  <p className="text-slate-300 text-sm mb-1">주간 증감률</p>
                  <p className={`text-2xl font-bold ${totalChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {totalChange >= 0 ? '+' : ''}{totalChange}%
                  </p>
                  <p className="text-slate-500 text-sm">
                    {totalLastWeek.toLocaleString()} → {totalThisWeek.toLocaleString()} ({totalChangeAbs >= 0 ? '+' : ''}{totalChangeAbs}건)
                  </p>
                </div>
              </ChartCard>

              {/* Segment Comparison Chart */}
              <ChartCard
                title="케어드 vs 마켓"
                subtitle="세그먼트별 분석"
                icon="🏷️"
              >
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: '케어드', 지난주: data.cared.lastWeek.total, 이번주: data.cared.thisWeek.total },
                      { name: '마켓', 지난주: data.market.lastWeek.total, 이번주: data.market.thisWeek.total }
                    ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                          border: '1px solid #334155', 
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)'
                        }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Bar dataKey="지난주" fill="url(#segmentLastGradient)" name="지난주" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="이번주" fill="url(#segmentThisGradient)" name="이번주" radius={[6, 6, 0, 0]} />
                      <defs>
                        <linearGradient id="segmentLastGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#64748b" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#475569" stopOpacity={0.6}/>
                        </linearGradient>
                        <linearGradient id="segmentThisGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.6}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="text-center p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                    <p className="text-blue-400 font-medium text-sm">케어드</p>
                    <p className={`text-lg font-bold ${data.cared.changeRate >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {data.cared.changeRate >= 0 ? '+' : ''}{data.cared.changeRate}%
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg">
                    <p className="text-purple-400 font-medium text-sm">마켓</p>
                    <p className={`text-lg font-bold ${data.market.changeRate >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {data.market.changeRate >= 0 ? '+' : ''}{data.market.changeRate}%
                    </p>
                  </div>
                </div>
              </ChartCard>

            </div>

            {/* AI Processing Pie Chart */}
            <ChartCard
              title="AI vs 상담사 처리 비중"
              subtitle="자동화 효율성 분석"
              icon="🤖"
              fullWidth
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* 지난주 파이차트 */}
                <div className="text-center">
                  <h4 className="text-slate-300 text-lg font-medium mb-4">
                    지난주 ({totalLastWeek.toLocaleString()}건)
                  </h4>
                  <div className="h-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'AI 자동처리', value: data.cared.lastWeek.ai + data.market.lastWeek.ai },
                            { name: '상담사 처리', value: totalLastWeek - (data.cared.lastWeek.ai + data.market.lastWeek.ai) }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          startAngle={90}
                          endAngle={450}
                        >
                          <Cell fill="url(#aiGradient)" />
                          <Cell fill="url(#humanGradient)" />
                        </Pie>
                        <Tooltip formatter={(value) => `${Number(value).toLocaleString()}건`} />
                        <defs>
                          <linearGradient id="aiGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#3730a3" stopOpacity={0.9}/>
                          </linearGradient>
                          <linearGradient id="humanGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#d97706" stopOpacity={0.9}/>
                          </linearGradient>
                        </defs>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">
                          {totalLastWeek > 0 ? Math.round(((data.cared.lastWeek.ai + data.market.lastWeek.ai) / totalLastWeek) * 100) : 0}%
                        </p>
                        <p className="text-xs text-slate-400">AI 처리율</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 이번주 파이차트 */}
                <div className="text-center">
                  <h4 className="text-slate-300 text-lg font-medium mb-4">
                    이번주 ({totalThisWeek.toLocaleString()}건)
                  </h4>
                  <div className="h-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'AI 자동처리', value: totalAiThisWeek },
                            { name: '상담사 처리', value: totalThisWeek - totalAiThisWeek }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          startAngle={90}
                          endAngle={450}
                        >
                          <Cell fill="url(#aiGradient)" />
                          <Cell fill="url(#humanGradient)" />
                        </Pie>
                        <Tooltip formatter={(value) => `${Number(value).toLocaleString()}건`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{totalAiRatio}%</p>
                        <p className="text-xs text-slate-400">AI 처리율</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* AI 비중 요약 */}
              <div className="mt-8 grid grid-cols-2 gap-6">
                <div className="p-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-800/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">지난주 AI 처리율</p>
                      <p className="text-3xl font-bold text-indigo-400">
                        {totalLastWeek > 0 ? Math.round(((data.cared.lastWeek.ai + data.market.lastWeek.ai) / totalLastWeek) * 100) : 0}%
                      </p>
                      <p className="text-sm text-slate-500">
                        {(data.cared.lastWeek.ai + data.market.lastWeek.ai).toLocaleString()}건 자동처리
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">🤖</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-800/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">이번주 AI 처리율</p>
                      <p className="text-3xl font-bold text-indigo-400">{totalAiRatio}%</p>
                      <p className="text-sm text-slate-500">
                        {totalAiThisWeek.toLocaleString()}건 자동처리
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">⚡</span>
                    </div>
                  </div>
                </div>
              </div>
            </ChartCard>

            {/* Segment Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <SegmentSummaryCard
                title="케어드 문의"
                icon="🛠️"
                data={data.cared}
                gradient="from-blue-600 to-cyan-600"
                glowColor="blue-500"
              />
              <SegmentSummaryCard
                title="마켓 문의"
                icon="🏪"
                data={data.market}
                gradient="from-purple-600 to-pink-600"
                glowColor="purple-500"
              />
            </div>
          </div>
        )}

        {/* 케어드 태그 탭 */}
        {activeTab === "cared" && (
          <TagAnalysisTab
            title="케어드 태그 분석"
            icon="🛠️"
            data={data.cared}
            gradient="from-blue-600 to-cyan-600"
            glowColor="blue-500"
          />
        )}

        {/* 마켓 태그 탭 */}
        {activeTab === "market" && (
          <TagAnalysisTab
            title="마켓 태그 분석"
            icon="🏪"
            data={data.market}
            gradient="from-purple-600 to-pink-600"
            glowColor="purple-500"
          />
        )}

        {/* 일별 추이 탭 */}
        {activeTab === "daily" && (
          <DailyAnalysisTab data={data} />
        )}
      </main>
    </div>
  );
}

// Linear-style Metric Card
function MetricCard({ 
  label, 
  value, 
  subtitle, 
  icon, 
  gradient, 
  glowColor 
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  gradient: string;
  glowColor: string;
}) {
  return (
    <div className={`group relative p-6 bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-${glowColor}/20`}>
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300`}></div>
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg shadow-${glowColor}/25`}>
            <span className="text-xl">{icon}</span>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
        
        <div>
          <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
          <p className="text-2xl font-bold text-white mb-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-slate-500 text-xs">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Chart Card
function ChartCard({ 
  title, 
  subtitle, 
  icon, 
  children, 
  fullWidth = false 
}: {
  title: string;
  subtitle?: string;
  icon: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={`bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm rounded-xl p-6 transition-all duration-300 hover:border-slate-700/50 ${fullWidth ? 'col-span-full' : ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
          <span className="text-lg">{icon}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// Enhanced Segment Summary Card
function SegmentSummaryCard({ 
  title, 
  icon, 
  data, 
  gradient, 
  glowColor 
}: {
  title: string;
  icon: string;
  data: SegmentAnalysis;
  gradient: string;
  glowColor: string;
}) {
  const changeAbs = data.thisWeek.total - data.lastWeek.total;
  const aiChange = data.thisWeek.ai - data.lastWeek.ai;
  
  return (
    <div className={`group relative p-6 bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm rounded-xl transition-all duration-300 hover:scale-102 hover:shadow-xl hover:shadow-${glowColor}/20`}>
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 rounded-xl transition-opacity duration-300`}></div>
      
      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg shadow-${glowColor}/25`}>
            <span className="text-xl">{icon}</span>
          </div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-1">이번주</p>
            <p className="text-2xl font-bold text-white">{data.thisWeek.total.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-1">지난주</p>
            <p className="text-2xl font-bold text-slate-400">{data.lastWeek.total.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
            <span className="text-slate-300 text-sm">주간 증감</span>
            <span className={`font-bold text-sm ${changeAbs >= 0 ? "text-red-400" : "text-green-400"}`}>
              {changeAbs >= 0 ? '+' : ''}{changeAbs}건 ({data.changeRate >= 0 ? '+' : ''}{data.changeRate}%)
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
            <span className="text-slate-300 text-sm">AI 자동처리</span>
            <span className="text-indigo-400 font-bold text-sm">
              {data.thisWeek.ai}건 ({data.thisWeek.aiRatio}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Tag Analysis Tab
function TagAnalysisTab({ 
  title, 
  icon, 
  data, 
  gradient, 
  glowColor 
}: {
  title: string;
  icon: string;
  data: SegmentAnalysis;
  gradient: string;
  glowColor: string;
}) {
  const topTags = data.tags.slice(0, 10);
  
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg shadow-${glowColor}/25`}>
            <span className="text-2xl">{icon}</span>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-300 bg-clip-text text-transparent">
            {title}
          </h2>
        </div>
        <p className="text-slate-400">상세 태그별 분석 및 트렌드</p>
      </div>
      
      {/* 요약 메트릭 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <MetricCard
          label="이번주 총 문의"
          value={data.thisWeek.total}
          icon="📞"
          gradient={gradient}
          glowColor={glowColor}
        />
        <MetricCard
          label="지난주 총 문의"
          value={data.lastWeek.total}
          icon="📋"
          gradient="from-slate-600 to-slate-700"
          glowColor="slate-500"
        />
        <MetricCard
          label="주간 증감률"
          value={`${data.changeRate >= 0 ? '+' : ''}${data.changeRate}%`}
          icon={data.changeRate >= 0 ? "📈" : "📉"}
          gradient={data.changeRate >= 0 ? "from-red-600 to-pink-600" : "from-green-600 to-emerald-600"}
          glowColor={data.changeRate >= 0 ? "red-500" : "green-500"}
        />
        <MetricCard
          label="AI 처리율"
          value={`${data.thisWeek.aiRatio}%`}
          subtitle={`${data.thisWeek.ai}건 자동처리`}
          icon="🤖"
          gradient="from-indigo-600 to-purple-600"
          glowColor="indigo-500"
        />
      </div>

      {/* 태그 순위 테이블 */}
      <div className="bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/50 bg-gradient-to-r from-slate-800/30 to-slate-900/30">
          <h3 className="text-lg font-semibold text-white">상위 10개 태그 상세 분석</h3>
          <p className="text-slate-400 text-sm mt-1">클릭율과 처리 효율성 기준</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">순위</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">태그명</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">이번주</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">지난주</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">증감</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">AI 처리</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">효율성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {topTags.map((tag, index) => (
                <tr key={tag.tag} className="hover:bg-slate-800/30 transition-colors duration-200">
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                      index < 3 ? `bg-gradient-to-r ${gradient} text-white shadow-lg shadow-${glowColor}/25` : 'bg-slate-700 text-slate-300'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-white max-w-xs">
                    <div className="truncate">{tag.tag}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className="font-semibold text-white">{tag.thisWeek.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-slate-400">
                    {tag.lastWeek.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                      tag.change > 0 ? 'bg-red-900/30 text-red-400 border border-red-800/30' : 
                      tag.change < 0 ? 'bg-green-900/30 text-green-400 border border-green-800/30' : 
                      'bg-slate-800/30 text-slate-400 border border-slate-700/30'
                    }`}>
                      {tag.change > 0 ? '+' : ''}{tag.change}
                      <span className="text-xs opacity-70">
                        ({tag.changeRate > 0 ? '+' : ''}{tag.changeRate}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <div className="text-indigo-400 font-semibold">
                      {tag.aiCount.toLocaleString()}
                      <div className="text-xs text-slate-400 mt-1">
                        {tag.aiRatio}%
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <div className={`inline-flex items-center w-3 h-3 rounded-full ${
                      tag.aiRatio >= 70 ? 'bg-green-400' :
                      tag.aiRatio >= 40 ? 'bg-yellow-400' :
                      'bg-red-400'
                    }`}></div>
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

// Daily Analysis Tab (simplified for now)
function DailyAnalysisTab({ data }: { data: ApiData }) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-300 bg-clip-text text-transparent mb-3">
          일별 상담 추이
        </h2>
        <p className="text-slate-400">시간대별 상담 인입 패턴 분석</p>
      </div>
      
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">📈</span>
        </div>
        <p className="text-slate-400 text-lg">일별 데이터 수집 중</p>
        <p className="text-slate-500 text-sm mt-2">곧 상세한 일별 분석 데이터를 제공할 예정입니다</p>
      </div>
    </div>
  );
}