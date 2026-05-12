"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import ConvexUserButton from "@/components/auth/convex-user-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, CircleHelp, PieChart, TrendingUp } from "lucide-react";

const MIN_VOLUME_FOR_COMPARE_PCT = 3;

function msToHuman(ms: number | null): string {
  if (ms == null) return "N/A";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r}s`;
}

function formatPercent(ratio: number | null): string {
  if (ratio == null) return "N/A";
  const pct = Math.round(ratio * 1000) / 10;
  if (!Number.isFinite(pct)) return "N/A";
  return `${pct}%`;
}

/** One decimal place, for funnel / conversion display */
function formatPctOneDecimal(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return "Not available";
  const pct = Math.round(ratio * 10000) / 100;
  return `${pct.toFixed(1)}%`;
}

function toYmd(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toYm(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function bucketLabel(bucketStartMs: number, intervalMs: number): string {
  // Monthly-ish buckets should read as YYYY-MM; otherwise YYYY-MM-DD.
  return intervalMs >= 27 * 24 * 60 * 60 * 1000 ? toYm(bucketStartMs) : toYmd(bucketStartMs);
}

type RangePreset = "7" | "30" | "all";

/** Range passed to every admin analytics query; `all` uses startMs === 0 (open lower bound server-side). */
function useDateRange(preset: RangePreset) {
  return useMemo(() => {
    const endMs = Date.now();
    const startMs =
      preset === "all"
        ? 0
        : endMs - (preset === "7" ? 7 : 30) * 24 * 60 * 60 * 1000;
    return { startMs, endMs };
  }, [preset]);
}

/** Keeps last loaded query data while args change so the dashboard does not flash a full skeleton. */
function useStickyQueryResult<T>(value: T | undefined): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  if (value !== undefined) ref.current = value;
  return value ?? ref.current;
}

function formatMetric(v: number | null | undefined): string {
  if (v == null) return "N/A";
  if (!Number.isFinite(v)) return "N/A";
  return String(Math.round(v));
}

/** Tooltip copy aligned with former Metric Definitions panel. */
const METRIC_HELP = {
  designerAccount:
    "Designer metrics include every account that can own quizzes, including admin accounts.",
  activeDesigner:
    "A designer/admin account that created, updated, or published at least one quiz in the rolling 7-day or 30-day window (through the filter end date); not based on logins alone.",
  completionRate: "Completions divided by quiz starts in the selected range.",
  dropOffRate: "One minus completion rate (same denominator: starts).",
  averageTimeSpent:
    "Average duration of completed quiz sessions in the selected range.",
  leadConversionRate:
    "Leads (quizLeads) divided by completed sessions in range.",
  ctr:
    "CTR is calculated as CTA clicks divided by result-page views when result-page view data is available. If not, completions are used as the fallback denominator.",
  quizViews:
    "Count of quiz view events (landing / play impressions) in the selected range.",
  playCount:
    "Total Play Count represents the number of quiz sessions started in the selected range.",
  quizStarts:
    "Quiz Starts uses the same start-session event in the current implementation and is kept as a separate metric to align with the client analytics requirements.",
  quizCompletions: "Quiz sessions completed in the selected range.",
  avgQuizzesPerUser:
    "Starts divided by distinct participant keys (logged-in userId when present, otherwise sessionId).",
  totalLeads:
    "Rows in quizLeads with createdAt in the selected range (from play lead capture).",
  ctaClicks:
    "CTA click means a user clicks a call-to-action button or external link on the quiz result page, such as Visit Website, Instagram, Book Now, Buy Now, Contact Us, or Learn More.",
  funnelOverview:
    "Views → Starts → Completions → Leads → CTA clicks, counted in the selected range from quizEvents, quizSessions, and quizLeads.",
  leadSectionOverview:
    "Total leads: rows in quizLeads in the selected range. Lead conversion: leads divided by completed sessions. CTA and CTR definitions match the help icons on those KPIs.",
  contentPerformanceOverview:
    "Play count column = session starts in range. Quiz views = view events. Completion rate, lead conversion, and CTR use the same definitions as the engagement and lead KPI cards.",
  conversionTrendLines:
    "Completion rate: completions divided by starts per bucket. Lead conversion: leads divided by completions per bucket. CTR: CTA clicks divided by result page views, or by completions when views are missing.",
} as const;

function MetricHelpPopover({
  ariaLabel,
  text,
  richContent,
}: {
  ariaLabel: string;
  text?: string;
  richContent?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
          aria-label={ariaLabel}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => {
            e.preventDefault();
            setOpen((v) => !v);
          }}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] text-xs leading-relaxed text-slate-700"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {richContent ?? text}
      </PopoverContent>
    </Popover>
  );
}

function DashboardContentSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard metrics">
      <div className="h-16 animate-pulse rounded-xl border border-slate-200/80 bg-slate-100/90" />
      <div className="h-40 animate-pulse rounded-xl border border-slate-200/80 bg-slate-100/90" />
      <div className="h-56 animate-pulse rounded-xl border border-slate-200/80 bg-slate-100/90" />
      <div className="h-36 animate-pulse rounded-xl border border-slate-200/80 bg-slate-100/90" />
      <div className="h-48 animate-pulse rounded-xl border border-slate-200/80 bg-slate-100/90" />
      <div className="h-44 animate-pulse rounded-xl border border-slate-200/80 bg-slate-100/90" />
    </div>
  );
}

function DashboardLayoutFrame({
  preRangeContent,
  rangeBar,
  children,
}: {
  preRangeContent?: ReactNode;
  rangeBar: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Monitor platform growth, quiz engagement, and conversion performance across the
              selected time range.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/quiz">
              <Button variant="outline">Back to editor</Button>
            </Link>
            <ConvexUserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-6 py-4">
        {preRangeContent}
        {rangeBar}
        {children}
      </div>
    </main>
  );
}

function NaBlock({ reason }: { reason: string }) {
  return (
    <div className="rounded-md border border-slate-100/90 bg-slate-50/70 px-2 py-1.5">
      <div className="text-[11px] font-medium text-slate-400">No data</div>
      <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{reason}</div>
    </div>
  );
}

function RateBar({
  label,
  value,
  color,
  valueLabel,
}: {
  label: string;
  value: number | null | undefined; // ratio 0..1
  color: string;
  valueLabel: string;
}) {
  const pct = value != null && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
  return (
    <div className="rounded-md border border-slate-100 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-600">{label}</div>
        <div className="text-xs font-semibold tabular-nums text-slate-900">{valueLabel}</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/90">
        {pct != null ? (
          <div className="h-2 rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  aside,
  titleHelp,
}: {
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  titleHelp?: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          {titleHelp ? (
            <MetricHelpPopover ariaLabel={`${title} definition`} text={titleHelp} />
          ) : null}
        </div>
        {subtitle ? <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      </div>
      {aside ? <div className="shrink-0 text-xs text-slate-500">{aside}</div> : null}
    </div>
  );
}

function DashboardSummaryStrip({
  newDesignersInRange,
  hasEngagementData,
  quizViews,
  quizStarts,
  quizCompletions,
  totalLeads,
  ctaClicks,
}: {
  newDesignersInRange: number;
  hasEngagementData: boolean;
  quizViews: number;
  quizStarts: number;
  quizCompletions: number;
  totalLeads: number;
  ctaClicks: number;
}) {
  const growth =
    newDesignersInRange > 0
      ? `${newDesignersInRange} new designer${newDesignersInRange === 1 ? "" : "s"} in selected range`
      : "Limited activity in selected range";

  const engagementLine = hasEngagementData
    ? `${formatMetric(quizViews)} views · ${formatMetric(quizStarts)} starts · ${formatMetric(quizCompletions)} completions`
    : "No play activity recorded for the selected range";

  const conversionMuted = totalLeads === 0 && ctaClicks === 0;
  const conversionLine = conversionMuted
    ? "No leads or CTA clicks in selected range"
    : `${formatMetric(totalLeads)} leads · ${formatMetric(ctaClicks)} CTA clicks`;

  const growthMuted = newDesignersInRange === 0;
  const engageMuted = !hasEngagementData;
  const convMuted = conversionMuted;

  return (
    <div className="grid overflow-hidden rounded-lg border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 text-sm shadow-sm sm:grid-cols-3">
      <div className="flex gap-3 border-b border-slate-100 px-4 py-3 sm:border-b-0 sm:border-r">
        <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Platform growth</div>
          <p className="mt-1 font-semibold leading-snug text-slate-900">{growth}</p>
          {growthMuted ? (
            <span className="mt-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
              Limited activity
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex gap-3 border-b border-slate-100 px-4 py-3 sm:border-b-0 sm:border-r">
        <Activity className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Engagement</div>
          <p className="mt-1 font-semibold leading-snug text-slate-900">{engagementLine}</p>
          {engageMuted ? (
            <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
              No activity
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex gap-3 px-4 py-3">
        <PieChart className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Conversion</div>
          <p className="mt-1 font-semibold leading-snug text-slate-900">{conversionLine}</p>
          {convMuted ? (
            <span className="mt-1.5 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-900">
              No conversion events
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NewDesignersCalendarBreakdown({
  today,
  week,
  month,
}: {
  today: number;
  week: number;
  month: number;
}) {
  return (
    <Card className="flex flex-col justify-between border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
      <CardHeader className="pb-1.5 pt-3">
        <CardTitle className="text-sm text-slate-600">New Designers Calendar Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-slate-500">Daily</span>
            <span className="text-lg font-semibold tabular-nums text-slate-900">{today}</span>
          </div>
          <span className="text-slate-300" aria-hidden>
            |
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-slate-500">Weekly</span>
            <span className="text-lg font-semibold tabular-nums text-slate-900">{week}</span>
          </div>
          <span className="text-slate-300" aria-hidden>
            |
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-slate-500">Monthly</span>
            <span className="text-lg font-semibold tabular-nums text-slate-900">{month}</span>
          </div>
        </div>
        <p className="mt-2.5 border-t border-slate-100 pt-2 text-[10px] leading-snug text-slate-500">
          Calendar-based summary through now. These values are independent from the selected dashboard date range.
        </p>
      </CardContent>
    </Card>
  );
}

function ActiveDesignersCombinedCard({
  rolling7d,
  rolling30d,
}: {
  rolling7d: number;
  rolling30d: number;
}) {
  return (
    <Card className="border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
      <CardHeader className="pb-1.5 pt-3">
        <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
          <span>Active Designers</span>
          <MetricHelpPopover ariaLabel="Active Designers definition" text={METRIC_HELP.activeDesigner} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-medium text-slate-500">7-day</div>
            <div className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatMetric(rolling7d)}
            </div>
          </div>
          <div className="border-l border-slate-100 pl-3">
            <div className="text-[11px] font-medium text-slate-500">30-day</div>
            <div className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatMetric(rolling30d)}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs leading-snug text-slate-500">
          Accounts that created, updated, or published quizzes in each rolling window.
        </p>
      </CardContent>
    </Card>
  );
}

function GlobalPlatformSnapshot({
  platform,
}: {
  platform: Exclude<ReturnType<typeof useQuery<typeof api.analytics.getAdminPlatformOverview>>, undefined>;
}) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
      <SectionHeading
        title="Global Snapshot"
        subtitle="Current platform inventory and rolling activity. These metrics sit outside the selected date range."
        titleHelp={`${METRIC_HELP.activeDesigner} Quiz status and total counts are current platform inventory.`}
      />
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <KpiCard
          title="Total Designers"
          value={formatMetric(platform.totalDesigners)}
          subtitle="All registered designer/admin accounts."
          helpText={METRIC_HELP.designerAccount}
        />
        <KpiCard
          title="Total Quizzes"
          value={formatMetric(platform.totalQuizzes)}
          subtitle="All quizzes currently on the platform."
        />
        <ActiveDesignersCombinedCard
          rolling7d={platform.activeDesignersRolling7d}
          rolling30d={platform.activeDesignersRolling30d}
        />
        <NewDesignersCalendarBreakdown
          today={platform.newDesignersToday}
          week={platform.newDesignersThisWeek}
          month={platform.newDesignersThisMonth}
        />
      </div>

      <div className="mt-3">
        <QuizStatusBreakdown
          published={platform.publishedQuizzes}
          draft={platform.draftQuizzes}
          closed={platform.closedQuizzes}
        />
      </div>
    </section>
  );
}

function statusBadge(status: "draft" | "published" | "closed") {
  const map = {
    draft: "bg-amber-100 text-amber-900",
    published: "bg-emerald-100 text-emerald-900",
    closed: "bg-slate-200 text-slate-800",
  } as const;
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${map[status]}`}
    >
      {status}
    </span>
  );
}

