import { useState } from "react";
import { actions, dateAdd, daysBetween, getTaskStatus, todayISO, useProject } from "@/lib/rukisha-store";
import type { Task, Section } from "@/lib/rukisha-types";
import { LayoutList, Columns } from "lucide-react";
import { TaskDetailModal } from "./GanttChart";

// ─── Types ───────────────────────────────────────────────────────────────────

type KanbanGrouping = "status" | "section";

interface StatusColumn {
  id: "not_started" | "in_progress" | "at_risk" | "complete";
  label: string;
  color: string;
  headerBg: string;
}

const STATUS_COLUMNS: StatusColumn[] = [
  { id: "not_started", label: "Not Started", color: "#94a3b8",            headerBg: "bg-slate-100 dark:bg-slate-800"    },
  { id: "in_progress", label: "In Progress", color: "var(--rk-blue)",     headerBg: "bg-blue-50 dark:bg-blue-950"       },
  { id: "at_risk",     label: "At Risk",     color: "var(--rk-warn)",     headerBg: "bg-amber-50 dark:bg-amber-950"     },
  { id: "complete",    label: "Complete",    color: "#10b981",             headerBg: "bg-emerald-50 dark:bg-emerald-950" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ownerInitials(name: string): string {
  if (!name) return "—";
  const parts = name.split(/[,&]/).map((s) => s.trim()).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) =>
        p.split(" ").filter(Boolean).map((x) => x[0]?.toUpperCase()).join("").slice(0, 2),
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

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  section,
  isDraggable,
  onDragStart,
}: {
  task: Task;
  section?: Section;
  isDraggable: boolean;
  onDragStart: (taskId: string) => void;
}) {
  const today = todayISO();
  const planEnd = dateAdd(task.planStart, task.planDuration);
  const isOverdue = today > planEnd && task.percentComplete < 100;
  const daysLeft = daysBetween(today, planEnd);

  return (
    <TaskDetailModal task={task}>
      <div
        draggable={isDraggable}
        onDragStart={isDraggable ? () => onDragStart(task.id) : undefined}
        className={[
          "group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm",
          "transition-all duration-150 select-none",
          isDraggable
            ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"
            : "cursor-pointer",
        ].join(" ")}
      >
        {/* Activity name */}
        <div className="flex items-start gap-2">
          <span className="flex-1 text-sm font-medium leading-snug text-foreground line-clamp-2">
            {task.activity}
          </span>
          {task.percentComplete >= 100 && (
            <span className="shrink-0 text-emerald-500 text-base leading-none">✓</span>
          )}
        </div>

        {/* Progress bar */}
        {task.percentComplete > 0 && task.percentComplete < 100 && (
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${task.percentComplete}%`,
                background: isOverdue ? "var(--rk-warn)" : "var(--rk-navy)",
              }}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2">
          {task.owner && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
              style={{ background: ownerColor(task.owner) }}
              title={task.owner}
            >
              {ownerInitials(task.owner)}
            </span>
          )}

          {section && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: section.color + "22", color: section.color }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: section.color }} />
              {section.name}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <span
              className={`text-[10px] font-medium ${
                isOverdue
                  ? "text-[var(--rk-danger)]"
                  : daysLeft <= 3
                  ? "text-[var(--rk-warn)]"
                  : "text-muted-foreground"
              }`}
            >
              {isOverdue
                ? `${Math.abs(daysLeft)}d overdue`
                : daysLeft === 0
                ? "Due today"
                : `${daysLeft}d left`}
            </span>
            <span className="text-[10px] text-muted-foreground/50 font-mono">{task.percentComplete}%</span>
          </div>
        </div>
      </div>
    </TaskDetailModal>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  label,
  color,
  headerBg,
  tasks,
  sections,
  mode,
  isDraggable,
  onDragStart,
  onDrop,
}: {
  label: string;
  color: string;
  headerBg: string;
  tasks: Task[];
  sections: Section[];
  mode: KanbanGrouping;
  isDraggable: boolean;
  onDragStart: (taskId: string) => void;
  onDrop: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={[
        "flex min-w-[270px] max-w-[320px] flex-1 flex-col rounded-xl border transition-all duration-150",
        isDragOver
          ? "border-[var(--rk-navy)] bg-[var(--rk-navy)]/5 ring-2 ring-[var(--rk-navy)]/20 scale-[1.01]"
          : "border-border bg-muted/30",
      ].join(" ")}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => { setIsDragOver(false); onDrop(); }}
    >
      {/* Header */}
      <div className={`flex items-center gap-2.5 rounded-t-xl px-3 py-2.5 ${headerBg}`}>
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">{label}</span>
        <span className="ml-auto rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto p-2.5" style={{ maxHeight: "calc(100vh - 190px)" }}>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-3xl opacity-10">□</span>
            <span className="mt-1 text-xs text-muted-foreground/50 italic">Empty</span>
          </div>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            section={mode === "status" ? sections.find((s) => s.id === task.sectionId) : undefined}
            isDraggable={isDraggable}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function KanbanView() {
  const state = useProject();
  const isPM = state.isSuperAdmin || state.userRole === "PM";

  const storageKey = `rk-kanban-mode-${state.id}`;
  const [grouping, setGrouping] = useState<KanbanGrouping>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved === "status" || saved === "section") return saved;
    }
    return "status";
  });
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const handleModeChange = (mode: KanbanGrouping) => {
    setGrouping(mode);
    if (typeof window !== "undefined") localStorage.setItem(storageKey, mode);
  };

  // ── Status mode: update percentComplete based on target column ──
  const handleStatusDrop = (statusId: StatusColumn["id"]) => {
    if (!dragTaskId) return;
    const task = state.tasks.find((t) => t.id === dragTaskId);
    if (!task) return;
    setDragTaskId(null);

    if (statusId === "complete") {
      const today = todayISO();
      actions.updateTask(dragTaskId, {
        percentComplete: 100,
        actualStart: task.actualStart || task.planStart,
        actualDuration: task.actualStart
          ? Math.max(0, daysBetween(task.actualStart, today))
          : task.planDuration,
      });
    } else if (statusId === "not_started") {
      actions.updateTask(dragTaskId, { percentComplete: 0 });
    } else if (statusId === "in_progress") {
      const pct =
        task.percentComplete > 0 && task.percentComplete < 100 ? task.percentComplete : 10;
      actions.updateTask(dragTaskId, {
        percentComplete: pct,
        actualStart: task.actualStart || todayISO(),
      });
    }
    // "at_risk" → status is derived from dates, no explicit pct change needed
  };

  // ── Section mode: update sectionId ──
  const handleSectionDrop = (sectionId: string) => {
    if (!dragTaskId) return;
    actions.updateTask(dragTaskId, { sectionId });
    setDragTaskId(null);
  };

  if (state.tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="text-5xl opacity-20">⬜</div>
        <p className="text-sm text-muted-foreground">
          No tasks yet. Add tasks in the Timeline view first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--rk-navy)]">Kanban Board</h2>
          <p className="text-[11px] text-muted-foreground">
            {state.tasks.length} tasks · {state.sections.length} sections
          </p>
        </div>

        {/* Group toggle — PM only for changing, all can see current mode */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 shadow-sm">
          <span className="px-2 text-[10px] uppercase font-bold text-muted-foreground/50 tracking-wider">
            Group by
          </span>
          {(["status", "section"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => isPM && handleModeChange(mode)}
              title={!isPM ? "Only PMs can change grouping" : undefined}
              className={[
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                grouping === mode
                  ? "bg-[var(--rk-navy)] text-white shadow"
                  : "text-muted-foreground hover:bg-muted",
                !isPM ? "cursor-default" : "",
              ].join(" ")}
            >
              {mode === "status" ? (
                <><LayoutList className="h-3 w-3" /> Status</>
              ) : (
                <><Columns className="h-3 w-3" /> Sections</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {grouping === "status"
          ? STATUS_COLUMNS.map((col) => {
              const colTasks = state.tasks.filter((t) => {
                const s = getTaskStatus(t);
                if (col.id === "complete")    return s.status === "complete";
                if (col.id === "at_risk")     return s.status === "at_risk";
                if (col.id === "in_progress") return s.status === "in_progress";
                return s.status === "not_started";
              });
              return (
                <KanbanColumn
                  key={col.id}
                  label={col.label}
                  color={col.color}
                  headerBg={col.headerBg}
                  tasks={colTasks}
                  sections={state.sections}
                  mode="status"
                  isDraggable={isPM}
                  onDragStart={handleDragStart}
                  onDrop={() => handleStatusDrop(col.id)}
                />
              );
            })
          : state.sections.map((sec) => {
              const colTasks = state.tasks.filter((t) => t.sectionId === sec.id);
              return (
                <KanbanColumn
                  key={sec.id}
                  label={sec.name}
                  color={sec.color}
                  headerBg="bg-muted/50"
                  tasks={colTasks}
                  sections={state.sections}
                  mode="section"
                  isDraggable={isPM}
                  onDragStart={handleDragStart}
                  onDrop={() => handleSectionDrop(sec.id)}
                />
              );
            })}
      </div>
    </div>
  );

  function handleDragStart(taskId: string) {
    setDragTaskId(taskId);
  }
}
