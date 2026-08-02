import { useMemo, useState, useEffect } from "react";
import { dateAdd, daysBetween, getTaskStatus, useProject } from "@/lib/rukisha-store";
import type { Task } from "@/lib/rukisha-types";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { TaskDetailModal, CreateTaskModal } from "./TaskModals";
import { Button } from "@/components/ui/button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthStart(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function dayOfWeek(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  return (d.getDay() + 6) % 7; // shift Sun=0 → Mon=0
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Task chip ────────────────────────────────────────────────────────────────

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
          "flex items-center h-5 text-[10px] font-semibold text-white cursor-pointer overflow-hidden shadow-xs",
          "transition-opacity hover:opacity-80",
          isStart ? "rounded-l-full pl-1.5" : "pl-0.5",
          isEnd ? "rounded-r-full pr-1.5" : "pr-0",
        ].join(" ")}
        style={{
          background: color,
          marginLeft: isStart ? 0 : -1,
          marginRight: isEnd ? 0 : -1,
        }}
        title={`${task.activity} (${task.percentComplete}%)`}
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
  isPM,
}: {
  iso: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  cellTasks: CellTask[];
  isPM: boolean;
}) {
  const dayNum = parseInt(iso.slice(8), 10);

  return (
    <div
      className={[
        "group min-h-[95px] border-r border-b border-border p-1 flex flex-col gap-0.5 relative transition-colors",
        isCurrentMonth ? "bg-card" : "bg-muted/20",
        isToday ? "bg-[var(--rk-navy)]/5" : "",
      ].join(" ")}
    >
      {/* Date Header + Plus Button on Hover for PM */}
      <div className="flex items-center justify-between">
        {isPM ? (
          <CreateTaskModal defaultDate={iso}>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-[var(--rk-navy)]"
              title={`Add task starting ${iso}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </CreateTaskModal>
        ) : (
          <div />
        )}

        <div
          className={[
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shrink-0",
            isToday
              ? "bg-[var(--rk-navy)] text-white"
              : isCurrentMonth
              ? "text-foreground"
              : "text-muted-foreground/40",
          ].join(" ")}
        >
          {dayNum}
        </div>
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
          <span className="text-[9px] font-semibold text-muted-foreground pl-1">
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
  const isPM = state.isSuperAdmin || state.userRole === "PM";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [hasAutoJumped, setHasAutoJumped] = useState(false);

  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // ── Months with tasks breakdown ──
  const monthsWithTasks = useMemo(() => {
    const map = new Map<string, { year: number; month: number; count: number; label: string }>();

    state.tasks.forEach((t) => {
      if (!t.planStart || t.planStart.length < 7) return;
      const [yStr, mStr] = t.planStart.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      if (isNaN(y) || isNaN(m)) return;

      const key = `${y}-${m}`;
      if (!map.has(key)) {
        map.set(key, {
          year: y,
          month: m,
          count: 0,
          label: `${MONTH_NAMES[m].slice(0, 3)} '${String(y).slice(2)}`,
        });
      }
      map.get(key)!.count++;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );
  }, [state.tasks]);

  // ── Auto-jump to month containing tasks if current month is empty ──
  useEffect(() => {
    if (!hasAutoJumped && state.tasks.length > 0) {
      const todayY = now.getFullYear();
      const todayM = now.getMonth();
      const todayHasTasks = state.tasks.some((t) => {
        const [y, m] = t.planStart.split("-").map(Number);
        return y === todayY && m === todayM + 1;
      });

      if (!todayHasTasks && monthsWithTasks.length > 0) {
        // Jump to the month with the highest task count
        const busiestMonth = [...monthsWithTasks].sort((a, b) => b.count - a.count)[0];
        if (busiestMonth) {
          setYear(busiestMonth.year);
          setMonth(busiestMonth.month);
        }
      }
      setHasAutoJumped(true);
    }
  }, [state.tasks, monthsWithTasks, hasAutoJumped]);

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

  // Build grid: Mon-aligned weeks
  const grid = useMemo(() => {
    const firstDay = monthStart(year, month);
    const numDays = daysInMonth(year, month);
    const startDow = dayOfWeek(firstDay);

    const cells: string[] = [];
    for (let i = 0; i < startDow; i++) {
      cells.push(dateAdd(firstDay, i - startDow));
    }
    for (let d = 0; d < numDays; d++) {
      cells.push(dateAdd(firstDay, d));
    }
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

  const yearsList = useMemo(() => {
    const curY = new Date().getFullYear();
    return [curY - 1, curY, curY + 1, curY + 2];
  }, []);

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden p-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-card px-4 py-3 rounded-t-xl gap-2">
        <div className="flex items-center gap-3">
          {/* Month & Year Selectors */}
          <div className="flex items-center gap-1.5">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="font-bold text-base bg-transparent text-[var(--rk-navy)] outline-none cursor-pointer border-b border-dashed border-border py-0.5 focus:border-[var(--rk-navy)]"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="font-bold text-base bg-transparent text-[var(--rk-navy)] outline-none cursor-pointer border-b border-dashed border-border py-0.5 focus:border-[var(--rk-navy)]"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-muted-foreground hidden sm:inline">
            • {state.tasks.length} total tasks
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPM && (
            <CreateTaskModal>
              <Button size="sm" className="bg-[var(--rk-navy)] text-white hover:bg-[var(--rk-navy)]/90 shadow-sm mr-1">
                <Plus className="h-4 w-4 mr-1" />
                Add Task
              </Button>
            </CreateTaskModal>
          )}

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

      {/* ── Month Quick Jump Bar ── */}
      {monthsWithTasks.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-4 bg-muted/20 border-b border-border text-xs scrollbar-none">
          <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0 mr-1 flex items-center gap-1">
            <CalendarIcon className="h-3 w-3 text-[var(--rk-navy)]" />
            Months with tasks:
          </span>
          {monthsWithTasks.map((m) => {
            const isActive = year === m.year && month === m.month;
            return (
              <button
                key={`${m.year}-${m.month}`}
                onClick={() => {
                  setYear(m.year);
                  setMonth(m.month);
                }}
                className={[
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all shrink-0 cursor-pointer",
                  isActive
                    ? "bg-[var(--rk-navy)] text-white shadow-xs font-bold"
                    : "bg-background border border-border text-foreground/80 hover:bg-muted hover:text-[var(--rk-navy)]",
                ].join(" ")}
              >
                <span>{m.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground font-bold"
                  }`}
                >
                  {m.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

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

      {/* ── Calendar Grid ── */}
      <div className="grid flex-1 grid-cols-7 border-l border-t border-border overflow-y-auto rounded-b-xl">
        {grid.map((iso) => {
          const isCurrentMonth = parseInt(iso.slice(5, 7), 10) === month + 1;
          const isToday = iso === todayIso;
          const cellTasks = tasksByCell.get(iso) || [];

          return (
            <CalendarCell
              key={iso}
              iso={iso}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              cellTasks={cellTasks}
              isPM={isPM}
            />
          );
        })}
      </div>
    </div>
  );
}
