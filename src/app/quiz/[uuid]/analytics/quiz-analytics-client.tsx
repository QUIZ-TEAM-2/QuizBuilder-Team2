"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
} from "recharts";
import type {
  NameType,
  Payload,
} from "recharts/types/component/DefaultTooltipContent";

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

type RankingStackedRow = {
  itemLabel: string;
  itemLabelFull: string;
} & Record<string, number | string>;

type RangePreset = "7" | "30" | "90";

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

function toCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

type DateRange =
  | { mode: "preset"; preset: RangePreset }
  | { mode: "custom"; startYmd: string; endYmd: string };

function ymdToUtcStartMs(ymd: string): number {
  const [yRaw, mRaw, dRaw] = ymd.split("-");
  const y = Number.parseInt(yRaw ?? "", 10);
  const m = Number.parseInt(mRaw ?? "", 10);
  const d = Number.parseInt(dRaw ?? "", 10);
  const yy = Number.isFinite(y) ? y : 1970;
  const mm = Number.isFinite(m) ? m : 1;
  const dd = Number.isFinite(d) ? d : 1;
  return Date.UTC(yy, mm - 1, dd, 0, 0, 0, 0);
}

function ymdToUtcEndMs(ymd: string): number {
  const [yRaw, mRaw, dRaw] = ymd.split("-");
  const y = Number.parseInt(yRaw ?? "", 10);
  const m = Number.parseInt(mRaw ?? "", 10);
  const d = Number.parseInt(dRaw ?? "", 10);
  const yy = Number.isFinite(y) ? y : 1970;
  const mm = Number.isFinite(m) ? m : 1;
  const dd = Number.isFinite(d) ? d : 1;
  return Date.UTC(yy, mm - 1, dd, 23, 59, 59, 999);
}

