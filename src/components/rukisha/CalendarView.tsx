import { useMemo, useState } from "react";
import { dateAdd, daysBetween, getTaskStatus, useProject } from "@/lib/rukisha-store";
import type { Task } from "@/lib/rukisha-types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TaskDetailModal } from "./GanttChart";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for the first day of a month offset from today */
function monthStart(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** Number of days in a given month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Day of week (0 = Mon, 6 = Sun) for a YYYY-MM-DD string */
function dayOfWeek(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  return (d.getDay() + 6) % 7; // shift Sun=0 → Mon=0
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Task chip (single-day or start/end indicator) ────────────────────────────

function TaskChip({
  task,
  isStart,
  isEnd,
  isContinuation,
}: {
  task: Task;
  isStart: boolean;
  isEnd: boolean;
  isContinuation: boolean;
}) {
  const status = getTaskStatus(task);
  const toneColor: Record<string, string> = {
    complete:    "#10b981",
    in_progress: "var(--rk-blue)",
    at_risk:     "var(--rk-warn)",
    not_started: "#94a3b8",
    overdue:     "var(--rk-danger)",
  };
  const color = toneColor[status.status] ?? "#94a3b8";

  return (
    <TaskDetailModal task={task}>
      <div
        className={[
          "flex items-center h-5 text-[10px] font-semibold text-white cursor-pointer overflow-hidden",
          "transition-opacity hover:opacity-80",
          isStart ? "rounded-l-full pl-1.5" : "pl-0.5",
          isEnd ? "rounded-r-full pr-1.5" : "pr-0",
        ].join(" ")}
        style={{
          background: color,
          marginLeft: isStart ? 0 : -1,
          marginRight: isEnd ? 0 : -1,
        }}
        title={task.activity}
      >
        {(isStart || !isContinuation) && (
          <span className="truncate">{task.activity}</span>
        )}
      </div>
    </TaskDetailModal>
  );
}

// ─── Calendar Cell ────────────────────────────────────────────────────────────

interface CellTask {
  task: Task;
  isStart: boolean;
  isEnd: boolean;
  isContinuation: boolean;
}

function CalendarCell({
  iso,
  isCurrentMonth,
  isToday,
  cellTasks,
}: {
  iso: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  cellTasks: CellTask[];
}) {
  const dayNum = parseInt(iso.slice(8), 10);

  return (
    <div
      className={[
        "min-h-[90px] border-r border-b border-border p-1 flex flex-col gap-0.5",
        isCurrentMonth ? "bg-card" : "bg-muted/20",
        isToday ? "bg-[var(--rk-navy)]/5" : "",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold self-end",
          isToday
            ? "bg-[var(--rk-navy)] text-white"
            : isCurrentMonth
            ? "text-foreground"
            : "text-muted-foreground/40",
        ].join(" ")}
      >
        {dayNum}
      </div>

      {/* Task chips — show up to 3, then "+N more" */}
      <div className="flex flex-col gap-0.5 mt-0.5">
        {cellTasks.slice(0, 3).map(({ task, isStart, isEnd, isContinuation }) => (
          <TaskChip
            key={task.id}
            task={task}
            isStart={isStart}
            isEnd={isEnd}
            isContinuation={isContinuation}
          />
        ))}
        {cellTasks.length > 3 && (
          <span className="text-[9px] text-muted-foreground pl-1">
            +{cellTasks.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Calendar View ───────────────────────────────────────────────────────

export function CalendarView() {
  const state = useProject();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Navigate
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const goToToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  // Build the grid: Mon-aligned weeks
  const grid = useMemo(() => {
    const firstDay = monthStart(year, month);
    const numDays = daysInMonth(year, month);
    const startDow = dayOfWeek(firstDay); // 0=Mon

    // Pad leading days from previous month
    const cells: string[] = [];
    for (let i = 0; i < startDow; i++) {
      cells.push(dateAdd(firstDay, i - startDow));
    }
    for (let d = 0; d < numDays; d++) {
      cells.push(dateAdd(firstDay, d));
    }
    // Pad trailing days to fill last week
    while (cells.length % 7 !== 0) {
      cells.push(dateAdd(cells[cells.length - 1], 1));
    }
    return cells;
  }, [year, month]);

  // Build task-to-date mapping
  const tasksByCell = useMemo(() => {
    const map = new Map<string, CellTask[]>();

    state.tasks.forEach((task) => {
      const start = task.planStart;
      const end = dateAdd(task.planStart, task.planDuration - 1);

      // Iterate each day the task spans
      const span = Math.max(1, task.planDuration);
      for (let d = 0; d < span; d++) {
        const iso = dateAdd(start, d);
        const isStart = d === 0;
        const isEnd = d === span - 1;
        const isContinuation = !isStart;

        if (!map.has(iso)) map.set(iso, []);
        map.get(iso)!.push({ task, isStart, isEnd, isContinuation });
      }
    });

    return map;
  }, [state.tasks]);

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <h2 className="text-base font-bold text-[var(--rk-navy)]">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={goToToday}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 text-foreground/70" />
          </button>
          <button
            onClick={nextMonth}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 text-foreground/70" />
          </button>
        </div>
      </div>

      {/* ── Weekday labels ── */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className={`border-r border-border py-2 text-center text-[11px] font-bold uppercase tracking-wider ${
              d === "Sat" || d === "Sun" ? "text-muted-foreground/50" : "text-muted-foreground"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto border-l border-t border-border">
        {grid.map((iso) => {
          const isCurrentMonth = iso.slice(5, 7) === String(month + 1).padStart(2, "0");
          const isToday = iso === todayIso;
          const cellTasks = tasksByCell.get(iso) ?? [];

          return (
            <CalendarCell
              key={iso}
              iso={iso}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              cellTasks={cellTasks}
            />
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-2">
        {[
          { label: "Complete",    color: "#10b981" },
          { label: "In Progress", color: "var(--rk-blue)" },
          { label: "At Risk",     color: "var(--rk-warn)" },
          { label: "Not Started", color: "#94a3b8" },
          { label: "Overdue",     color: "var(--rk-danger)" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="h-2 w-4 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
