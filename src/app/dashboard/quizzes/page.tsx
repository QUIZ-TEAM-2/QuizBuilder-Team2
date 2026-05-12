"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import ConvexUserButton from "@/components/auth/convex-user-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#64748b",
];

function msToHuman(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r}s`;
}

function toYmd(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function languageLabel(language: "en" | "cn" | null): string {
  if (language === "en") return "English";
  if (language === "cn") return "Chinese";
  return "—";
}
import { getQuizStatusLabel } from "@/lib/quiz-access-rules";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

type RangePreset = "7" | "30" | "90";

function useDateRange(preset: RangePreset) {
  return useMemo(() => {
    const endMs = Date.now();
    const days = preset === "7" ? 7 : preset === "30" ? 30 : 90;
    const startMs = endMs - days * 24 * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [preset]);
}

export default function DashboardQuizzesPage() {
  const [preset, setPreset] = useState<RangePreset>("7");
  const { startMs, endMs } = useDateRange(preset);

  const kpis = useQuery(api.analytics.getCreatorKpis, { startMs, endMs });
  const trend = useQuery(api.analytics.getCreatorTrend, { startMs, endMs });
  const quizDist = useQuery(api.analytics.getCreatorQuizDistribution, {
    startMs,
    endMs,
  });
  const languageDist = useQuery(api.analytics.getCreatorLanguageDistribution, {
    startMs,
    endMs,
  });
  const sessions = useQuery(api.analytics.getCreatorSessionsTable, {
    startMs,
    endMs,
    page: 0,
    pageSize: 20,
    resultPageId: undefined,
  });

  const quizzesQuery = useQuery(api.analytics.getCreatorQuizzes);
  const quizzes = useMemo(() => {
    const list = (quizzesQuery ?? []) as Array<{
      _id: string;
      title: string;
      status: Parameters<typeof getQuizStatusLabel>[0];
      _creationTime: number;
    }>;
    return [...list].sort((a, b) => (b?._creationTime ?? 0) - (a?._creationTime ?? 0));
  }, [quizzesQuery]);

  const listLoading = quizzesQuery === undefined;

  const [lastKpis, setLastKpis] = useState<typeof kpis>();
  const [lastTrend, setLastTrend] = useState<typeof trend>();
  const [lastQuizDist, setLastQuizDist] = useState<typeof quizDist>();
  const [lastLanguageDist, setLastLanguageDist] = useState<typeof languageDist>();
  const [lastSessions, setLastSessions] = useState<typeof sessions>();

  useEffect(() => {
    if (kpis !== undefined) setLastKpis(kpis);
  }, [kpis]);
  useEffect(() => {
    if (trend !== undefined) setLastTrend(trend);
  }, [trend]);
  useEffect(() => {
    if (quizDist !== undefined) setLastQuizDist(quizDist);
  }, [quizDist]);
  useEffect(() => {
    if (languageDist !== undefined) setLastLanguageDist(languageDist);
  }, [languageDist]);
  useEffect(() => {
    if (sessions !== undefined) setLastSessions(sessions);
  }, [sessions]);

  const effectiveKpis = kpis ?? lastKpis;
  const effectiveTrend = trend ?? lastTrend;
  const effectiveQuizDist = quizDist ?? lastQuizDist;
  const effectiveLanguageDist = languageDist ?? lastLanguageDist;
  const effectiveSessions = sessions ?? lastSessions;
  const isRefreshing =
    (!!lastKpis || !!lastSessions) &&
    (kpis === undefined ||
      trend === undefined ||
      quizDist === undefined ||
      languageDist === undefined ||
      sessions === undefined);

  const trendData = useMemo(() => {
    if (!effectiveTrend) return [];
    return effectiveTrend.map((d) => ({
      day: toYmd(d.dayStartMs),
      views: d.views,
    }));
  }, [effectiveTrend]);

  const resultData = useMemo(() => {
    if (!effectiveQuizDist) return [];
    return effectiveQuizDist.map((r) => ({ name: r.title, value: r.count }));
  }, [effectiveQuizDist]);

  const languageData = useMemo(() => {
    if (!effectiveLanguageDist) return [];
    return effectiveLanguageDist.map((r) => ({ name: r.label, value: r.count }));
  }, [effectiveLanguageDist]);

  if (!effectiveKpis || !effectiveSessions) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Metrics for your quizzes only, based on play sessions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link href="/quiz">
              <Button variant="outline">Back to editor</Button>
            </Link>
            <ConvexUserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
            <TabsList>
              <TabsTrigger value="7">Last 7 days</TabsTrigger>
              <TabsTrigger value="30">Last 30 days</TabsTrigger>
              <TabsTrigger value="90">Last 90 days</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="text-xs text-slate-500">
            {toYmd(startMs)} ~ {toYmd(endMs)}
          </div>
        </div>
        {isRefreshing ? (
          <div className="text-xs text-slate-500">Updating data...</div>
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Average Game Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">
                {msToHuman(effectiveKpis.averageGameTimeMs)}
              </div>
              <div className="text-xs text-slate-500">Completed sessions only</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Number of Views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">
                {effectiveKpis.views}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Users Started Game
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">
                {effectiveKpis.startedSessions}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                Users Finished Game
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">
                {effectiveKpis.finishedSessions}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Detail Analysis</div>
            <div className="text-xs text-slate-500">Pie charts and trends</div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quiz Submission Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {resultData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No completed sessions in range
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={resultData}
                        dataKey="value"
                        nameKey="name"
                        cx="40%"
                        cy="50%"
                        outerRadius={85}
                      >
                        {resultData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Language Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {languageData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No completed sessions in range
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={languageData}
                        dataKey="value"
                        nameKey="name"
                        cx="40%"
                        cy="50%"
                        outerRadius={85}
                      >
                        {languageData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">User Views Per Date</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sessions (latest 20)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Start Time</th>
                    <th className="py-2">Duration</th>
                    <th className="py-2">Language</th>
                    <th className="py-2">Result</th>
                    <th className="py-2">Quiz</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveSessions.items.map((row) => (
                    <tr
                      key={`${String(row.quizId)}-${row.sessionId}`}
                      className="border-t"
                    >
                      <td className="py-2">{new Date(row.startedAt).toLocaleString()}</td>
                      <td className="py-2">{msToHuman(row.durationMs)}</td>
                      <td className="py-2">{languageLabel(row.language)}</td>
                      <td className="py-2">{row.resultName ?? "—"}</td>
                      <td className="py-2 text-slate-600">{row.quizTitle}</td>
                    </tr>
                  ))}
                  {effectiveSessions.items.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-slate-500" colSpan={5}>
                        No sessions in range
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">All quizzes</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Newest first. Click a row for full analytics.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Back to summary
              </Button>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading…</div>
              ) : quizzes.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  You have not created any quizzes yet.
                </div>
              ) : (
                <div className="divide-y rounded-md border bg-white">
                  {quizzes.map((q) => (
                    <Link
                      key={q._id}
                      href={`/quiz/${q._id}/analytics`}
                      className="block px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{q.title}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Created: {formatDate(q._creationTime)}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-slate-600">
                          {getQuizStatusLabel(q.status)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
