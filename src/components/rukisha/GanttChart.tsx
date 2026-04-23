import { useMemo, useState } from "react";
import { actions, dateAdd, daysBetween, getTaskStatus, todayISO, useProject } from "@/lib/rukisha-store";
import type { Section, Task } from "@/lib/rukisha-types";

const DAY_W = 32;
const STICKY_W = 880; // sum of sticky cols

function ownerInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "—";
}

function ownerColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `oklch(0.7 0.12 ${h})`;
}

function formatShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EditableCell({
  value,
  onChange,
  type = "text",
  className = "",
  width,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  className?: string;
  width?: number;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={focused ? v : String(value)}
      onFocus={() => {
        setV(String(value));
        setFocused(true);
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (v !== String(value)) onChange(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      style={width ? { width } : undefined}
      className={`bg-transparent outline-none rounded px-2 py-1 text-sm focus:bg-background focus:ring-2 focus:ring-ring ${className}`}
    />
  );
}

function StatusBadge({ task }: { task: Task }) {
  const s = getTaskStatus(task);
  const tone = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-[var(--rk-blue)]/15 text-[var(--rk-blue)]",
    accent: "bg-[var(--rk-gold)]/20 text-[oklch(0.45_0.12_85)]",
    warn: "bg-[var(--rk-warn)]/15 text-[var(--rk-warn)]",
    danger: "bg-[var(--rk-danger)]/15 text-[var(--rk-danger)]",
  }[s.tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{s.label}</span>;
}

export function GanttChart() {
  const state = useProject();

  const range = useMemo(() => {
    const dates = state.tasks.flatMap((t) => [t.planStart, dateAdd(t.planStart, t.planDuration)]);
    dates.push(state.goLiveDate, todayISO());
    const sorted = dates.sort();
    const start = dateAdd(sorted[0] ?? todayISO(), -3);
    const end = dateAdd(sorted[sorted.length - 1] ?? todayISO(), 5);
    const total = Math.max(daysBetween(start, end), 30);
    return { start, end, total };
  }, [state.tasks, state.goLiveDate]);

  const days = useMemo(() => {
    const arr: { iso: string; date: Date; isMonthStart: boolean; isWeekend: boolean; isToday: boolean; isGoLive: boolean }[] = [];
    const today = todayISO();
    for (let i = 0; i < range.total; i++) {
      const iso = dateAdd(range.start, i);
      const date = new Date(iso + "T00:00:00");
      arr.push({
        iso,
        date,
        isMonthStart: date.getDate() === 1,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: iso === today,
        isGoLive: iso === state.goLiveDate,
      });
    }
    return arr;
  }, [range, state.goLiveDate]);

  const grouped = useMemo(() => {
    return state.sections.map((sec) => ({
      section: sec,
      tasks: state.tasks.filter((t) => t.sectionId === sec.id),
    }));
  }, [state.sections, state.tasks]);

  const totalWidth = STICKY_W + days.length * DAY_W;

  return (
    <div className="overflow-auto scrollbar-thin print-full" style={{ maxHeight: "calc(100vh - 60px)" }}>
      <div style={{ width: totalWidth, minWidth: "100%" }}>
        {/* Header */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-card">
          <HeaderSticky />
          <div className="relative flex">
            {days.map((d, i) => (
              <div
                key={d.iso}
                className={`flex h-14 w-8 flex-col items-center justify-center border-r border-border text-[10px] ${
                  d.isWeekend ? "bg-muted/40" : ""
                } ${d.isToday ? "bg-[var(--rk-danger)]/10" : ""} ${d.isGoLive ? "bg-[var(--rk-gold)]/15" : ""}`}
              >
                {d.isMonthStart || i === 0 ? (
                  <div className="font-semibold text-foreground">
                    {d.date.toLocaleDateString(undefined, { month: "short" })}
                  </div>
                ) : null}
                <div className="text-muted-foreground">{d.date.getDate()}</div>
                {d.isGoLive && <div className="text-[var(--rk-gold)] text-sm leading-none">★</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        {grouped.map(({ section, tasks }) => (
          <div key={section.id}>
            <SectionRow section={section} daysCount={days.length} />
            {tasks.map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                rangeStart={range.start}
                days={days}
                isLast={idx === tasks.length - 1}
              />
            ))}
            <div className="flex">
              <div className="sticky left-0 z-10 flex bg-background" style={{ width: STICKY_W }}>
                <button
                  onClick={() => actions.addTask(section.id)}
                  className="m-2 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  + Add task to {section.name}
                </button>
              </div>
              <div style={{ width: days.length * DAY_W }} />
            </div>
          </div>
        ))}

        <div className="flex border-t border-border">
          <div className="sticky left-0 z-10 bg-background p-3" style={{ width: STICKY_W }}>
            <button
              onClick={() => {
                const name = prompt("Section name?");
                if (name) actions.addSection(name);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              + Add section
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderSticky() {
  const cols = ["Activity", "Owner", "Plan Start", "Plan Dur", "Actual Start", "Actual Dur", "% Complete", "Status"];
  const widths = [240, 140, 110, 80, 110, 80, 100, 110];
  return (
    <div className="sticky left-0 z-30 flex bg-card" style={{ width: STICKY_W }}>
      {cols.map((c, i) => (
        <div
          key={c}
          className="flex h-14 items-center border-r border-border px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          style={{ width: widths[i] }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

function SectionRow({ section, daysCount }: { section: Section; daysCount: number }) {
  return (
    <div className="flex border-b border-border bg-[var(--rk-light)]">
      <div className="sticky left-0 z-10 flex items-center gap-2 bg-[var(--rk-light)] px-3 py-2" style={{ width: STICKY_W }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: section.color }} />
        <input
          value={section.name}
          onChange={(e) => actions.updateSection(section.id, { name: e.target.value })}
          className="bg-transparent text-sm font-semibold text-[var(--rk-navy)] outline-none focus:ring-2 focus:ring-ring rounded px-1"
        />
        <button
          onClick={() => {
            if (confirm(`Delete section "${section.name}" and its tasks?`)) actions.deleteSection(section.id);
          }}
          className="ml-auto text-xs text-muted-foreground hover:text-[var(--rk-danger)]"
        >
          ✕
        </button>
      </div>
      <div style={{ width: daysCount * DAY_W }} className="bg-[var(--rk-light)]" />
    </div>
  );
}

function TaskRow({
  task,
  rangeStart,
  days,
  isLast,
}: {
  task: Task;
  rangeStart: string;
  days: { iso: string; isWeekend: boolean; isToday: boolean; isGoLive: boolean }[];
  isLast: boolean;
}) {
  const widths = [240, 140, 110, 80, 110, 80, 100, 110];
  const today = todayISO();

  const planStartDay = daysBetween(rangeStart, task.planStart);
  const planLeft = planStartDay * DAY_W;
  const planWidth = task.planDuration * DAY_W;

  const actualLeft = task.actualStart ? daysBetween(rangeStart, task.actualStart) * DAY_W : planLeft;
  const actualDur = task.actualDuration || task.planDuration;
  const actualWidth = actualDur * DAY_W;

  // Determine actual bar color
  const planEnd = dateAdd(task.planStart, task.planDuration);
  const isComplete = task.percentComplete >= 100;
  const isOverrun = today > planEnd && !isComplete;
  const isProgressing = task.percentComplete > 0 && !isComplete;

  let barColor = "var(--rk-bar-progress)";
  if (isComplete) barColor = "var(--rk-bar-done)";
  else if (isOverrun && isProgressing) barColor = "var(--rk-bar-overrun-progress)";
  else if (isOverrun) barColor = "var(--rk-bar-overrun)";
  else if (!isProgressing) barColor = "transparent";

  return (
    <div className={`group flex border-b border-border hover:bg-muted/40 ${isLast ? "" : ""}`}>
      <div className="sticky left-0 z-10 flex bg-background group-hover:bg-muted/40" style={{ width: STICKY_W }}>
        <div className="flex items-center border-r border-border" style={{ width: widths[0] }}>
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => actions.moveTask(task.id, -1)} className="px-1 text-[10px] text-muted-foreground hover:text-foreground" title="Move up">▲</button>
            <button onClick={() => actions.moveTask(task.id, 1)} className="px-1 text-[10px] text-muted-foreground hover:text-foreground" title="Move down">▼</button>
          </div>
          <EditableCell
            value={task.activity}
            onChange={(v) => actions.updateTask(task.id, { activity: v })}
            className="flex-1 font-medium"
          />
          <button
            onClick={() => actions.deleteTask(task.id)}
            className="opacity-0 group-hover:opacity-100 px-2 text-xs text-muted-foreground hover:text-[var(--rk-danger)]"
            title="Delete"
          >
            ✕
          </button>
        </div>
        <div className="flex items-center gap-2 border-r border-border px-2" style={{ width: widths[1] }}>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: ownerColor(task.owner) }}
            title={task.owner}
          >
            {ownerInitials(task.owner)}
          </span>
          <EditableCell value={task.owner} onChange={(v) => actions.updateTask(task.id, { owner: v })} className="flex-1 text-xs" />
        </div>
        <div className="flex items-center border-r border-border" style={{ width: widths[2] }}>
          <EditableCell type="date" value={task.planStart} onChange={(v) => actions.updateTask(task.id, { planStart: v })} className="text-xs" />
        </div>
        <div className="flex items-center border-r border-border" style={{ width: widths[3] }}>
          <EditableCell type="number" value={task.planDuration} onChange={(v) => actions.updateTask(task.id, { planDuration: Math.max(1, parseInt(v) || 1) })} className="text-xs" />
        </div>
        <div className="flex items-center border-r border-border" style={{ width: widths[4] }}>
          <EditableCell type="date" value={task.actualStart ?? ""} onChange={(v) => actions.updateTask(task.id, { actualStart: v || null })} className="text-xs" />
        </div>
        <div className="flex items-center border-r border-border" style={{ width: widths[5] }}>
          <EditableCell type="number" value={task.actualDuration} onChange={(v) => actions.updateTask(task.id, { actualDuration: Math.max(0, parseInt(v) || 0) })} className="text-xs" />
        </div>
        <div className="flex items-center gap-2 border-r border-border px-2" style={{ width: widths[6] }}>
          <input
            type="range"
            min={0}
            max={100}
            value={task.percentComplete}
            onChange={(e) => actions.updateTask(task.id, { percentComplete: parseInt(e.target.value) })}
            className="flex-1 accent-[var(--rk-blue)]"
          />
          <span className="w-8 text-right text-xs tabular-nums">{task.percentComplete}%</span>
        </div>
        <div className="flex items-center px-2" style={{ width: widths[7] }}>
          <StatusBadge task={task} />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative" style={{ width: days.length * DAY_W, height: 44 }}>
        {/* day backgrounds */}
        <div className="absolute inset-0 flex">
          {days.map((d) => (
            <div
              key={d.iso}
              className={`w-8 border-r border-border ${d.isWeekend ? "bg-muted/30" : ""} ${d.isToday ? "bg-[var(--rk-danger)]/8" : ""} ${d.isGoLive ? "bg-[var(--rk-gold)]/15" : ""}`}
            />
          ))}
        </div>
        {/* planned bar */}
        <div
          className="gantt-bar absolute top-2 h-3 rounded"
          style={{
            left: planLeft,
            width: planWidth,
            background: "var(--rk-bar-planned)",
            border: "1px solid var(--rk-blue)",
            opacity: 0.6,
          }}
          title={`Planned: ${task.planStart} → ${dateAdd(task.planStart, task.planDuration)}`}
        />
        {/* actual / progress bar */}
        {(isProgressing || isComplete || isOverrun) && (
          <div
            className="gantt-bar absolute top-6 h-4 overflow-hidden rounded shadow-sm"
            style={{
              left: actualLeft,
              width: actualWidth,
              background: barColor,
            }}
            title={`${task.percentComplete}% complete`}
          >
            <div
              className="h-full"
              style={{
                width: `${task.percentComplete}%`,
                background: "rgba(255,255,255,0.25)",
              }}
            />
          </div>
        )}
        {/* today line */}
        {days.some((d) => d.isToday) && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--rk-danger)]"
            style={{ left: daysBetween(rangeStart, today) * DAY_W + DAY_W / 2 }}
          />
        )}
      </div>
    </div>
  );
}
