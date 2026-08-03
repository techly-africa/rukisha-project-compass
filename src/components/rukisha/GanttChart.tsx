import { useMemo, useState, useEffect, useRef } from "react";
import {
  actions,
  dateAdd,
  daysBetween,
  getTaskStatus,
  todayISO,
  useProject,
  isWorkingDay,
  getComputedFinishDate,
  getWorkingDaysCount,
} from "@/lib/rukisha-store";
import type { Section, Task, Stakeholder } from "@/lib/rukisha-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskDetailModal, CreateTaskModal } from "./TaskModals";
import { Check, UserPlus, Users, Plus, Eye, Printer, Calendar, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const DAY_W = 32;
const ROW_H = 44; // must match h-11 (2.75rem = 44px) in TaskRow

const COLUMN_CONFIG = [
  { label: "Activity", width: 280 },
  { label: "Owner", width: 140 },
  { label: "Plan Start", width: 120 },
  { label: "Plan Finish", width: 120 },
  { label: "Plan Dur", width: 66 },
  { label: "Actual Start", width: 120 },
  { label: "Actual Finish", width: 120 },
  { label: "Actual Dur", width: 66 },
  { label: "%", width: 60 },
  { label: "Status", width: 110 },
];

const STICKY_W = COLUMN_CONFIG.reduce((acc, c) => acc + c.width, 0);

function ownerInitials(name: string): string {
  if (!name) return "—";
  const parts = name
    .split(/[,&]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 2) return `${parts.length}`;
  return (
    parts
      .map((p) =>
        p
          .split(" ")
          .filter(Boolean)
          .map((x) => x[0]?.toUpperCase())
          .join("")
          .slice(0, 2),
      )
      .join("+") || "—"
  );
}

function ownerColor(name: string): string {
  if (!name) return "transparent";
  const first = name.split(/[,&]/)[0]?.trim() || name;
  let h = 0;
  for (let i = 0; i < first.length; i++) h = (h * 31 + first.charCodeAt(i)) % 360;
  return `oklch(0.7 0.12 ${h})`;
}

function EditableCell({
  value,
  onChange,
  type = "text",
  className = "",
  width,
  suggestions = [],
  disabled = false,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  className?: string;
  width?: number;
  suggestions?: string[];
  disabled?: boolean;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const listId = useMemo(() => "list-" + Math.random().toString(36).slice(2, 7), []);

  return (
    <>
      <input
        type={type}
        list={suggestions.length ? listId : undefined}
        disabled={disabled}
        value={focused ? v : String(value)}
        onFocus={() => {
          if (disabled) return;
          setV(String(value));
          setFocused(true);
        }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setTimeout(() => {
            setFocused(false);
            if (v !== String(value)) onChange(v);
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        style={width ? { width } : undefined}
        className={`w-full bg-transparent outline-none rounded px-1 py-1 text-xs focus:bg-background focus:ring-2 focus:ring-ring ${className}`}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}

function OwnerCell({
  value,
  stakeholders,
  teamMembers = [],
  onChange,
  disabled = false,
}: {
  value: string;
  stakeholders: Stakeholder[];
  teamMembers?: { id: string; email: string; name: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const selectedNames = useMemo(
    () =>
      value
        .split(/[,&]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  const toggle = (name: string) => {
    const next = selectedNames.includes(name)
      ? selectedNames.filter((n) => n !== name).join(", ")
      : [...selectedNames, name].join(", ");
    onChange(next);
  };

  const allSuggestions = [
    ...teamMembers.map((m) => m.name),
    ...stakeholders.map((s) => s.name).filter((n) => !teamMembers.find((m) => m.name === n)),
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex min-w-0 items-center gap-2 px-1 py-1 rounded text-xs hover:bg-muted/60 transition-colors text-left outline-none">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
            style={{ background: ownerColor(value) }}
            title={value || "No owner"}
          >
            {value.includes(",") || value.includes("&") ? (
              <Users className="h-3 w-3" />
            ) : (
              ownerInitials(value)
            )}
          </span>
          <span className="truncate flex-1 font-medium text-foreground/80">
            {value || <span className="text-muted-foreground/50">Unassigned</span>}
          </span>
          <UserPlus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
          Team Members & Stakeholders
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {teamMembers.map((m) => {
            const isSelected = selectedNames.includes(m.name);
            return (
              <button
                key={m.id}
                onClick={() => !disabled && toggle(m.name)}
                className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left"
              >
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    isSelected
                      ? "bg-[var(--rk-navy)] border-[var(--rk-navy)] text-white"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="font-medium text-foreground/80">{m.name}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border pt-2 mt-2">
          <EditableCell
            value={value}
            onChange={onChange}
            className="bg-muted/30 px-2 py-1.5 focus:bg-background"
            suggestions={allSuggestions}
            disabled={disabled}
          />
          <div className="text-[9px] text-muted-foreground px-2 mt-1">
            Manual entry (separate by comma)
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {s.label}
    </span>
  );
}

export function GanttChart() {
  const state = useProject();
  const [frozenCount, setFrozenCount] = useState(2);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPM = state.isSuperAdmin || state.userRole === "PM";

  const range = useMemo(() => {
    const dates = state.tasks.flatMap((t) => [
      t.planStart,
      dateAdd(t.planStart, Math.max(0, t.planDuration - 1)),
    ]);
    dates.push(state.goLiveDate, todayISO());
    const sorted = dates.filter(Boolean).sort();
    const minDate = sorted[0] || todayISO();
    const maxDate = sorted[sorted.length - 1] || todayISO();

    const start = dateAdd(minDate, -3);
    const end = dateAdd(maxDate, 7);
    const total = Math.max(daysBetween(start, end) + 1, 30);
    return { start, end, total };
  }, [state.tasks, state.goLiveDate]);

  const days = useMemo(() => {
    const arr: {
      iso: string;
      date: Date;
      isMonthStart: boolean;
      isWeekend: boolean;
      isHoliday: boolean;
      isToday: boolean;
      isGoLive: boolean;
    }[] = [];
    const today = todayISO();
    const excludeWeekends = state.excludeWeekends ?? true;
    const holidays = state.holidays ?? [];

    for (let i = 0; i < range.total; i++) {
      const iso = dateAdd(range.start, i);
      const [y, m, d] = iso.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidays.includes(iso);

      arr.push({
        iso,
        date,
        isMonthStart: d === 1,
        isWeekend: excludeWeekends && isWeekend,
        isHoliday,
        isToday: iso === today,
        isGoLive: iso === state.goLiveDate,
      });
    }
    return arr;
  }, [range, state.goLiveDate, state.excludeWeekends, state.holidays]);

  const grouped = useMemo(() => {
    return state.sections.map((sec) => ({
      section: sec,
      tasks: state.tasks.filter((t) => t.sectionId === sec.id),
    }));
  }, [state.sections, state.tasks]);

  // View Mode Column Width
  const colWidth = viewMode === "week" ? 90 : viewMode === "month" ? 110 : DAY_W;

  // Grouped timeline columns for Week / Month views
  const timelineColumns = useMemo(() => {
    if (viewMode === "day") {
      return days.map((d, i) => ({
        key: d.iso,
        width: DAY_W,
        title:
          d.isMonthStart || i === 0 ? d.date.toLocaleDateString(undefined, { month: "short" }) : "",
        subtitle: `${d.date.getDate()}`,
        isWeekend: d.isWeekend,
        isHoliday: d.isHoliday,
        isToday: d.isToday,
        isGoLive: d.isGoLive,
      }));
    }

    if (viewMode === "week") {
      const weeks: {
        key: string;
        width: number;
        title: string;
        subtitle: string;
        isWeekend?: boolean;
        isHoliday?: boolean;
        isToday: boolean;
        isGoLive: boolean;
      }[] = [];
      for (let i = 0; i < days.length; i += 7) {
        const chunk = days.slice(i, i + 7);
        if (chunk.length === 0) break;
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        const weekNum = Math.ceil((i + 1) / 7);
        weeks.push({
          key: `w-${first.iso}`,
          width: 90,
          title: `Week ${weekNum}`,
          subtitle: `${first.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${last.date.getDate()}`,
          isToday: chunk.some((d) => d.isToday),
          isGoLive: chunk.some((d) => d.isGoLive),
        });
      }
      return weeks;
    }

    // Month view
    const monthsMap = new Map<
      string,
      {
        key: string;
        width: number;
        title: string;
        subtitle: string;
        isWeekend?: boolean;
        isHoliday?: boolean;
        isToday: boolean;
        isGoLive: boolean;
      }
    >();
    days.forEach((d) => {
      const monthKey = d.iso.slice(0, 7);
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, {
          key: monthKey,
          width: 110,
          title: d.date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
          subtitle: "Month",
          isToday: d.isToday,
          isGoLive: d.isGoLive,
        });
      } else {
        const m = monthsMap.get(monthKey)!;
        if (d.isToday) m.isToday = true;
        if (d.isGoLive) m.isGoLive = true;
      }
    });
    return Array.from(monthsMap.values());
  }, [days, viewMode]);

  useEffect(() => {
    if (scrollRef.current && days.length > 0) {
      const today = todayISO();
      const todayIdx = days.findIndex((d) => d.iso === today);
      if (todayIdx !== -1) {
        const offset = (todayIdx / (viewMode === "week" ? 7 : 1)) * colWidth;
        scrollRef.current.scrollLeft = offset;
      }
    }
  }, [days.length, state.id, viewMode, colWidth]);

  const totalTimelineWidth = timelineColumns.reduce((sum, c) => sum + c.width, 0);
  const totalWidth = STICKY_W + totalTimelineWidth;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Control Bar: View Switcher & Print Button */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border no-print shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[var(--rk-navy)] dark:text-[var(--rk-gold)]" />
            Gantt Zoom:
          </span>
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 shadow-sm">
            {(["day", "week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                  viewMode === m
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m} View
              </button>
            ))}
          </div>

          {(state.excludeWeekends || (state.holidays?.length ?? 0) > 0) && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-md border border-border/50">
              <span className="font-medium">Calendar:</span>
              {state.excludeWeekends && <span className="text-foreground">Excl. Weekends</span>}
              {state.excludeWeekends && (state.holidays?.length ?? 0) > 0 && <span>•</span>}
              {(state.holidays?.length ?? 0) > 0 && (
                <span className="text-foreground">{state.holidays?.length} Holidays</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted transition-colors shadow-sm text-foreground"
            title="Print or export Gantt chart to PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Export PDF
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-auto scrollbar-thin print-full scroll-smooth flex-1"
        style={{ maxHeight: "calc(100vh - 110px)" }}
      >
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-card shadow-sm">
            <HeaderSticky frozenCount={frozenCount} onSetFrozenCount={setFrozenCount} />
            <div className="relative flex">
              {timelineColumns.map((col) => (
                <div
                  key={col.key}
                  style={{ width: col.width }}
                  className={`flex h-14 shrink-0 flex-col items-center justify-center border-r border-border text-[10px] ${
                    col.isWeekend || col.isHoliday ? "bg-muted/50" : ""
                  } ${col.isToday ? "bg-[var(--rk-danger)]/10" : ""} ${col.isGoLive ? "bg-[var(--rk-gold)]/15" : ""}`}
                  title={col.isHoliday ? "Holiday" : col.isWeekend ? "Weekend" : undefined}
                >
                  {col.title && (
                    <div className="font-semibold text-foreground truncate px-1">{col.title}</div>
                  )}
                  <div className="text-muted-foreground truncate px-1">{col.subtitle}</div>
                  {col.isGoLive && (
                    <div className="text-[var(--rk-gold)] text-sm leading-none">★</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {grouped.map(({ section, tasks }) => (
            <div key={section.id} className="relative">
              <SectionRow
                section={section}
                timelineWidth={totalTimelineWidth}
                frozenCount={frozenCount}
              />
              {tasks.map((task, idx) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  rangeStart={range.start}
                  days={days}
                  timelineColumns={timelineColumns}
                  viewMode={viewMode}
                  timelineWidth={totalTimelineWidth}
                  rowIndex={idx}
                  isLast={idx === tasks.length - 1}
                  frozenCount={frozenCount}
                />
              ))}
              {/* Dependency arrows SVG overlay */}
              <DependencyOverlay
                tasks={tasks}
                allTasks={state.tasks}
                rangeStart={range.start}
                timelineWidth={totalTimelineWidth}
                viewMode={viewMode}
              />
              {isPM && (
                <div
                  className={`${frozenCount > 0 ? "sticky left-0 z-10" : "relative"} flex bg-background`}
                  style={{
                    width: COLUMN_CONFIG.slice(0, Math.max(1, frozenCount)).reduce(
                      (a, b) => a + b.width,
                      0,
                    ),
                  }}
                >
                  <button
                    onClick={() => actions.addTask(section.id)}
                    className="m-2 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    + Add task to {section.name}
                  </button>
                </div>
              )}
              <div
                style={{
                  width:
                    STICKY_W -
                    COLUMN_CONFIG.slice(0, Math.max(1, frozenCount)).reduce(
                      (a, b) => a + b.width,
                      0,
                    ),
                }}
              />
              <div style={{ width: totalTimelineWidth }} />
            </div>
          ))}

          <div className="flex border-t border-border">
            {isPM && (
              <div
                className={`${frozenCount > 0 ? "sticky left-0 z-10" : "relative"} bg-background p-3`}
                style={{
                  width: COLUMN_CONFIG.slice(0, Math.max(1, frozenCount)).reduce(
                    (a, b) => a + b.width,
                    0,
                  ),
                }}
              >
                <AddSectionDialog />
              </div>
            )}
            <div
              style={{
                width:
                  STICKY_W -
                  COLUMN_CONFIG.slice(0, Math.max(1, frozenCount)).reduce((a, b) => a + b.width, 0),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderSticky({
  frozenCount,
  onSetFrozenCount,
}: {
  frozenCount: number;
  onSetFrozenCount: (count: number) => void;
}) {
  return (
    <>
      {COLUMN_CONFIG.map((c, i) => {
        const isSticky = i < frozenCount;
        const leftOffset = COLUMN_CONFIG.slice(0, i).reduce((sum, col) => sum + col.width, 0);
        const isRightmostFrozen = i === frozenCount - 1;

        return (
          <div
            key={c.label}
            className={`group relative flex h-14 items-center border-r border-border px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-card transition-shadow duration-200 ${
              isSticky ? "sticky z-30" : "relative z-10"
            } ${isRightmostFrozen ? "shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]" : ""}`}
            style={{
              width: c.width,
              left: isSticky ? leftOffset : undefined,
            }}
          >
            {c.label}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetFrozenCount(i + 1 === frozenCount ? 0 : i + 1);
              }}
              className={`ml-auto rounded p-1 transition-all opacity-0 group-hover:opacity-100 ${i < frozenCount ? "text-[var(--rk-gold)] opacity-100" : "text-gray-300 hover:text-foreground"}`}
              title={i < frozenCount ? "Unfreeze from here" : "Freeze up to here"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20M2 12h20M12 9l3 3-3 3M12 9l-3 3 3 3M20 7l-3 3 3 3M4 7l3 3-3 3" />
              </svg>
            </button>
          </div>
        );
      })}
    </>
  );
}

function DependencyOverlay({
  tasks,
  allTasks,
  rangeStart,
  timelineWidth,
  viewMode,
}: {
  tasks: Task[];
  allTasks: Task[];
  rangeStart: string;
  timelineWidth: number;
  viewMode: "day" | "week" | "month";
}) {
  if (!tasks.some((t) => (t.dependencies?.length ?? 0) > 0)) return null;

  const scale = viewMode === "week" ? 90 / 7 : viewMode === "month" ? 110 / 30.437 : DAY_W;
  const svgW = timelineWidth;
  const svgH = tasks.length * ROW_H;
  const sectionRowH = 36;

  const arrows: React.ReactNode[] = [];

  tasks.forEach((task, toIdx) => {
    const deps = task.dependencies ?? [];
    deps.forEach((depId) => {
      const fromTask = tasks.find((t) => t.id === depId) ?? allTasks.find((t) => t.id === depId);
      if (!fromTask || fromTask.percentComplete >= 100) return;
      const fromIdx = tasks.indexOf(fromTask);
      if (fromIdx < 0) return;

      const fromPlanEndPixel = dateAdd(fromTask.planStart, fromTask.planDuration);
      const fromX = Math.max(0, daysBetween(rangeStart, fromPlanEndPixel)) * scale;
      const toX = Math.max(0, daysBetween(rangeStart, task.planStart)) * scale;

      const fromY = sectionRowH + fromIdx * ROW_H + ROW_H / 2;
      const toY = sectionRowH + toIdx * ROW_H + ROW_H / 2;

      const fromPlanFinish = dateAdd(fromTask.planStart, Math.max(0, fromTask.planDuration - 1));
      const isViolation = fromPlanFinish > task.planStart;
      const color = isViolation ? "var(--rk-danger)" : "#94a3b8";

      const midX = fromX + Math.abs(toX - fromX) * 0.5;
      const arrowSize = 5;
      const key = `${fromTask.id}->${task.id}`;

      if (fromY === toY) {
        arrows.push(
          <g key={key}>
            <path
              d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
              stroke={color}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={isViolation ? "4 2" : undefined}
              opacity={0.7}
            />
            <polygon
              points={`${toX},${toY} ${toX - arrowSize},${toY - arrowSize / 2} ${toX - arrowSize},${toY + arrowSize / 2}`}
              fill={color}
              opacity={0.7}
            />
          </g>,
        );
      } else {
        arrows.push(
          <g key={key}>
            <path
              d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
              stroke={color}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={isViolation ? "4 2" : undefined}
              opacity={0.7}
            />
            <polygon
              points={`${toX},${toY} ${toX - arrowSize},${toY - arrowSize / 2} ${toX - arrowSize},${toY + arrowSize / 2}`}
              fill={color}
              opacity={0.7}
            />
          </g>,
        );
      }
    });
  });

  if (arrows.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute top-0 z-10"
      style={{ left: STICKY_W, width: svgW, height: svgH + sectionRowH }}
      overflow="visible"
    >
      {arrows}
    </svg>
  );
}

function SectionRow({
  section,
  timelineWidth,
  frozenCount,
}: {
  section: Section;
  timelineWidth: number;
  frozenCount: number;
}) {
  const state = useProject();
  const isPM = state.isSuperAdmin || state.userRole === "PM";

  return (
    <div className="flex border-b border-border bg-[var(--rk-light)]">
      {COLUMN_CONFIG.map((c, i) => {
        const isSticky = i < frozenCount;
        const leftOffset = COLUMN_CONFIG.slice(0, i).reduce((sum, col) => sum + col.width, 0);

        return (
          <div
            key={c.label}
            className={`${isSticky ? "sticky z-20 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]" : "relative"} flex items-center bg-[var(--rk-light)] px-3 py-2 border-r border-border/50`}
            style={{
              width: c.width,
              left: isSticky ? leftOffset : undefined,
            }}
          >
            {i === 0 && (
              <>
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ background: section.color }}
                />
                <input
                  value={section.name}
                  onChange={(e) => actions.updateSection(section.id, { name: e.target.value })}
                  className="bg-transparent text-sm font-bold text-[var(--rk-navy)] outline-none focus:ring-1 focus:ring-ring rounded px-1 truncate flex-1"
                  disabled={!isPM}
                />
                {isPM && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="ml-2 text-[10px] text-muted-foreground/60 hover:text-[var(--rk-danger)]">
                        ✕
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the section <strong>"{section.name}"</strong>{" "}
                          and all its associated tasks. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => actions.deleteSection(section.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete Section
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}
          </div>
        );
      })}
      <div style={{ width: timelineWidth }} className="bg-[var(--rk-light)]/50" />
    </div>
  );
}

export { TaskDetailModal, CreateTaskModal };

function TaskRow({
  task,
  rangeStart,
  days,
  timelineColumns,
  viewMode,
  timelineWidth,
  isLast,
  rowIndex: _rowIndex,
  frozenCount,
}: {
  task: Task;
  rangeStart: string;
  days: {
    iso: string;
    isWeekend: boolean;
    isHoliday: boolean;
    isToday: boolean;
    isGoLive: boolean;
  }[];
  timelineColumns: {
    key: string;
    width: number;
    title?: string;
    subtitle?: string;
    isWeekend?: boolean;
    isHoliday?: boolean;
    isToday?: boolean;
    isGoLive?: boolean;
  }[];
  viewMode: "day" | "week" | "month";
  timelineWidth: number;
  isLast: boolean;
  rowIndex: number;
  frozenCount: number;
}) {
  const state = useProject();
  const isPM = state.isSuperAdmin || state.userRole === "PM";
  const isStaff = state.isSuperAdmin || state.userRole === "PM" || state.userRole === "Staff";
  const today = todayISO();

  const scale = viewMode === "week" ? 90 / 7 : viewMode === "month" ? 110 / 30.437 : DAY_W;

  const planStartDay = daysBetween(rangeStart, task.planStart);
  const planLeft = Math.max(0, planStartDay * scale);
  const planWidth = Math.max(scale, task.planDuration * scale);

  // Inclusive Plan Finish Date for display (accounting for working days/holidays)
  const planFinish = getComputedFinishDate(
    task.planStart,
    task.planDuration,
    state.excludeWeekends,
    state.holidays,
  );

  // Inclusive Actual Finish Date for display
  const actualFinish = task.actualStart
    ? dateAdd(task.actualStart, Math.max(0, (task.actualDuration || task.planDuration) - 1))
    : "";

  const actualLeft = task.actualStart
    ? Math.max(0, daysBetween(rangeStart, task.actualStart) * scale)
    : planLeft;

  const effectiveDur = task.actualDuration || task.planDuration;
  const actualWidth = Math.max(scale, effectiveDur * scale);

  const isComplete = task.percentComplete >= 100;
  const isProgressing = task.percentComplete > 0 && !isComplete;
  const isOverrun = today > planFinish && !isComplete;

  let barColor = "var(--rk-bar-progress)";
  if (isComplete) barColor = "var(--rk-bar-done)";
  else if (isOverrun && isProgressing) barColor = "var(--rk-bar-overrun-progress)";
  else if (isOverrun) barColor = "var(--rk-bar-overrun)";
  else if (!isProgressing) barColor = "transparent";

  return (
    <div className={`group flex border-b border-border hover:bg-muted/40 ${isLast ? "" : ""}`}>
      {COLUMN_CONFIG.map((c, i) => {
        const isSticky = i < frozenCount;
        const leftOffset = COLUMN_CONFIG.slice(0, i).reduce((sum, col) => sum + col.width, 0);
        const isRightmostFrozen = i === frozenCount - 1;

        const cellProps = {
          className: `flex h-11 items-center border-r border-border transition-shadow duration-200 ${
            isSticky ? "sticky z-10 bg-card/90 backdrop-blur-sm" : "relative z-0"
          } ${isRightmostFrozen ? "shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]" : ""}`,
          style: {
            width: c.width,
            left: isSticky ? leftOffset : undefined,
          },
        };

        if (i === 0) {
          const completed = task.subTasks?.filter((st) => st.isCompleted).length || 0;
          const total = task.subTasks?.length || 0;

          return (
            <div key={c.label} {...cellProps}>
              {isPM && (
                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => actions.moveTask(task.id, -1)}
                    className="px-1 text-[10px] text-muted-foreground hover:text-foreground"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => actions.moveTask(task.id, 1)}
                    className="px-1 text-[10px] text-muted-foreground hover:text-foreground"
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>
              )}
              <div className="flex-1 flex items-center min-w-0 pl-1 group/title">
                <TaskDetailModal task={task}>
                  <div className="p-1 cursor-pointer hover:bg-muted/50 rounded-sm mr-1">
                    <Eye className="h-3 w-3 text-muted-foreground opacity-40 group-hover/title:opacity-100 transition-opacity" />
                  </div>
                </TaskDetailModal>
                <EditableCell
                  value={task.activity}
                  onChange={(v) => actions.updateTask(task.id, { activity: v })}
                  className="flex-1 font-medium truncate"
                  disabled={!isPM}
                />
                {total > 0 && (
                  <span
                    className={`ml-1.5 text-[9px] font-bold px-1 rounded-full shrink-0 ${completed === total ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {completed}/{total}
                  </span>
                )}
              </div>
              {isPM && (
                <button
                  onClick={() => actions.deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 px-2 text-xs text-muted-foreground hover:text-[var(--rk-danger)]"
                  title="Delete"
                >
                  ✕
                </button>
              )}
            </div>
          );
        }

        if (i === 1) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} pr-1`}>
              <OwnerCell
                value={task.owner}
                stakeholders={state.stakeholders}
                teamMembers={state.teamMembers}
                onChange={(v) => actions.updateTask(task.id, { owner: v })}
                disabled={!isPM}
              />
            </div>
          );
        }

        if (i === 2) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="date"
                value={task.planStart}
                onChange={(v) => actions.updateTask(task.id, { planStart: v })}
                className="text-xs"
                disabled={!isPM}
              />
            </div>
          );
        }

        if (i === 3) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="date"
                value={planFinish}
                onChange={(v) => {
                  if (v) {
                    const newDur = Math.max(
                      1,
                      getWorkingDaysCount(task.planStart, v, state.excludeWeekends, state.holidays),
                    );
                    actions.updateTask(task.id, { planDuration: newDur });
                  }
                }}
                className="text-xs font-medium"
                disabled={!isPM}
              />
            </div>
          );
        }

        if (i === 4) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="number"
                value={task.planDuration}
                onChange={(v) =>
                  actions.updateTask(task.id, { planDuration: Math.max(1, parseInt(v) || 1) })
                }
                className="text-xs text-center"
                disabled={!isPM}
              />
            </div>
          );
        }

        if (i === 5) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="date"
                value={task.actualStart ?? ""}
                onChange={(v) => {
                  if (v && actualFinish) {
                    const newDur = Math.max(1, daysBetween(v, actualFinish) + 1);
                    actions.updateTask(task.id, { actualStart: v, actualDuration: newDur });
                  } else {
                    actions.updateTask(task.id, { actualStart: v || null });
                  }
                }}
                className="text-xs"
                disabled={!isStaff}
              />
            </div>
          );
        }

        if (i === 6) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="date"
                value={actualFinish}
                onChange={(v) => {
                  if (v) {
                    const start = task.actualStart || task.planStart;
                    const newDur = Math.max(1, daysBetween(start, v) + 1);
                    actions.updateTask(task.id, {
                      actualStart: start,
                      actualDuration: newDur,
                    });
                  }
                }}
                className="text-xs"
                disabled={!isStaff}
              />
            </div>
          );
        }

        if (i === 7) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="number"
                value={task.actualDuration}
                onChange={(v) =>
                  actions.updateTask(task.id, { actualDuration: Math.max(0, parseInt(v) || 0) })
                }
                className="text-xs text-center"
                disabled={!isStaff}
              />
            </div>
          );
        }

        if (i === 8) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="number"
                value={task.percentComplete}
                onChange={(v) => {
                  const pct = Math.min(100, Math.max(0, parseInt(v) || 0));
                  const updates: Partial<Task> = { percentComplete: pct };

                  if (pct === 100) {
                    const today = todayISO();
                    if (!task.actualStart) {
                      updates.actualStart = task.planStart;
                      updates.actualDuration = task.planDuration;
                    } else {
                      updates.actualDuration = Math.max(
                        1,
                        daysBetween(task.actualStart, today) + 1,
                      );
                    }
                  }

                  actions.updateTask(task.id, updates);
                }}
                className="text-xs text-center font-semibold"
                disabled={!isStaff}
              />
            </div>
          );
        }

        if (i === 9) {
          return (
            <div
              key={c.label}
              {...cellProps}
              className={`${cellProps.className} justify-center px-2`}
            >
              <StatusBadge task={task} />
            </div>
          );
        }

        return null;
      })}

      {/* Timeline */}
      <div className="relative" style={{ width: timelineWidth, height: 44 }}>
        {/* column backgrounds */}
        <div className="absolute inset-0 flex">
          {timelineColumns.map((col) => (
            <div
              key={col.key}
              style={{ width: col.width }}
              className={`shrink-0 border-r border-border ${
                col.isWeekend || col.isHoliday ? "bg-muted/40" : ""
              } ${col.isToday ? "bg-[var(--rk-danger)]/8" : ""} ${col.isGoLive ? "bg-[var(--rk-gold)]/15" : ""}`}
            />
          ))}
        </div>
        {/* planned bar - thin reference line */}
        <div
          className="gantt-bar absolute top-2.5 h-1.5 rounded-full opacity-40"
          style={{
            left: planLeft,
            width: planWidth,
            background: "#94a3b8",
            border: "1px solid rgba(0,0,0,0.05)",
          }}
          title={`Planned: ${task.planStart} → ${planFinish}`}
        />

        {/* actual background bar - main bar */}
        <div
          className="gantt-bar absolute top-5 h-5 rounded-[2px] overflow-hidden"
          style={{
            left: actualLeft,
            width: actualWidth,
            background: isOverrun ? "#E6AC5C" : "#CBBED1",
            backgroundImage:
              "repeating-linear-gradient(-45deg,transparent,transparent 2px,rgba(255,255,255,0.3) 2px,rgba(255,255,255,0.3) 4px)",
            opacity: 1,
            border: "1px solid rgba(0,0,0,0.1)",
          }}
        >
          {/* actual progress bar */}
          {task.percentComplete > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${task.percentComplete}%`,
                background: isOverrun ? "#E6AC5C" : "var(--rk-navy)",
                opacity: 1,
              }}
            />
          )}
        </div>
        {/* today line */}
        {days.some((d) => d.isToday) && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--rk-danger)] z-10 pointer-events-none"
            style={{ left: daysBetween(rangeStart, today) * scale + scale / 2 }}
          />
        )}
      </div>
    </div>
  );
}

function AddSectionDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleAdd = () => {
    if (name.trim()) {
      actions.addSection(name.trim());
      setName("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-xs font-semibold text-[var(--rk-navy)] hover:underline">
          + Add New Section
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <label className="text-xs font-semibold">Section Name</label>
          <Input
            placeholder="e.g., Phase 3 - Testing"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add Section</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