/** Percent delta vs previous period — green/red only when both periods have enough volume */
function DeltaPercentRow({
  current,
  previous,
  pct,
  periodLabel,
  higherIsBetter,
}: {
  current: number;
  previous: number | null | undefined;
  pct: number | null | undefined;
  periodLabel: string | null;
  higherIsBetter: boolean;
}) {
  if (!periodLabel) return null;
  if (previous === null || previous === undefined) return null;

  if (current === 0 && previous === 0) {
    return (
      <div className="mt-1 text-xs text-slate-500">Not enough data for comparison</div>
    );
  }
  if (current === 0 && previous > 0) {
    return (
      <div className="mt-1 text-xs text-slate-500">No activity in current period</div>
    );
  }
  if (
    previous < MIN_VOLUME_FOR_COMPARE_PCT &&
    current < MIN_VOLUME_FOR_COMPARE_PCT
  ) {
    return (
      <div className="mt-1 text-xs text-slate-500">Not enough data for comparison</div>
    );
  }
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return (
      <div className="mt-1 text-xs text-slate-500">Not enough data for comparison</div>
    );
  }
  const line = `${pct > 0 ? "+" : ""}${pct}% ${periodLabel}`;
  if (pct === 0) {
    return <div className="mt-1 text-xs font-medium text-slate-500">{line}</div>;
  }
  const good = higherIsBetter ? pct > 0 : pct < 0;
  const cls = good ? "text-emerald-600" : "text-red-600";
  return <div className={`mt-1 text-xs font-medium ${cls}`}>{line}</div>;
}

function CompletionRateDeltaPts({
  pts,
  periodLabel,
  canCompare,
}: {
  pts: number | null | undefined;
  periodLabel: string | null;
  canCompare: boolean;
}) {
  if (!periodLabel || !canCompare || pts === null || pts === undefined || !Number.isFinite(pts)) return null;
  const line = `${pts > 0 ? "+" : ""}${pts} pts ${periodLabel}`;
  if (pts === 0) return <div className="mt-1 text-xs font-medium text-slate-500">{line}</div>;
  const cls = pts > 0 ? "text-emerald-600" : "text-red-600";
  return <div className={`mt-1 text-xs font-medium ${cls}`}>{line}</div>;
}

