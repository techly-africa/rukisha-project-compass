import { useMemo, useState } from "react";
import { dateAdd, daysBetween, getTaskStatus, useProject } from "@/lib/rukisha-store";
import type { Task } from "@/lib/rukisha-types";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  // Build grid: Mon-aligned weeks
  const grid = useMemo(() => {
    const firstDay = monthStart(year, month);
    const numDays = daysInMonth(year, month);
    const startDow = dayOfWeek(firstDay); // 0=Mon

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

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 rounded-t-xl">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-[var(--rk-navy)]">
            {MONTH_NAMES[month]} {year}
          </h2>
          <span className="text-xs text-muted-foreground">
            {state.tasks.length} tasks scheduled
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPM && (
            <CreateTaskModal>
              <Button size="sm" className="bg-[var(--rk-navy)] text-white hover:bg-[var(--rk-navy)]/90 shadow-sm mr-2">
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
