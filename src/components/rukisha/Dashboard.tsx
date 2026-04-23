import { useMemo } from "react";
import { dateAdd, daysBetween, getTaskStatus, todayISO, useProject } from "@/lib/rukisha-store";

function Card({ label, value, hint, tone = "default" }: { label: string; value: string | number; hint?: string; tone?: "default" | "good" | "warn" | "bad" | "accent" }) {
  const toneClass = {
    default: "text-foreground",
    good: "text-[oklch(0.55_0.15_150)]",
    warn: "text-[var(--rk-warn)]",
    bad: "text-[var(--rk-danger)]",
    accent: "text-[oklch(0.5_0.13_85)]",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Donut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="20" />
        {segments.map((s) => {
          const len = total > 0 ? (s.value / total) * c : 0;
          const dash = `${len} ${c - len}`;
          const offset = -acc;
          acc += len;
          return (
            <circle
              key={s.label}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={dash}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-foreground">{s.label}</span>
            <span className="text-muted-foreground tabular-nums">{Math.round(s.value)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const state = useProject();
  const today = todayISO();

  const stats = useMemo(() => {
    const total = state.tasks.length;
    let onTrack = 0, atRisk = 0, overdue = 0, complete = 0, sumPct = 0;
    for (const t of state.tasks) {
      sumPct += t.percentComplete;
      const s = getTaskStatus(t);
      if (s.status === "complete") complete++;
      else if (s.tone === "danger") overdue++;
      else if (s.tone === "warn") atRisk++;
      else onTrack++;
    }
    const overall = total > 0 ? Math.round(sumPct / total) : 0;
    const daysToGo = daysBetween(today, state.goLiveDate);
    return { total, onTrack, atRisk, overdue, complete, overall, daysToGo };
  }, [state.tasks, state.goLiveDate, today]);

  const sectionDonut = useMemo(() => {
    const palette = ["var(--rk-navy)", "var(--rk-blue)", "var(--rk-gold)", "var(--rk-warn)", "var(--rk-success)"];
    const segs = state.sections.map((sec, i) => {
      const tasks = state.tasks.filter((t) => t.sectionId === sec.id);
      const avg = tasks.length ? tasks.reduce((a, b) => a + b.percentComplete, 0) / tasks.length : 0;
      return { label: sec.name, value: avg, color: palette[i % palette.length] };
    });
    return { segs, total: segs.reduce((a, b) => a + b.value, 0) };
  }, [state.sections, state.tasks]);

  const milestones = useMemo(() => {
    return state.tasks
      .map((t) => ({ ...t, end: dateAdd(t.planStart, t.planDuration) }))
      .filter((t) => t.end >= today)
      .sort((a, b) => a.end.localeCompare(b.end))
      .slice(0, 6);
  }, [state.tasks, today]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card label="Total tasks" value={stats.total} />
        <Card label="On track" value={stats.onTrack} tone="good" />
        <Card label="At risk" value={stats.atRisk} tone="warn" />
        <Card label="Overdue" value={stats.overdue} tone="bad" />
        <Card label="Overall" value={`${stats.overall}%`} tone="accent" hint="Weighted progress" />
        <Card
          label="Days to go-live"
          value={stats.daysToGo}
          hint={state.goLiveDate}
          tone={stats.daysToGo < 0 ? "bad" : stats.daysToGo < 7 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completion by section</h3>
          <div className="mt-4">
            <Donut segments={sectionDonut.segs} total={sectionDonut.total} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming milestones</h3>
          <ol className="mt-4 space-y-3">
            {milestones.length === 0 && <li className="text-sm text-muted-foreground">No upcoming milestones.</li>}
            {milestones.map((m) => {
              const sec = state.sections.find((s) => s.id === m.sectionId);
              const days = daysBetween(today, m.end);
              return (
                <li key={m.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-md bg-[var(--rk-navy)] text-primary-foreground">
                    <span className="text-[9px] uppercase">
                      {new Date(m.end).toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="text-sm font-bold leading-none">{new Date(m.end).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.activity}</div>
                    <div className="text-xs text-muted-foreground">
                      {sec?.name} • {m.owner || "Unassigned"}
                    </div>
                  </div>
                  <span className={`text-xs tabular-nums ${days < 0 ? "text-[var(--rk-danger)]" : days < 3 ? "text-[var(--rk-warn)]" : "text-muted-foreground"}`}>
                    {days < 0 ? `${-days}d late` : days === 0 ? "today" : `in ${days}d`}
                  </span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 border-t border-border pt-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--rk-gold)] text-[var(--rk-navy)] text-lg">★</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">GO LIVE</div>
                <div className="text-xs text-muted-foreground">{state.goLiveDate}</div>
              </div>
              <span className="text-xs font-medium text-[oklch(0.5_0.13_85)]">
                {stats.daysToGo}d
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