/** Drop-off: lower rate is better */
function DropOffDeltaPts({
  current,
  previous,
  periodLabel,
  canCompare,
}: {
  current: number | null;
  previous: number | null | undefined;
  periodLabel: string | null;
  canCompare: boolean;
}) {
  if (!periodLabel || !canCompare || current === null || previous === null || previous === undefined) return null;
  const delta = Math.round((current - previous) * 1000) / 10;
  if (Math.abs(delta) < 1e-9) {
    return (
      <div className="mt-1 text-xs font-medium text-slate-500">
        0 pts {periodLabel}
      </div>
    );
  }
  const line = `${delta > 0 ? "+" : ""}${delta} pts ${periodLabel}`;
  const good = delta < 0;
  const cls = good ? "text-emerald-600" : "text-red-600";
  return <div className={`mt-1 text-xs font-medium ${cls}`}>{line}</div>;
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<RangePreset>("7");
  const { startMs, endMs } = useDateRange(preset);
  const periodCompareLabel =
    preset === "7"
      ? "vs previous 7 days"
      : preset === "30"
        ? "vs previous 30 days"
        : null;

  // All sections below use Convex only (no local mock series).
  const platform = useStickyQueryResult(
    useQuery(api.analytics.getAdminPlatformOverview, { startMs, endMs }),
  );
  const engagement = useStickyQueryResult(
    useQuery(api.analytics.getAdminEngagementMetrics, { startMs, endMs }),
  );
  const leads = useStickyQueryResult(
    useQuery(api.analytics.getAdminLeadConversionMetrics, { startMs, endMs }),
  );
  const trendCharts = useStickyQueryResult(
    useQuery(api.analytics.getAdminTrendCharts, { startMs, endMs }),
  );
  const funnel = useStickyQueryResult(useQuery(api.analytics.getAdminPlatformFunnel, { startMs, endMs }));

  const ready =
    platform !== undefined &&
    engagement !== undefined &&
    leads !== undefined &&
    trendCharts !== undefined &&
    funnel !== undefined;

  // Hooks must run before any early returns.
  const growthSnapshot = useMemo(() => {
    const tc = trendCharts;
    const buckets = tc?.buckets ?? [];
    const intervalMs = tc?.intervalMs ?? 24 * 60 * 60 * 1000;
    return buckets.map((b) => ({
      x: bucketLabel(b.bucketStartMs, intervalMs),
      newDesigners: b.newDesigners,
      newQuizzes: b.newQuizzes,
    }));
  }, [trendCharts]);
  const newQuizzesInRange = useMemo(
    () => growthSnapshot.reduce((sum, d) => sum + d.newQuizzes, 0),
    [growthSnapshot],
  );

  const engagementCompareData = useMemo(() => {
    return [
      {
        name: "Selected range",
        views: engagement?.quizViews ?? 0,
        starts: engagement?.quizStarts ?? 0,
        completions: engagement?.quizCompletions ?? 0,
      },
    ];
  }, [engagement]);
  const engagementCompare = engagementCompareData[0] ?? {
    name: "Selected range",
    views: 0,
    starts: 0,
    completions: 0,
  };

  const rangeBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
      <Tabs value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
        <TabsList className="h-10 gap-1 bg-slate-100 p-1">
          <TabsTrigger
            type="button"
            value="7"
            className="px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-slate-900/10"
          >
            Last 7 days
          </TabsTrigger>
          <TabsTrigger
            type="button"
            value="30"
            className="px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-slate-900/10"
          >
            Last 30 days
          </TabsTrigger>
          <TabsTrigger
            type="button"
            value="all"
            className="px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-slate-900/10"
          >
            All Time
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="text-sm tabular-nums text-slate-600">
        {startMs === 0 ? (
          <span>Date range: All available data</span>
        ) : (
          <span>
            {toYmd(startMs)} ~ {toYmd(endMs)}
          </span>
        )}
      </div>
    </div>
  );

  if (!ready) {
    return (
      <DashboardLayoutFrame rangeBar={rangeBar}>
        <DashboardContentSkeleton />
      </DashboardLayoutFrame>
    );
  }

  const d = platform.deltasVsPreviousPeriod;
  const prev = platform.previousSnapshot;

  const canCompareCompletionRates =
    engagement.quizStarts >= 1 &&
    (engagement.previousEngagement?.quizStarts ?? 0) >= 1 &&
    engagement.completionRate != null &&
    engagement.previousEngagement?.completionRate != null;

  const canCompareDropOff =
    engagement.dropOffRate != null &&
    engagement.previousEngagement?.dropOffRate != null &&
    engagement.quizStarts >= 1 &&
    (engagement.previousEngagement?.quizStarts ?? 0) >= 1;

  return (
    <DashboardLayoutFrame
      preRangeContent={<GlobalPlatformSnapshot platform={platform} />}
      rangeBar={rangeBar}
    >
        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <SectionHeading
            title="Platform Growth"
            subtitle="Growth metrics that follow the selected date range."
            aside={<span>Scoped to selected time range</span>}
            titleHelp="New designers and new quizzes are counted inside the selected dashboard date range."
          />
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <KpiCard
              title="New Designers in Selected Range"
              value={formatMetric(platform.newDesigners)}
              subtitle="New accounts whose signup time falls inside the dashboard date filter above"
            >
              <DeltaPercentRow
                current={platform.newDesigners}
                previous={prev?.newDesignersInRange}
                pct={d?.newDesignersInRangePct}
                periodLabel={periodCompareLabel}
                higherIsBetter
              />
            </KpiCard>
            <KpiCard
              title="New Quizzes in Selected Range"
              value={formatMetric(newQuizzesInRange)}
              subtitle="Quizzes created inside the selected dashboard date filter"
            />
          </div>

          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">Platform Growth Snapshot</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  New designers and new quizzes over time (same date filter and bucket sizing as Trend Charts).
                </div>
              </div>
              <div className="text-[11px] text-slate-400">New Designers · New Quizzes</div>
            </div>
            <div className="mt-2 h-48 rounded-md border border-white bg-white p-2 shadow-sm ring-1 ring-slate-900/5">
              {growthSnapshot.every((d) => d.newDesigners === 0 && d.newQuizzes === 0) ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No growth data available for the selected range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={growthSnapshot} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} tickMargin={6} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="newDesigners" name="New Designers" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="newQuizzes" name="New Quizzes" fill="#db2777" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <SectionHeading
            title="User Engagement Metrics"
            subtitle="Measures how users interact with quizzes, including starts, completions, time spent, and drop-off."
            aside={<span>Scoped to selected time range</span>}
            titleHelp="Session and event counts in the selected range; completion and drop-off use starts as the denominator where noted."
          />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            <Card className="border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Quiz Views</span>
                  <MetricHelpPopover ariaLabel="Quiz Views definition" text={METRIC_HELP.quizViews} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                <div className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMetric(engagement.quizViews)}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Quiz / landing impressions (tracked events).
                </div>
                {engagement.quizViews === 0 ? (
                  <div className="mt-1 text-[11px] text-slate-400">
                    No page views recorded in selected range.
                  </div>
                ) : (
                  <DeltaPercentRow
                    current={engagement.quizViews}
                    previous={engagement.previousEngagement?.quizViews ?? 0}
                    pct={engagement.deltasVsPreviousPeriod?.quizViewsPct}
                    periodLabel={periodCompareLabel}
                    higherIsBetter
                  />
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Total Play Count</span>
                  <MetricHelpPopover ariaLabel="Total Play Count definition" text={METRIC_HELP.playCount} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                <div className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMetric(engagement.totalPlayCount)}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  How many quiz sessions began in this period.
                </div>
                {engagement.totalPlayCount === 0 ? (
                  <div className="mt-1 text-[11px] text-slate-400">
                    No quiz sessions started in selected range.
                  </div>
                ) : (
                  <DeltaPercentRow
                    current={engagement.totalPlayCount}
                    previous={engagement.previousEngagement?.totalPlayCount}
                    pct={engagement.deltasVsPreviousPeriod?.totalPlayCountPct}
                    periodLabel={periodCompareLabel}
                    higherIsBetter
                  />
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Quiz Starts</span>
                  <MetricHelpPopover ariaLabel="Quiz Starts definition" text={METRIC_HELP.quizStarts} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                <div className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMetric(engagement.quizStarts)}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Uses the same start event as Total Play Count; see the help icon for reporting context.
                </div>
                {engagement.quizStarts === 0 ? (
                  <div className="mt-1 text-[11px] text-slate-400">
                    No quiz starts recorded in selected range.
                  </div>
                ) : (
                  <DeltaPercentRow
                    current={engagement.quizStarts}
                    previous={engagement.previousEngagement?.quizStarts}
                    pct={engagement.deltasVsPreviousPeriod?.quizStartsPct}
                    periodLabel={periodCompareLabel}
                    higherIsBetter
                  />
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Quiz Completions</span>
                  <MetricHelpPopover
                    ariaLabel="Quiz Completions definition"
                    text={METRIC_HELP.quizCompletions}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                <div className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMetric(engagement.quizCompletions)}
                </div>
                {engagement.quizCompletions === 0 ? (
                  <div className="mt-1 text-[11px] text-slate-400">
                    No quiz completions recorded in selected range.
                  </div>
                ) : (
                  <DeltaPercentRow
                    current={engagement.quizCompletions}
                    previous={engagement.previousEngagement?.quizCompletions}
                    pct={engagement.deltasVsPreviousPeriod?.quizCompletionsPct}
                    periodLabel={periodCompareLabel}
                    higherIsBetter
                  />
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Completion Rate (%)</span>
                  <MetricHelpPopover
                    ariaLabel="Completion Rate definition"
                    text={METRIC_HELP.completionRate}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                {engagement.completionRate != null ? (
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">
                    {formatPercent(engagement.completionRate)}
                  </div>
                ) : (
                  <NaBlock reason={engagement.completionRateNaReason ?? "Requires quiz starts in range."} />
                )}
                <CompletionRateDeltaPts
                  pts={engagement.deltasVsPreviousPeriod?.completionRatePts}
                  periodLabel={periodCompareLabel}
                  canCompare={canCompareCompletionRates}
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">Engagement Volume Comparison</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  Views vs starts vs completions for the selected range (same values as the KPI cards above).
                </div>
              </div>
              <div className="text-[11px] text-slate-400">Views · Starts · Completions</div>
            </div>
            <div className="mt-2 h-40 rounded-md border border-white bg-white p-2 shadow-sm ring-1 ring-slate-900/5">
              {engagementCompare.views === 0 &&
              engagementCompare.starts === 0 &&
              engagementCompare.completions === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No engagement data available for the selected range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engagementCompareData} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickMargin={6} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="views" name="Quiz views" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="starts" name="Quiz starts" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completions" name="Completions" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2 md:grid-cols-3">
            <Card className="border-slate-900/10 shadow-sm">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Average Time Spent per Quiz</span>
                  <MetricHelpPopover
                    ariaLabel="Average Time Spent definition"
                    text={METRIC_HELP.averageTimeSpent}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                {engagement.averageTimeSpentPerQuizMs != null ? (
                  <>
                    <div className="text-2xl font-semibold tabular-nums text-slate-900">
                      {msToHuman(engagement.averageTimeSpentPerQuizMs)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">Among completed sessions only</div>
                  </>
                ) : (
                  <NaBlock reason="Requires completed quiz sessions." />
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/10 shadow-sm">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Average Number of Quizzes Played per User</span>
                  <MetricHelpPopover
                    ariaLabel="Average quizzes played per user definition"
                    text={METRIC_HELP.avgQuizzesPerUser}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                {engagement.averageQuizzesPlayedPerUser != null ? (
                  <>
                    <div className="text-2xl font-semibold tabular-nums text-slate-900">
                      {engagement.averageQuizzesPlayedPerUser.toFixed(2)}
                    </div>
                    {engagement.averageQuizzesPlayedPerUserCaption ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {engagement.averageQuizzesPlayedPerUserCaption}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <NaBlock
                    reason={
                      engagement.avgQuizzesPerUserNaReason ??
                      "Requires user-level or session-level play tracking."
                    }
                  />
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/10 shadow-sm">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Drop-off Rate (%)</span>
                  <MetricHelpPopover ariaLabel="Drop-off Rate definition" text={METRIC_HELP.dropOffRate} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                {engagement.dropOffRate != null ? (
                  <>
                    <div className="text-2xl font-semibold tabular-nums text-slate-900">
                      {formatPercent(engagement.dropOffRate)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Defined as 1 − completion rate (share of starts that did not complete). Lower is better.
                    </div>
                    <DropOffDeltaPts
                      current={engagement.dropOffRate}
                      previous={engagement.previousEngagement?.dropOffRate}
                      periodLabel={periodCompareLabel}
                      canCompare={canCompareDropOff}
                    />
                  </>
                ) : (
                  <NaBlock reason={engagement.dropOffNaReason ?? "Requires quiz starts in range."} />
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <SectionHeading
            title="Lead & Conversion Metrics"
            subtitle="Lead rows from quiz lead capture; CTR uses result page views when available, otherwise completions."
            aside={<span>{leads.sectionCaption}</span>}
            titleHelp={METRIC_HELP.leadSectionOverview}
          />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Card className="border-slate-900/10 shadow-sm">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Total Leads Collected</span>
                  <MetricHelpPopover ariaLabel="Total Leads definition" text={METRIC_HELP.totalLeads} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                <div className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMetric(leads.totalLeadsCollected ?? 0)}
                </div>
                {leads.leadCountNaReason ? (
                  <p className="mt-1 text-[11px] text-slate-400">{leads.leadCountNaReason}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    From result-page or in-quiz lead capture in this range.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/10 shadow-sm">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>Lead Conversion Rate (%)</span>
                  <MetricHelpPopover
                    ariaLabel="Lead Conversion Rate definition"
                    text={METRIC_HELP.leadConversionRate}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                {leads.leadConversionRate != null ? (
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">
                    {formatPercent(leads.leadConversionRate)}
                  </div>
                ) : (
                  <NaBlock
                    reason={leads.leadRateNaReason ?? "Requires completions in range."}
                  />
                )}
                <p className="mt-1 text-[11px] text-slate-500">Leads ÷ completions in selected range.</p>
              </CardContent>
            </Card>
            <Card className="border-slate-900/10 shadow-sm">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>CTA Click Count</span>
                  <MetricHelpPopover ariaLabel="CTA Click Count definition" text={METRIC_HELP.ctaClicks} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                <div className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMetric(leads.ctaClickCount ?? 0)}
                </div>
                {leads.ctaCountNaReason ? (
                  <p className="mt-1 text-[11px] text-slate-400">{leads.ctaCountNaReason}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">Result-page buttons and outbound links.</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-900/10 shadow-sm">
              <CardHeader className="space-y-0 p-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
                  <span>CTR (%)</span>
                  <MetricHelpPopover ariaLabel="CTR definition" text={METRIC_HELP.ctr} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-3 pb-2 pt-0">
                {leads.ctr != null ? (
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">
                    {formatPercent(leads.ctr)}
                  </div>
                ) : (
                  <NaBlock
                    reason={
                      leads.ctrNaReason ?? "Needs result page views or completions as denominator."
                    }
                  />
                )}
                {leads.ctr != null && leads.ctrDenominatorApprox ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Denominator: completions (no result page views in this range).
                  </p>
                ) : leads.ctr != null ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Denominator: {formatMetric(leads.ctrDenominatorViews ?? 0)} result page views.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 lg:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Conversion Actions Comparison</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Leads collected vs CTA click count for the selected range (same as KPI cards).
                  </div>
                </div>
              </div>
              <div className="mt-2 h-44 rounded-md border border-white bg-white p-2 shadow-sm ring-1 ring-slate-900/5">
                {((leads?.totalLeadsCollected ?? 0) === 0 && (leads?.ctaClickCount ?? 0) === 0) ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    No leads or CTA clicks in the selected range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: "Selected range",
                          leads: leads?.totalLeadsCollected ?? 0,
                          cta: leads?.ctaClickCount ?? 0,
                        },
                      ]}
                      margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickMargin={6} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="leads" name="Leads" fill="#9333ea" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cta" name="CTA clicks" fill="#0891b2" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="space-y-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">Rates at a glance</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  Lead conversion rate and CTR (same definitions as KPI cards).
                </div>
              </div>
              {leads.leadConversionRate != null ? (
                <RateBar
                  label="Lead Conversion Rate"
                  value={leads.leadConversionRate}
                  color="#9333ea"
                  valueLabel={formatPercent(leads.leadConversionRate)}
                />
              ) : (
                <NaBlock reason={leads?.leadRateNaReason ?? "Requires completions in range."} />
              )}
              {leads?.ctr != null ? (
                <RateBar
                  label="CTR"
                  value={leads.ctr}
                  color="#0891b2"
                  valueLabel={formatPercent(leads.ctr)}
                />
              ) : (
                <NaBlock reason={leads?.ctrNaReason ?? "Needs result views or completions in range."} />
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <SectionHeading
            title="Content Performance"
            subtitle="Top quizzes by the selected ranking; requires views, starts, or completions in range."
            aside={<span>Ranked by tab · platform scope</span>}
            titleHelp={METRIC_HELP.contentPerformanceOverview}
          />
          <ContentPerformanceTables startMs={startMs} endMs={endMs} />
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <SectionHeading
            title="Funnel Tracking"
            subtitle="Tracks user movement from quiz views to starts, completions, and leads."
            aside={<span className="text-slate-400">Selected time range</span>}
            titleHelp={METRIC_HELP.funnelOverview}
          />
          <PlatformFunnelCard funnel={funnel} />
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <SectionHeading
            title="Trend Charts"
            subtitle="Additional trend view for platform growth, engagement, and conversion over time."
            aside={<span>Supplemental · same date filter</span>}
            titleHelp="Buckets aggregate views, sessions, leads, and CTA events by day (or wider buckets for long ranges). Conversion tab lines use the same definitions as the KPI cards."
          />
          <TrendChartsSection trendCharts={trendCharts} />
        </section>

        {process.env.NODE_ENV === "development" ? (
          <p className="pb-4 text-center text-[10px] text-slate-400">
            Dev-only: enable demo analytics seed locally when you need fuller charts for QA.
          </p>
        ) : null}
    </DashboardLayoutFrame>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  helpText,
  children,
}: {
  title: string;
  value: string;
  subtitle?: string;
  helpText?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-slate-900/15 shadow-sm ring-1 ring-slate-900/10">
      <CardHeader className="pb-1 pt-2.5">
        <CardTitle className="flex items-center gap-1.5 text-sm text-slate-600">
          <span>{title}</span>
          {helpText ? <MetricHelpPopover ariaLabel={`${title} definition`} text={helpText} /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 pb-2.5 pt-0">
        <div className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</div>
        {subtitle ? <div className="text-xs leading-snug text-slate-500">{subtitle}</div> : null}
        {children}
      </CardContent>
    </Card>
  );
}

function QuizStatusBreakdown({
  published,
  draft,
  closed,
}: {
  published: number;
  draft: number;
  closed: number;
}) {
  const total = published + draft + closed;
  const safe = total > 0 ? total : 1;
  const seg = [
    { key: "pub", label: "Published Quizzes", short: "Published", count: published, cls: "bg-emerald-500" },
    { key: "draft", label: "Draft Quizzes", short: "Draft", count: draft, cls: "bg-amber-500" },
    { key: "closed", label: "Closed Quizzes", short: "Closed", count: closed, cls: "bg-slate-400" },
  ] as const;

  const donut = seg.map((s) => ({
    name: s.short,
    value: s.count,
    label: s.label,
    pct: safe > 0 ? s.count / safe : 0,
    color:
      s.key === "pub" ? "#10b981" : s.key === "draft" ? "#f59e0b" : "#94a3b8",
  }));

  return (
    <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 md:grid-cols-[1fr_260px]">
      <div>
        <div className="text-sm font-semibold text-slate-800">Quiz status</div>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          Breakdown of all quizzes by publication status (sums to Total Quizzes).
        </p>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {seg.map((s) => (
            <div
              key={s.key}
              className="rounded-md border border-white bg-white px-3 py-2 shadow-sm ring-1 ring-slate-900/5"
            >
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{s.count}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-right text-[11px] text-slate-600">
            <span className="tabular-nums">
              Published {published} · Draft {draft} · Closed {closed}
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200/90">
            <div className={seg[0].cls} style={{ width: `${(published / safe) * 100}%` }} title="Published" />
            <div className={seg[1].cls} style={{ width: `${(draft / safe) * 100}%` }} title="Draft" />
            <div className={seg[2].cls} style={{ width: `${(closed / safe) * 100}%` }} title="Closed" />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-[10px] text-slate-500">
            {seg.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${s.cls}`} aria-hidden />
                {s.short}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-white bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
        <div className="text-xs font-semibold text-slate-600">Status share</div>
        <div className="mt-2 h-44">
          {total <= 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No quiz status data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Tooltip
                  formatter={(value: any, name: any, _props: any) => {
                    const v = Number(value ?? 0);
                    const pct = safe > 0 ? (v / safe) * 100 : 0;
                    return [`${v} (${pct.toFixed(1)}%)`, String(name)];
                  }}
                />
                <Pie
                  data={donut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={1}
                >
                  {donut.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </RePieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-slate-600">
          {donut.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
                <span className="truncate">{d.name}</span>
              </div>
              <span className="tabular-nums text-slate-700">
                {d.value} · {(d.pct * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type TrendChartsResult = NonNullable<
  ReturnType<typeof useQuery<typeof api.analytics.getAdminTrendCharts>>
>;

function TrendChartFrame({
  empty,
  emptyTitle,
  emptyDetail,
  children,
}: {
  empty: boolean;
  emptyTitle: string;
  emptyDetail?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative rounded-lg border border-slate-100 bg-white ${empty ? "h-48" : "h-64"}`}>
      {children}
      {empty ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 px-6 text-center">
          <p className="text-sm font-medium text-slate-800">{emptyTitle}</p>
          {emptyDetail ? (
            <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">{emptyDetail}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TrendChartsSection({
  trendCharts,
}: {
  trendCharts: Exclude<TrendChartsResult, undefined>;
}) {
  const [tab, setTab] = useState<"engagement" | "growth" | "conversion">("engagement");

  const chartData = useMemo(() => {
    return trendCharts.buckets.map((b) => ({
      day: bucketLabel(b.bucketStartMs, trendCharts.intervalMs),
      views: b.views,
      starts: b.starts,
      completions: b.completions,
      newDesigners: b.newDesigners,
      newQuizzes: b.newQuizzes,
      leads: b.leads,
      ctaClicks: b.ctaClicks,
      completionRatePct:
        b.completionRate != null ? Math.round(b.completionRate * 1000) / 10 : 0,
      leadConversionPct:
        b.leadConversionRate != null
          ? Math.round(b.leadConversionRate * 1000) / 10
          : 0,
      ctrPct: b.ctr != null ? Math.round(b.ctr * 1000) / 10 : 0,
    }));
  }, [trendCharts.buckets, trendCharts.intervalMs]);

  const noTimeline = trendCharts.buckets.length === 0;

  const engagementMax = Math.max(
    1,
    ...chartData.flatMap((d) => [d.views, d.starts, d.completions]),
  );
  const growthMax = Math.max(
    1,
    ...chartData.flatMap((d) => [d.newDesigners, d.newQuizzes]),
  );
  const tabCaption =
    tab === "engagement"
      ? "Views, starts, and completions over time."
      : tab === "growth"
        ? "New designers and new quizzes over time."
        : "Completion rate, lead conversion rate, and CTR when available.";

  const chartMargins = { top: 10, right: 12, left: 4, bottom: 4 };

  if (noTimeline) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="bg-slate-100">
              <TabsTrigger type="button" value="engagement">
                Engagement Trend
              </TabsTrigger>
              <TabsTrigger type="button" value="growth">
                Growth Trend
              </TabsTrigger>
              <TabsTrigger type="button" value="conversion">
                Conversion Trend
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "conversion" ? (
            <MetricHelpPopover
              ariaLabel="Conversion trend metric definitions"
              text={METRIC_HELP.conversionTrendLines}
            />
          ) : null}
        </div>
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-800">No trend data available for the selected range.</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
            Trend data will appear once views, starts, or completions are recorded over time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="bg-slate-100">
            <TabsTrigger type="button" value="engagement">
              Engagement Trend
            </TabsTrigger>
            <TabsTrigger type="button" value="growth">
              Growth Trend
            </TabsTrigger>
            <TabsTrigger type="button" value="conversion">
              Conversion Trend
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "conversion" ? (
          <MetricHelpPopover
            ariaLabel="Conversion trend metric definitions"
            text={METRIC_HELP.conversionTrendLines}
          />
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">{tabCaption}</p>

      {tab === "engagement" ? (
        <TrendChartFrame
          empty={false}
          emptyTitle="No trend data available for the selected range."
          emptyDetail="Trend data will appear once views, starts, or completions are recorded over time."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={chartMargins}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickMargin={6} />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={40}
                domain={[0, engagementMax]}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#2563eb"
                strokeWidth={2.25}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
                name="Quiz views"
              />
              <Line
                type="monotone"
                dataKey="starts"
                stroke="#f97316"
                strokeWidth={2.25}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
                name="Quiz Starts"
              />
              <Line
                type="monotone"
                dataKey="completions"
                stroke="#16a34a"
                strokeWidth={2.25}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
                name="Quiz Completions"
              />
            </LineChart>
          </ResponsiveContainer>
        </TrendChartFrame>
      ) : null}

      {tab === "growth" ? (
        <TrendChartFrame
          empty={false}
          emptyTitle="No trend data available for the selected range."
          emptyDetail="Trend lines will appear when designers register or quizzes are created in this window."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={chartMargins}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickMargin={6} />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={40}
                domain={[0, growthMax]}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="newDesigners"
                name="New Designers"
                stroke="#7c3aed"
                strokeWidth={2.25}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="newQuizzes"
                name="New Quizzes"
                stroke="#db2777"
                strokeWidth={2.25}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </TrendChartFrame>
      ) : null}

      {tab === "conversion" ? (
        <TrendChartFrame
          empty={false}
          emptyTitle="No trend data available for the selected range."
          emptyDetail="Completion, lead conversion, or CTR lines need enough bucket-level activity to compute rates."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={chartMargins}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickMargin={6} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                width={44}
                tickFormatter={(x) => `${x}%`}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="completionRatePct"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
                name="Completion rate %"
              />
              <Line
                type="monotone"
                dataKey="leadConversionPct"
                stroke="#9333ea"
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
                name="Lead conversion %"
              />
              <Line
                type="monotone"
                dataKey="ctrPct"
                stroke="#0891b2"
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 1.5, fill: "#fff" }}
                activeDot={{ r: 4 }}
                name="CTR %"
              />
            </LineChart>
          </ResponsiveContainer>
        </TrendChartFrame>
      ) : null}
    </div>
  );
}

type ContentRow = {
  quizId: string;
  quizName: string;
  designer: string;
  status: "draft" | "published" | "closed";
  /** Session starts in range (SaaS “play count”). */
  playCount: number;
  quizViews: number;
  starts: number;
  completions: number;
  completionRate: number | null;
  completionRateNaReason: string | null;
  leads: number | null;
  leadConversionRate: number | null;
  leadConversionRateNaReason: string | null;
  ctaClicks?: number;
  ctr?: number | null;
  ctrNaReason?: string | null;
};

function completionRateCell(r: ContentRow) {
  if (r.completionRate != null) return formatPercent(r.completionRate);
  const hint = r.completionRateNaReason ?? "Requires quiz starts in range.";
  return (
    <span
      title={hint}
      className="inline-block cursor-help tabular-nums text-slate-400"
      aria-label={hint}
    >
      —
    </span>
  );
}

function MetricTableHeaderHelp({
  className,
  label,
  help,
}: {
  className: string;
  label: string;
  help: string;
}) {
  return (
    <th className={className}>
      <div className="flex items-center justify-end gap-1">
        <span>{label}</span>
        <MetricHelpPopover ariaLabel={`${label} definition`} text={help} />
      </div>
    </th>
  );
}

function ContentPerformanceTables({ startMs, endMs }: { startMs: number; endMs: number }) {
  const [tab, setTab] = useState<"playCount" | "completionRate" | "leadConversionRate">("playCount");
  // Prefetch all 3 tabs so switching feels instant (no intermediate Loading).
  const qPlay = useQuery(api.analytics.getAdminContentPerformanceTop10, {
    startMs,
    endMs,
    sortBy: "playCount",
  });
  const qCompletion = useQuery(api.analytics.getAdminContentPerformanceTop10, {
    startMs,
    endMs,
    sortBy: "completionRate",
  });
  const qLead = useQuery(api.analytics.getAdminContentPerformanceTop10, {
    startMs,
    endMs,
    sortBy: "leadConversionRate",
  });

  const cacheRef = useRef<{
    playCount?: typeof qPlay;
    completionRate?: typeof qCompletion;
    leadConversionRate?: typeof qLead;
  }>({});
  if (qPlay !== undefined) cacheRef.current.playCount = qPlay;
  if (qCompletion !== undefined) cacheRef.current.completionRate = qCompletion;
  if (qLead !== undefined) cacheRef.current.leadConversionRate = qLead;

  const live =
    tab === "playCount" ? qPlay : tab === "completionRate" ? qCompletion : qLead;
  const effective =
    live ??
    (tab === "playCount"
      ? cacheRef.current.playCount
      : tab === "completionRate"
        ? cacheRef.current.completionRate
        : cacheRef.current.leadConversionRate);
  const isRefreshing = live === undefined && effective !== undefined;

  const effectiveRows = useMemo(() => (effective?.rows ?? []) as ContentRow[], [effective]);
  const effectiveHasQuizPerformanceData = useMemo(
    () => Boolean(effective?.hasQuizPerformanceData),
    [effective],
  );

  let emptyCopy: { title: string; body: string } | null = null;
  if (!effectiveHasQuizPerformanceData || effectiveRows.length === 0) {
    if (tab === "playCount") {
      emptyCopy = {
        title: "No quiz performance data yet",
        body: "Once quizzes receive views or plays in this range, the top 10 ranking will appear here.",
      };
    } else if (tab === "completionRate") {
      emptyCopy = {
        title: "No completion data yet",
        body: "Once quizzes receive starts and completions in this range, completion-rate ranking will appear here.",
      };
    } else if (tab === "leadConversionRate") {
      emptyCopy = {
        title: "No lead conversion data yet",
        body: "Once leads are recorded for quizzes in this range, this ranking will populate.",
      };
    } else {
      emptyCopy = !effectiveHasQuizPerformanceData
        ? {
            title: "No quiz performance data yet",
            body: "Once quizzes receive views or plays in this range, the top 10 ranking will appear here.",
          }
        : {
            title: "No quizzes on the platform",
            body: "Create quizzes to populate this leaderboard.",
          };
    }
  }

  const barData = useMemo(() => {
    if (emptyCopy) return [];
    const list = effectiveRows.slice(0, 10);
    return list.map((r) => {
      const name = r.quizName.length > 26 ? `${r.quizName.slice(0, 26)}…` : r.quizName;
      if (tab === "playCount") return { name, value: r.playCount, raw: r.playCount, kind: "count" as const };
      if (tab === "completionRate") {
        const pct = r.completionRate != null ? Math.round(r.completionRate * 1000) / 10 : null;
        return { name, value: pct ?? 0, raw: pct, kind: "pct" as const };
      }
      const pct = r.leadConversionRate != null ? Math.round(r.leadConversionRate * 1000) / 10 : null;
      return { name, value: pct ?? 0, raw: pct, kind: "pct" as const };
    });
  }, [effectiveRows, tab, emptyCopy]);

  if (effective === undefined) {
    return <div className="py-6 text-center text-sm text-slate-500">Loading…</div>;
  }

  const colSpan = 8;

  const th = "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500";

  const headPlay = (
    <thead>
      <tr className="border-b border-slate-100 bg-slate-50/80">
        <th className={`${th} text-left`}>Rank</th>
        <th className={`${th} min-w-[14rem] text-left`}>Quiz Name</th>
        <th className={`${th} text-left`}>Designer</th>
        <th className={`${th} text-left`}>Status</th>
        <MetricTableHeaderHelp className={`${th} text-right`} label="Play Count" help={METRIC_HELP.playCount} />
        <MetricTableHeaderHelp className={`${th} text-right`} label="Quiz Views" help={METRIC_HELP.quizViews} />
        <th className={`${th} text-right`}>Completions</th>
        <MetricTableHeaderHelp
          className={`${th} text-right`}
          label="Completion Rate"
          help={METRIC_HELP.completionRate}
        />
      </tr>
    </thead>
  );

  const headCompletion = (
    <thead>
      <tr className="border-b border-slate-100 bg-slate-50/80">
        <th className={`${th} text-left`}>Rank</th>
        <th className={`${th} min-w-[14rem] text-left`}>Quiz Name</th>
        <th className={`${th} text-left`}>Designer</th>
        <th className={`${th} text-left`}>Status</th>
        <MetricTableHeaderHelp className={`${th} text-right`} label="Starts" help={METRIC_HELP.quizStarts} />
        <th className={`${th} text-right`}>Completions</th>
        <MetricTableHeaderHelp
          className={`${th} text-right`}
          label="Completion Rate"
          help={METRIC_HELP.completionRate}
        />
        <MetricTableHeaderHelp className={`${th} text-right`} label="Quiz Views" help={METRIC_HELP.quizViews} />
      </tr>
    </thead>
  );

  const headLead = (
    <thead>
      <tr className="border-b border-slate-100 bg-slate-50/80">
        <th className={`${th} text-left`}>Rank</th>
        <th className={`${th} min-w-[14rem] text-left`}>Quiz Name</th>
        <th className={`${th} text-left`}>Designer</th>
        <th className={`${th} text-left`}>Status</th>
        <MetricTableHeaderHelp className={`${th} text-right`} label="Leads" help={METRIC_HELP.totalLeads} />
        <MetricTableHeaderHelp
          className={`${th} text-right`}
          label="Lead Conversion Rate"
          help={METRIC_HELP.leadConversionRate}
        />
        <th className={`${th} text-right`}>Completions</th>
        <MetricTableHeaderHelp className={`${th} text-right`} label="CTR" help={METRIC_HELP.ctr} />
      </tr>
    </thead>
  );

  const tableHead =
    tab === "playCount" ? headPlay : tab === "completionRate" ? headCompletion : headLead;

  const minW = tab === "leadConversionRate" ? "min-w-[880px]" : "min-w-[800px]";

  return (
    <div className="space-y-2.5">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="bg-slate-100">
          <TabsTrigger type="button" value="playCount">
            Top 10 by Play Count
          </TabsTrigger>
          <TabsTrigger type="button" value="completionRate">
            Top 10 by Completion Rate
          </TabsTrigger>
          <TabsTrigger type="button" value="leadConversionRate">
            Top 10 by Lead Conversion Rate
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {isRefreshing ? (
        <div className="text-[11px] text-slate-400">Updating…</div>
      ) : null}

      <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm">
        <div className="h-56">
          {emptyCopy ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No ranking chart available yet for this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...barData].reverse()}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  width={40}
                  domain={tab === "playCount" ? undefined : [0, 100]}
                  tickFormatter={(x) => (tab === "playCount" ? String(x) : `${x}%`)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => {
                    const v = Number(value ?? 0);
                    return tab === "playCount" ? [Math.round(v), ""] : [`${v}%`, ""];
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={tab === "playCount" ? "#0f172a" : tab === "completionRate" ? "#16a34a" : "#9333ea"}
                  radius={[4, 4, 4, 4]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
        <table className={`w-full text-left text-sm ${minW}`}>
          {tableHead}
          <tbody className="text-slate-800">
            {emptyCopy ? (
              <tr>
                <td colSpan={colSpan} className="bg-slate-50/50 p-0">
                  <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
                    <BarChart3 className="h-9 w-9 text-slate-300" aria-hidden strokeWidth={1.25} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{emptyCopy.title}</p>
                      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                        {emptyCopy.body}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              effectiveRows.map((r, idx: number) => (
                <tr key={r.quizId} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-2 tabular-nums text-slate-600">{idx + 1}</td>
                  <td className="max-w-[20rem] px-3 py-2 font-medium text-slate-900">
                    <span className="line-clamp-2">{r.quizName}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.designer}</td>
                  <td className="px-3 py-2">{statusBadge(r.status)}</td>
                  {tab === "playCount" ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{r.playCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.quizViews}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.completions}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{completionRateCell(r)}</td>
                    </>
                  ) : null}
                  {tab === "completionRate" ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{r.starts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.completions}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{completionRateCell(r)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.quizViews}</td>
                    </>
                  ) : null}
                  {tab === "leadConversionRate" ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMetric(r.leads ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.leadConversionRate != null ? (
                          formatPercent(r.leadConversionRate)
                        ) : (
                          <span
                            title={r.leadConversionRateNaReason ?? "Requires completions in range"}
                            className="cursor-help text-slate-400"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.completions}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.ctr != null ? (
                          formatPercent(r.ctr)
                        ) : (
                          <span
                            title={
                              r.ctrNaReason ?? "Needs result views or completions in range."
                            }
                            className="cursor-help text-slate-400"
                          >
                            —
                          </span>
                        )}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-500">
          {tab === "playCount"
            ? "Sorted by play count (session starts) in the selected range."
            : null}
          {tab === "completionRate" ? "Sorted by completion rate among quizzes with starts in range." : null}
          {tab === "leadConversionRate"
            ? "Lead conversion: Leads ÷ Completions. CTR: CTA clicks ÷ result views (fallback: completions)."
            : null}
        </div>
      </div>
    </div>
  );
}

type FunnelPayload = NonNullable<
  ReturnType<typeof useQuery<typeof api.analytics.getAdminPlatformFunnel>>
>;

function FunnelPyramid({
  steps,
}: {
  steps: Array<{
    key: string;
    label: string;
    numericCount: number;
    countDisplay: string;
    fromPrevious: string;
    overallFromViews: string;
  }>;
}) {
  const views = steps[0]?.numericCount ?? 0;
  const totalAll = steps.reduce((acc, s) => acc + (s.numericCount ?? 0), 0);
  const hasAny = totalAll > 0;

  const layer = (i: number) => {
    // Keep a cohesive gray/blue palette (subtle, business-like).
    const palette = [
      { a: "#f1f5f9", b: "#e2e8f0", stroke: "#cbd5e1" }, // Views
      { a: "#eff6ff", b: "#dbeafe", stroke: "#bfdbfe" }, // Starts
      { a: "#f0fdf4", b: "#dcfce7", stroke: "#bbf7d0" }, // Completions
      { a: "#faf5ff", b: "#f3e8ff", stroke: "#ddd6fe" }, // Leads
      { a: "#ecfeff", b: "#cffafe", stroke: "#a5f3fc" }, // CTA
    ];
    const fallback = { a: "#f1f5f9", b: "#f1f5f9", stroke: "#e2e8f0" };
    return hasAny ? palette[i] ?? fallback : fallback;
  };
  const minPct = hasAny ? 0.18 : 0.34;

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">Funnel Pyramid</div>
          <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
            A compact visual summary of step-to-step conversion (details are in the cards above).
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-slate-100 bg-slate-50/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="mx-auto max-w-3xl space-y-2">
          {steps.map((s, idx) => {
            const baseline = views > 0 ? views : 1;
            const rawPct = views > 0 ? s.numericCount / baseline : 0;
            const pct = hasAny ? Math.max(minPct, Math.min(1, rawPct)) : Math.max(minPct, 1 - idx * 0.12);
            const shapeMin = hasAny ? "22%" : "40%";
            const c = layer(idx);
            const rateLabel =
              idx === 0 ? "Baseline" : hasAny ? s.fromPrevious : "N/A";

            return (
              <div key={s.key} className="grid grid-cols-[10rem_1fr] items-center gap-3">
                <div className="truncate text-[11px] font-medium text-slate-600">{s.label}</div>
                <div className="flex justify-center">
                  <div
                    className="relative h-8 w-full"
                    style={{
                      width: `${pct * 100}%`,
                      minWidth: shapeMin,
                      maxWidth: "100%",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-[12px] shadow-[0_1px_0_rgba(15,23,42,0.06)]"
                      style={{
                        backgroundImage: `linear-gradient(180deg, ${c.a} 0%, ${c.b} 100%)`,
                        border: `1px solid ${c.stroke}`,
                        // gentler taper + softer silhouette
                        clipPath: "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)",
                      }}
                    />
                    <div className="relative flex h-full items-center justify-center">
                      <div className="text-[11px] font-semibold tabular-nums text-slate-800">
                        {rateLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!hasAny ? (
        <div className="mt-3 text-center text-[11px] text-slate-400">
          No funnel activity recorded in the selected range.
        </div>
      ) : null}
    </div>
  );
}

function PlatformFunnelCard({ funnel }: { funnel: Exclude<FunnelPayload, undefined> }) {
  const v = funnel.views;
  const st = funnel.starts;
  const c = funnel.completions;
  const L = funnel.leads;
  const cta = funnel.ctaClicks;

  const maxForBar = Math.max(v, st, c, L, cta, 1);

  type StepSpec = {
    key: string;
    label: string;
    countDisplay: string;
    numericCount: number;
    fromPrevious: string;
    overallFromViews: string;
  };

  const steps: StepSpec[] = [
    {
      key: "views",
      label: "Views",
      countDisplay: formatMetric(v),
      numericCount: v,
      fromPrevious: "Baseline",
      overallFromViews: v > 0 ? formatPctOneDecimal(1) : "Baseline",
    },
    {
      key: "starts",
      label: "Starts",
      countDisplay: formatMetric(st),
      numericCount: st,
      fromPrevious: v > 0 ? formatPctOneDecimal(st / v) : "Not available",
      overallFromViews: v > 0 ? formatPctOneDecimal(st / v) : "Not available",
    },
    {
      key: "completions",
      label: "Completions",
      countDisplay: formatMetric(c),
      numericCount: c,
      fromPrevious: st > 0 ? formatPctOneDecimal(c / st) : "Not available",
      overallFromViews: v > 0 ? formatPctOneDecimal(c / v) : "Not available",
    },
    {
      key: "leads",
      label: "Leads",
      countDisplay: formatMetric(L),
      numericCount: L,
      fromPrevious: c > 0 ? formatPctOneDecimal(L / c) : "Not available",
      overallFromViews: v > 0 ? formatPctOneDecimal(L / v) : "Not available",
    },
    {
      key: "cta",
      label: "CTA Clicks",
      countDisplay: formatMetric(cta),
      numericCount: cta,
      fromPrevious:
        L > 0
          ? formatPctOneDecimal(cta / L)
          : c > 0
            ? formatPctOneDecimal(cta / c)
            : "Not available",
      overallFromViews: v > 0 ? formatPctOneDecimal(cta / v) : "Not available",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, idx) => {
          const fillPct =
            step.numericCount > 0 ? Math.min(100, (step.numericCount / maxForBar) * 100) : 0;

          return (
            <div
              key={step.key}
              className="flex flex-col rounded-lg border border-slate-100 bg-slate-50/40 p-3 shadow-sm ring-1 ring-slate-900/5"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {idx + 1}. {step.label}
              </div>
              <div className="mt-1.5 text-xs text-slate-500">Count</div>
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{step.countDisplay}</div>
              <dl className="mt-3 space-y-1.5 text-[11px] leading-snug">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">From previous step</dt>
                  <dd className="text-right font-medium text-slate-800">{step.fromPrevious}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Overall from views</dt>
                  <dd className="text-right font-medium text-slate-800">{step.overallFromViews}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/90">
                  {step.numericCount > 0 ? (
                    <div
                      className="h-2 rounded-full bg-slate-800"
                      style={{ width: `${fillPct}%` }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FunnelPyramid steps={steps} />
    </div>
  );
}