function todayUtcYmd(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoUtcYmd(daysAgo: number): string {
  const now = Date.now();
  return toYmd(now - daysAgo * 24 * 60 * 60 * 1000);
}

function truncateLabel(label: string, maxLength = 28): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

function useDateRange(range: DateRange) {
  return useMemo(() => {
    if (range.mode === "custom") {
      const startMs = ymdToUtcStartMs(range.startYmd);
      const endMs = ymdToUtcEndMs(range.endYmd);
      return { startMs, endMs };
    }
    const endMs = Date.now();
    const days = range.preset === "7" ? 7 : range.preset === "30" ? 30 : 90;
    const startMs = endMs - days * 24 * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [range]);
}

export default function QuizAnalyticsClient({
  quizUuid,
}: {
  quizUuid: string;
}) {
  const quizId = quizUuid as Id<"quiz">;

  const user = useQuery(api.auth.currentUser);
  const isAdmin = user?.role === "admin";
  const canAccess = useQuery(api.analytics.canAccessCreatorQuiz, { quizId });

  const [range, setRange] = useState<DateRange>({
    mode: "preset",
    preset: "7",
  });
  const { startMs, endMs } = useDateRange(range);
  const isCustom = range.mode === "custom";
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const selectedQuizVersion =
    versionFilter === "all" ? undefined : Number.parseInt(versionFilter, 10);
  const quizVersion =
    selectedQuizVersion !== undefined && Number.isFinite(selectedQuizVersion)
      ? selectedQuizVersion
      : undefined;
  const isAllVersions = quizVersion === undefined;
  const versionArgs = quizVersion === undefined ? {} : { quizVersion };

  const quizVersions = useQuery(
    api.analytics.getCreatorQuizVersions,
    canAccess ? { quizId, startMs, endMs } : "skip",
  );

  const kpis = useQuery(
    api.analytics.getCreatorKpis,
    canAccess ? { quizId, startMs, endMs, ...versionArgs } : "skip",
  );
  const trend = useQuery(
    api.analytics.getCreatorTrend,
    canAccess ? { quizId, startMs, endMs, ...versionArgs } : "skip",
  );
  const resultDist = useQuery(
    api.analytics.getCreatorResultDistribution,
    canAccess ? { quizId, startMs, endMs, ...versionArgs } : "skip",
  );
  const languageDist = useQuery(
    api.analytics.getCreatorLanguageDistribution,
    canAccess ? { quizId, startMs, endMs, ...versionArgs } : "skip",
  );
  const questionStats = useQuery(
    api.analytics.getCreatorQuestionStats,
    canAccess && !isAllVersions
      ? { quizId, startMs, endMs, quizVersion }
      : "skip",
  );

  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [resultFilter, setResultFilter] = useState<string>("all");
  const sessions = useQuery(
    api.analytics.getCreatorSessionsTable,
    canAccess
      ? {
        quizId,
        startMs,
        endMs,
        page,
        pageSize,
        resultPageId: resultFilter === "all" ? undefined : resultFilter,
        ...versionArgs,
      }
      : "skip",
  );
  const sessionsCsvData = useQuery(
    api.analytics.getCreatorSessionsCsvData,
    canAccess
      ? {
        quizId,
        startMs,
        endMs,
        resultPageId: resultFilter === "all" ? undefined : resultFilter,
        ...versionArgs,
      }
      : "skip",
  );

  const quiz = useQuery(api.quiz.getQuiz, { id: quizId });
  const [lastKpis, setLastKpis] = useState<typeof kpis>();
  const [lastTrend, setLastTrend] = useState<typeof trend>();
  const [lastResultDist, setLastResultDist] = useState<typeof resultDist>();
  const [lastLanguageDist, setLastLanguageDist] =
    useState<typeof languageDist>();
  const [lastQuestionStats, setLastQuestionStats] =
    useState<typeof questionStats>();
  const [lastSessions, setLastSessions] = useState<typeof sessions>();

  useEffect(() => {
    if (kpis !== undefined) setLastKpis(kpis);
  }, [kpis]);
  useEffect(() => {
    if (trend !== undefined) setLastTrend(trend);
  }, [trend]);
  useEffect(() => {
    if (resultDist !== undefined) setLastResultDist(resultDist);
  }, [resultDist]);
  useEffect(() => {
    if (languageDist !== undefined) setLastLanguageDist(languageDist);
  }, [languageDist]);
  useEffect(() => {
    if (questionStats !== undefined) setLastQuestionStats(questionStats);
  }, [questionStats]);
  useEffect(() => {
    if (sessions !== undefined) setLastSessions(sessions);
  }, [sessions]);

  const effectiveKpis = kpis ?? lastKpis;
  const effectiveTrend = trend ?? lastTrend;
  const effectiveResultDist = resultDist ?? lastResultDist ?? [];
  const effectiveLanguageDist = languageDist ?? lastLanguageDist;
  const effectiveQuestionStats = isAllVersions
    ? undefined
    : (questionStats ?? lastQuestionStats);
  const effectiveSessions = sessions ?? lastSessions;
  const isRefreshing =
    canAccess === true &&
    (!!lastKpis || !!lastSessions) &&
    (kpis === undefined ||
      trend === undefined ||
      resultDist === undefined ||
      languageDist === undefined ||
      (!isAllVersions && questionStats === undefined) ||
      sessions === undefined);

  const trendData = useMemo(() => {
    if (!effectiveTrend) return [];
    return effectiveTrend.map((d) => ({
      day: toYmd(d.dayStartMs),
      views: d.views,
    }));
  }, [effectiveTrend]);

  const resultData = useMemo(() => {
    return effectiveResultDist.map((r) => ({ name: r.name, value: r.count }));
  }, [effectiveResultDist]);

  const languageData = useMemo(() => {
    if (!effectiveLanguageDist) return [];
    return effectiveLanguageDist.map((r) => ({
      name: r.label,
      value: r.count,
    }));
  }, [effectiveLanguageDist]);

  const questionCharts = useMemo(() => {
    if (!effectiveQuestionStats) return [];
    type BarBlock = {
      kind: "bar";
      key: string;
      pageName: string;
      answers: { answer: string; answerFull: string; count: number }[];
    };
    type ScatterBlock = {
      kind: "scatter";
      key: string;
      pageName: string;
      title: string;
      points: { x: number; y: number }[];
    };
    type RankingStackedBlock = {
      kind: "rankingStacked";
      key: string;
      pageName: string;
      title: string;
      data: RankingStackedRow[];
      positionKeys: string[];
      sampleSize: number;
    };
    const out: (BarBlock | ScatterBlock | RankingStackedBlock)[] = [];
    for (const q of effectiveQuestionStats) {
      for (const s of q.sliders ?? []) {
        if (!s.points?.length) continue;
        out.push({
          kind: "scatter",
          key: `scatter-${q.pageId}-${String(s.answerBoxId)}`,
          pageName: q.pageName,
          title: q.pageName,
          points: s.points.map((p) => ({ x: p.segmentIndex, y: p.count })),
        });
      }
      for (const ranking of (q as any).rankings ?? []) {
        const positionCount =
          typeof ranking.positionCount === "number" &&
            Number.isFinite(ranking.positionCount) &&
            ranking.positionCount > 0
            ? Math.round(ranking.positionCount)
            : 0;
        if (positionCount <= 0 || !Array.isArray(ranking.items)) continue;
        const positionKeys = Array.from(
          { length: positionCount },
          (_, idx) => `pos${idx + 1}`,
        );
        const sampleSize = ranking.items.reduce((max: number, item: any) => {
          const total =
            typeof item?.total === "number" && Number.isFinite(item.total)
              ? item.total
              : 0;
          return Math.max(max, total);
        }, 0);
        const rows = ranking.items
          .slice(0, 12)
          .map((item: any) => {
            const fullLabel =
              typeof item?.label === "string" && item.label.trim().length > 0
                ? item.label.trim()
                : String(item?.itemId ?? "Unknown");
            const total =
              typeof item?.total === "number" && Number.isFinite(item.total)
                ? item.total
                : 0;
            const row: RankingStackedRow = {
              itemLabel: truncateLabel(fullLabel),
              itemLabelFull: fullLabel,
            };
            for (let idx = 0; idx < positionCount; idx += 1) {
              const positionIndex = idx;
              const point = Array.isArray(item?.positions)
                ? item.positions.find(
                  (p: any) =>
                    typeof p?.positionIndex === "number" &&
                    p.positionIndex === positionIndex,
                )
                : null;
              const count =
                typeof point?.count === "number" && Number.isFinite(point.count)
                  ? point.count
                  : 0;
              row[`pos${idx + 1}`] = total > 0 ? (count / total) * 100 : 0;
            }
            return row;
          })
          .filter((row: RankingStackedRow) =>
            positionKeys.some(
              (k) =>
                typeof row[k] === "number" && Number.isFinite(row[k] as number),
            ),
          );
        if (rows.length === 0) continue;
        out.push({
          kind: "rankingStacked",
          key: `ranking-${q.pageId}-${String(ranking.answerBoxId)}`,
          pageName: q.pageName,
          title: q.pageName,
          data: rows,
          positionKeys,
          sampleSize,
        });
      }
      const barAnswers = q.answers.slice(0, 12).map((a) => {
        const answerFull = a.answerLabel ?? a.answerBoxId;
        return {
          answer: truncateLabel(answerFull, 26),
          answerFull,
          count: a.count,
        };
      });
      if (barAnswers.length > 0) {
        out.push({
          kind: "bar",
          key: `bar-${q.pageId}`,
          pageName: q.pageName,
          answers: barAnswers,
        });
      }
    }
    return out;
  }, [effectiveQuestionStats]);

  if (user === undefined || canAccess === undefined || quiz === undefined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-6">
          <div className="text-base font-semibold text-slate-900">
            Sign in required
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Sign in to view quiz analytics.
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/">
              <Button>Go to home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-6">
          <div className="text-base font-semibold text-slate-900">
            Access denied
          </div>
          <div className="mt-1 text-sm text-slate-600">
            This quiz is not available.
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard/quizzes">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            <Link href="/quiz">
              <Button>Back to editor</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveKpis || !effectiveSessions) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(effectiveSessions.total / pageSize));

  const handleDownloadSessionsCsv = () => {
    if (!sessionsCsvData) return;
    const headers = ["Start Time", "Version", "Duration", "Result"];
    for (let i = 0; i < sessionsCsvData.questionCount; i += 1) {
      const pageName = sessionsCsvData.pageNames?.[i] ?? `Page ${i + 1}`;
      headers.push(`Q${i + 1}: ${pageName}`);
    }

    const lines = [headers.map((h) => toCsvCell(h)).join(",")];
    for (const row of sessionsCsvData.rows) {
      const values: Array<string | number | null> = [
        new Date(row.startedAt).toLocaleString(),
        `Version ${row.quizVersion}`,
        msToHuman(row.durationMs),
        row.resultName ?? row.resultAnimal ?? "—",
      ];
      for (const ans of row.answers) values.push(ans);
      lines.push(values.map((v) => toCsvCell(v)).join(","));
    }

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions-${quizUuid}-${toYmd(startMs)}-to-${toYmd(endMs)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {quiz?.title ?? "Quiz"} Analytics
            </h1>
            <p className="text-sm text-slate-500">
              Metrics are based on quiz sessions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={isAdmin ? "/admin/dashboard" : "/dashboard/quizzes"}>
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            <Link href="/quiz">
              <Button variant="outline">Back to editor</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-6 py-5">
        <div className="flex items-center justify-between">
          <Tabs
            value={range.mode === "preset" ? range.preset : "custom"}
            onValueChange={(v) => {
              setPage(0);
              setResultFilter("all");
              setVersionFilter("all");
              if (v === "custom") {
                setRange({
                  mode: "custom",
                  startYmd: daysAgoUtcYmd(7),
                  endYmd: todayUtcYmd(),
                });
              } else {
                setRange({ mode: "preset", preset: v as RangePreset });
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="7">Last 7 days</TabsTrigger>
              <TabsTrigger value="30">Last 30 days</TabsTrigger>
              <TabsTrigger value="90">Last 90 days</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Select
              value={versionFilter}
              onValueChange={(v) => {
                setVersionFilter(v);
                setResultFilter("all");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="All versions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All versions</SelectItem>
                {(quizVersions ?? []).map((version) => (
                  <SelectItem
                    key={version.version}
                    value={String(version.version)}
                  >
                    {version.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-slate-500">
              {toYmd(startMs)} ~ {toYmd(endMs)}
            </div>
          </div>
        </div>
        {isRefreshing ? (
          <div className="text-xs text-slate-500">Updating data...</div>
        ) : null}

        {isCustom ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Custom date range (UTC)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Start</div>
                <Input
                  type="date"
                  value={(range as any).startYmd}
                  onChange={(e) =>
                    setRange((r) =>
                      r.mode === "custom"
                        ? { ...r, startYmd: e.target.value }
                        : r,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">End</div>
                <Input
                  type="date"
                  value={(range as any).endYmd}
                  onChange={(e) =>
                    setRange((r) =>
                      r.mode === "custom"
                        ? { ...r, endYmd: e.target.value }
                        : r,
                    )
                  }
                />
              </div>
              <div className="flex-1" />
            </CardContent>
          </Card>
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
              <div className="text-xs text-slate-500">
                Completed sessions only
              </div>
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
            <div className="text-sm font-semibold text-slate-900">
              Detail Analysis
            </div>
            <div className="text-xs text-slate-500">Pie charts and trends</div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Result Distribution</CardTitle>
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

        <section className="grid grid-cols-1 gap-3">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Sessions</CardTitle>
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={
                    !sessionsCsvData || sessionsCsvData.rows.length === 0
                  }
                  onClick={handleDownloadSessionsCsv}
                >
                  Download CSV
                </Button>
                <p className="text-xs text-slate-500">
                  For more details, please download the full file.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-slate-500">Result filter</div>
                <Select
                  value={resultFilter}
                  onValueChange={(v) => {
                    setResultFilter(v);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[260px] bg-white">
                    <SelectValue placeholder="All results" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All results</SelectItem>
                    {effectiveResultDist.map((r) => (
                      <SelectItem key={r.resultPageId} value={r.resultPageId}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2">Start Time</th>
                      <th className="py-2">Version</th>
                      <th className="py-2">Duration</th>
                      <th className="py-2">Result</th>
                      <th className="py-2">Language</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveSessions.items.map((row) => (
                      <tr key={row.sessionId} className="border-t">
                        <td className="py-2">
                          {new Date(row.startedAt).toLocaleString()}
                        </td>
                        <td className="py-2">Version {row.quizVersion}</td>
                        <td className="py-2">{msToHuman(row.durationMs)}</td>
                        <td className="py-2">
                          {(row as any).resultName ?? "—"}
                        </td>
                        <td className="py-2">{(row as any).language ?? "—"}</td>
                      </tr>
                    ))}
                    {effectiveSessions.items.length === 0 ? (
                      <tr>
                        <td
                          className="py-6 text-center text-slate-500"
                          colSpan={4}
                        >
                          No sessions in range
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {effectiveSessions.total} sessions
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Prev
                  </Button>
                  <div className="text-xs text-slate-600">
                    {page + 1} / {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data by question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAllVersions ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
                  Select a specific version to view question-level analytics.
                  Questions can be added, reordered, or changed between
                  versions, so All versions only shows stable aggregate metrics.
                </div>
              ) : questionCharts.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No question response data in range
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {questionCharts.map((block) => (
                    <Card key={block.key} className="shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          {block.kind === "scatter"
                            ? block.title
                            : block.kind === "rankingStacked"
                              ? block.title
                              : block.pageName}
                        </CardTitle>
                        {block.kind === "scatter" &&
                          block.title !== block.pageName ? (
                          <p className="text-xs text-slate-500">
                            {block.pageName}
                          </p>
                        ) : null}
                      </CardHeader>
                      <CardContent className="h-72">
                        {block.kind === "bar" ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={block.answers}
                              layout="vertical"
                              margin={{
                                top: 8,
                                right: 16,
                                bottom: 8,
                                left: 24,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" allowDecimals={false} />
                              <YAxis
                                type="category"
                                dataKey="answer"
                                width={196}
                                tick={{ fontSize: 12 }}
                              />
                              <Tooltip
                                labelFormatter={(
                                  label: string | number,
                                  payload: Payload<string | number, NameType>[],
                                ) => {
                                  const full =
                                    payload?.[0] &&
                                      typeof payload[0].payload?.answerFull ===
                                      "string"
                                      ? payload[0].payload.answerFull
                                      : String(label);
                                  return full;
                                }}
                              />
                              <Bar dataKey="count" fill="#2563eb" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : block.kind === "scatter" ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart
                              margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                type="number"
                                dataKey="x"
                                domain={["dataMin", "dataMax"]}
                                name="Tick"
                                tick={{ fontSize: 11 }}
                                allowDecimals={false}
                                label={{
                                  value: "Slider tick",
                                  position: "insideBottom",
                                  offset: -4,
                                  fontSize: 11,
                                  fill: "#64748b",
                                }}
                                tickFormatter={(n) =>
                                  typeof n === "number" && Number.isFinite(n)
                                    ? String(Math.round(n))
                                    : String(n)
                                }
                              />
                              <YAxis
                                type="number"
                                dataKey="y"
                                name="Count"
                                allowDecimals={false}
                                tick={{ fontSize: 11 }}
                                width={44}
                                label={{
                                  value: "Responses num",
                                  angle: -90,
                                  position: "insideLeft",
                                  offset: 8,
                                  fontSize: 11,
                                  fill: "#64748b",
                                }}
                              />
                              <Tooltip
                                cursor={{ strokeDasharray: "3 3" }}
                                formatter={(
                                  v: number | string,
                                  name: string,
                                ) => {
                                  if (name === "Count" || name === "y")
                                    return [
                                      typeof v === "number"
                                        ? String(Math.round(v))
                                        : String(v),
                                      "Count",
                                    ];
                                  return [
                                    typeof v === "number"
                                      ? String(Math.round(v))
                                      : String(v),
                                    "Tick",
                                  ];
                                }}
                                labelFormatter={(x) =>
                                  typeof x === "number" && Number.isFinite(x)
                                    ? `Tick: ${Math.round(x)}`
                                    : String(x)
                                }
                              />
                              <Scatter data={block.points} fill="#2563eb" />
                            </ScatterChart>
                          </ResponsiveContainer>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={block.data}
                              layout="vertical"
                              margin={{
                                top: 8,
                                right: 16,
                                bottom: 8,
                                left: 16,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                type="number"
                                domain={[0, 100]}
                                tickFormatter={(v) =>
                                  typeof v === "number"
                                    ? `${Math.round(v)}%`
                                    : ""
                                }
                              />
                              <YAxis
                                type="category"
                                dataKey="itemLabel"
                                width={216}
                                tick={{ fontSize: 12 }}
                              />
                              <Tooltip
                                formatter={(value: number | string, name) => {
                                  const percentage =
                                    typeof value === "number"
                                      ? `${Math.round(value * 10) / 10}%`
                                      : String(value);
                                  const positionName =
                                    typeof name === "string" &&
                                      name.startsWith("pos")
                                      ? `Rank ${name.slice(3)}`
                                      : String(name);
                                  return [percentage, positionName];
                                }}
                                labelFormatter={(
                                  label: string | number,
                                  payload: Payload<string | number, NameType>[],
                                ) => {
                                  const full =
                                    payload?.[0] &&
                                      typeof payload[0].payload?.itemLabelFull ===
                                      "string"
                                      ? payload[0].payload.itemLabelFull
                                      : String(label);
                                  return full;
                                }}
                              />
                              <Legend
                                formatter={(value) =>
                                  typeof value === "string" &&
                                    value.startsWith("pos")
                                    ? `Rank ${value.slice(3)}`
                                    : String(value)
                                }
                              />
                              {block.positionKeys.map((key, index) => (
                                <Bar
                                  key={key}
                                  dataKey={key}
                                  stackId="ranking"
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <div
                className={isAllVersions ? "hidden" : "text-xs text-slate-500"}
              >
                Note: option text is preferred; if missing, it falls back to the
                answer component ID. Slider charts use tick index on the X axis
                (0…divisions — same scoring values as play).
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
