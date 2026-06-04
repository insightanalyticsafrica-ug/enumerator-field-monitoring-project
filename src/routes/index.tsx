import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapPin, Bell, RefreshCw, Download, AlertTriangle } from "lucide-react";
import { getDashboardData, type Submission } from "@/lib/kobo.functions";

const dashQuery = queryOptions({
  queryKey: ["kobo-dashboard"],
  queryFn: () => getDashboardData(),
  refetchInterval: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Enumerator Field Monitoring" },
      { name: "description", content: "Real-time M&E dashboard linking KoboToolbox field submissions to an automated quality scoring engine." },
      { property: "og:title", content: "Enumerator Field Monitoring" },
      { property: "og:description", content: "Live KoboToolbox quality monitoring with duplicate, GPS and duration audits." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery),
  component: DashboardPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load dashboard: {error.message}</div>
  ),
});

function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading field data…</div>}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const { data, refetch, isFetching } = useSuspenseQuery(dashQuery);
  const [districtFilter, setDistrictFilter] = useState<string>("All");

  const submissions = data.submissions;
  const districts = useMemo(
    () => Array.from(new Set(submissions.map((s) => s.district))).sort(),
    [submissions],
  );
  const filtered = useMemo(
    () => (districtFilter === "All" ? submissions : submissions.filter((s) => s.district === districtFilter)),
    [submissions, districtFilter],
  );

  const total = filtered.length;
  const avgDuration =
    total === 0 ? 0 : filtered.reduce((a, s) => a + s.interview_duration_mins, 0) / total;
  const gpsCompleteness =
    total === 0 ? 0 : (filtered.filter((s) => s.gps_captured === 1).length / total) * 100;
  const avgQuality =
    total === 0 ? 0 : filtered.reduce((a, s) => a + s.quality_score, 0) / total;

  const enumProductivity = useMemo(() => groupEnumerators(filtered).slice(0, 10), [filtered]);
  const dailyTrend = useMemo(() => groupDaily(filtered), [filtered]);
  const durationByEnum = useMemo(() => groupEnumerators(filtered).slice(0, 10), [filtered]);
  const gpsPie = [
    { name: "Captured", value: filtered.filter((s) => s.gps_captured === 1).length },
    { name: "Missing", value: filtered.filter((s) => s.gps_captured === 0).length },
  ];
  const qualityDist = useMemo(() => qualityBuckets(filtered), [filtered]);
  const alerts = useMemo(
    () => filtered.filter((s) => s.quality_score < 80).slice(0, 12),
    [filtered],
  );
  const gpsPoints = filtered.filter((s) => s.gps_lat && s.gps_lng);

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between rounded-xl bg-card px-5 py-4 border border-border shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--kpi-blue)]/20 grid place-items-center">
              <MapPin className="h-5 w-5 text-[var(--kpi-blue)]" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-wide">
              ENUMERATOR FIELD MONITORING
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="relative p-2 rounded-lg hover:bg-secondary"
              title="Refresh"
            >
              <Bell className="h-5 w-5" />
              {alerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-[10px] grid place-items-center px-1">
                  {alerts.length}
                </span>
              )}
            </button>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--kpi-orange)] to-[var(--kpi-red)] grid place-items-center text-sm font-semibold">
              ME
            </div>
          </div>
        </header>

        {data.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {data.error}
          </div>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiTile label="Total Submissions" value={total.toLocaleString()} color="var(--kpi-blue)" />
          <KpiTile label="Avg. Interview Duration" value={`${avgDuration.toFixed(1)} min`} color="var(--kpi-orange)" />
          <KpiTile label="GPS Completeness" value={`${gpsCompleteness.toFixed(1)}%`} color="var(--kpi-green)" />
          <KpiTile label="Data Quality Score" value={`${avgQuality.toFixed(0)}%`} color="var(--kpi-red)" />
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">District Filter</div>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full bg-secondary text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Row 2 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Enumerator Productivity (Top 10)">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={enumProductivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="enumerator" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar yAxisId="left" dataKey="submissions" fill="var(--chart-orange)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avgQuality" stroke="var(--chart-green)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Daily Submissions Trend">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {districts.map((d, i) => (
                  <Line
                    key={d}
                    type="monotone"
                    dataKey={d}
                    stroke={districtColor(i)}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel
            title="Data Quality Monitoring (Alerts)"
            titleBg="var(--kpi-red)"
            headerExtra={
              <span className="text-xs bg-card text-foreground rounded-full px-2 py-0.5 border border-border">
                <Bell className="inline h-3 w-3 mr-1" />
                {alerts.length} Alerts
              </span>
            }
          >
            <div className="overflow-auto max-h-[260px]">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b border-border">
                  <tr className="text-left">
                    <th className="py-2 px-2">ID</th>
                    <th className="py-2 px-2">Enumerator</th>
                    <th className="py-2 px-2">Flags</th>
                    <th className="py-2 px-2">Score</th>
                    <th className="py-2 px-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No quality alerts</td></tr>
                  ) : alerts.map((a) => (
                    <tr key={String(a.submission_id)} className="border-b border-border/40 hover:bg-secondary/40">
                      <td className="py-1.5 px-2">{String(a.submission_id).slice(0, 6)}</td>
                      <td className="py-1.5 px-2">{a.enumerator_id}</td>
                      <td className="py-1.5 px-2">
                        <span className="inline-flex items-center gap-1 rounded bg-destructive/20 text-destructive px-1.5 py-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          {a.flag_reason}
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[var(--primary-foreground)]"
                          style={{ background: scoreColor(a.quality_score) }}
                        >
                          {a.quality_score}%
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground">
                        {new Date(a.submission_time).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>

        {/* Row 3 */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Panel title="Average Interview Duration by Enumerator" subtitle="Under 15 minutes flags potential rush jobs">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={durationByEnum}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="enumerator" stroke="var(--muted-foreground)" fontSize={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={15} stroke="var(--chart-red)" strokeDasharray="4 4" />
                <Bar dataKey="avgDuration" fill="var(--chart-orange)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="GPS Completeness">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={gpsPie} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  <Cell fill="var(--chart-green)" />
                  <Cell fill="var(--chart-red)" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-3 text-2xl font-bold text-[var(--chart-green)]">
              {gpsCompleteness.toFixed(0)}%
            </div>
          </Panel>

          <Panel title="Submission Quality Scoring">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={qualityDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {qualityDist.map((q, i) => (
                    <Cell key={i} fill={q.bucket === "High" ? "var(--chart-green)" : q.bucket === "Medium" ? "var(--chart-orange)" : "var(--chart-red)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Spatial Locations (Captured GPS)">
            <GpsMap points={gpsPoints} />
          </Panel>
        </section>

        {/* Footer actions */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card border border-border p-4">
          <div className="text-xs text-muted-foreground">
            Live KoboToolbox feed • last refreshed {new Date(data.fetchedAt).toLocaleTimeString()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportCsv(filtered)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--kpi-blue)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Export Data
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-green)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------- helpers & subcomponents ---------- */

const tooltipStyle = {
  background: "oklch(0.2 0.05 260)",
  border: "1px solid oklch(0.35 0.05 262)",
  borderRadius: 8,
  fontSize: 12,
  color: "white",
};

function districtColor(i: number) {
  const palette = ["var(--chart-orange)", "var(--chart-green)", "var(--chart-blue)", "var(--chart-yellow)", "var(--chart-red)"];
  return palette[i % palette.length];
}

function scoreColor(score: number) {
  if (score >= 80) return "var(--chart-green)";
  if (score >= 60) return "var(--chart-orange)";
  return "var(--chart-red)";
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl border border-border p-4 shadow-lg"
      style={{ background: `color-mix(in oklab, ${color} 18%, var(--card))`, borderColor: `color-mix(in oklab, ${color} 50%, transparent)` }}
    >
      <div className="text-xs uppercase tracking-wide text-foreground/80">{label}</div>
      <div className="mt-1 text-3xl md:text-4xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function Panel({
  title, subtitle, children, titleBg, headerExtra,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  titleBg?: string;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={titleBg ? { background: titleBg } : undefined}
      >
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {headerExtra}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function groupEnumerators(rows: Submission[]) {
  const map = new Map<string, { submissions: number; totalQuality: number; totalDur: number }>();
  for (const r of rows) {
    const m = map.get(r.enumerator_id) ?? { submissions: 0, totalQuality: 0, totalDur: 0 };
    m.submissions += 1;
    m.totalQuality += r.quality_score;
    m.totalDur += r.interview_duration_mins;
    map.set(r.enumerator_id, m);
  }
  return [...map.entries()]
    .map(([enumerator, m]) => ({
      enumerator,
      submissions: m.submissions,
      avgQuality: +(m.totalQuality / m.submissions).toFixed(1),
      avgDuration: +(m.totalDur / m.submissions).toFixed(1),
    }))
    .sort((a, b) => b.submissions - a.submissions);
}

function groupDaily(rows: Submission[]) {
  const map = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const date = new Date(r.submission_time).toISOString().slice(5, 10);
    const entry = map.get(date) ?? { date };
    entry[r.district] = ((entry[r.district] as number) || 0) + 1;
    map.set(date, entry);
  }
  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function qualityBuckets(rows: Submission[]) {
  const buckets = { High: 0, Medium: 0, Low: 0 };
  for (const r of rows) {
    if (r.quality_score >= 80) buckets.High += 1;
    else if (r.quality_score >= 60) buckets.Medium += 1;
    else buckets.Low += 1;
  }
  return [
    { bucket: "High", count: buckets.High },
    { bucket: "Medium", count: buckets.Medium },
    { bucket: "Low", count: buckets.Low },
  ];
}

function GpsMap({ points }: { points: Submission[] }) {
  if (points.length === 0) {
    return (
      <div className="h-[220px] grid place-items-center text-sm text-muted-foreground">
        No GPS coordinates captured yet
      </div>
    );
  }
  const lats = points.map((p) => p.gps_lat!);
  const lngs = points.map((p) => p.gps_lng!);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.01;
  const dLng = maxLng - minLng || 0.01;
  return (
    <svg viewBox="0 0 300 220" className="w-full h-[220px] rounded-md bg-secondary/40">
      <defs>
        <radialGradient id="heat">
          <stop offset="0%" stopColor="var(--chart-red)" stopOpacity={0.9} />
          <stop offset="100%" stopColor="var(--chart-red)" stopOpacity={0} />
        </radialGradient>
      </defs>
      {points.map((p, i) => {
        const x = ((p.gps_lng! - minLng) / dLng) * 280 + 10;
        const y = 210 - ((p.gps_lat! - minLat) / dLat) * 200;
        return <circle key={i} cx={x} cy={y} r={10} fill="url(#heat)" />;
      })}
      {points.map((p, i) => {
        const x = ((p.gps_lng! - minLng) / dLng) * 280 + 10;
        const y = 210 - ((p.gps_lat! - minLat) / dLat) * 200;
        return <circle key={`d-${i}`} cx={x} cy={y} r={2} fill="var(--chart-yellow)" />;
      })}
    </svg>
  );
}

function exportCsv(rows: Submission[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]) as (keyof Submission)[];
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `enumerator-submissions-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
