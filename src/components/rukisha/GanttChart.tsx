import { useMemo, useState } from "react";
import {
  actions,
  dateAdd,
  daysBetween,
  getTaskStatus,
  todayISO,
  useProject,
} from "@/lib/rukisha-store";
import type { Section, Task, Stakeholder } from "@/lib/rukisha-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, UserPlus, Users, Plus } from "lucide-react";
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

const COLUMN_CONFIG = [
  { label: "Activity", width: 280 },
  { label: "Owner", width: 140 },
  { label: "Plan Start", width: 130 },
  { label: "Plan Dur", width: 66 },
  { label: "Actual Start", width: 130 },
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
  suggestions = [],
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  className?: string;
  width?: number;
  suggestions?: string[];
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const listId = useMemo(() => "list-" + Math.random().toString(36).slice(2, 7), []);

  return (
    <>
      <input
        type={type}
        list={suggestions.length ? listId : undefined}
        value={focused ? v : String(value)}
        onFocus={() => {
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
  onChange,
}: {
  value: string;
  stakeholders: Stakeholder[];
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const selectedNames = useMemo(
    () =>
      value
        .split(/[,&]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  const toggle = (name: string) => {
    let next;
    if (selectedNames.includes(name)) {
      next = selectedNames.filter((n) => n !== name).join(", ");
    } else {
      next = [...selectedNames, name].join(", ");
    }
    onChange(next);
  };

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
        <div className="space-y-1 mb-2">
          <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
            Stakeholders
          </div>
          {stakeholders.length === 0 && (
            <div className="text-[11px] text-muted-foreground px-2 py-2">
              No stakeholders defined in setup.
            </div>
          )}
          {stakeholders.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.name)}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left"
            >
              <div
                className={`h-4 w-4 rounded border flex items-center justify-center ${selectedNames.includes(s.name) ? "bg-[var(--rk-navy)] border-[var(--rk-navy)] text-white" : "border-border"}`}
              >
                {selectedNames.includes(s.name) && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">{s.role}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-border pt-2">
          <EditableCell
            value={value}
            onChange={onChange}
            className="bg-muted/30 px-2 py-1.5 focus:bg-background"
            suggestions={stakeholders.map((s) => s.name)}
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
    const arr: {
      iso: string;
      date: Date;
      isMonthStart: boolean;
      isWeekend: boolean;
      isToday: boolean;
      isGoLive: boolean;
    }[] = [];
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
    <div
      className="overflow-auto scrollbar-thin print-full"
      style={{ maxHeight: "calc(100vh - 60px)" }}
    >
      <div style={{ width: totalWidth, minWidth: "100%" }}>
        {/* Header */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-card">
          <HeaderSticky frozenCount={frozenCount} onSetFrozenCount={setFrozenCount} />
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
            <SectionRow section={section} daysCount={days.length} frozenCount={frozenCount} />
            {tasks.map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                rangeStart={range.start}
                days={days}
                isLast={idx === tasks.length - 1}
                frozenCount={frozenCount}
              />
            ))}
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
            <div
              style={{
                width:
                  STICKY_W -
                  COLUMN_CONFIG.slice(0, Math.max(1, frozenCount)).reduce((a, b) => a + b.width, 0),
              }}
            />
            <div style={{ width: days.length * DAY_W }} />
          </div>
        ))}

        <div className="flex border-t border-border">
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
    <div className="flex bg-card">
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
    </div>
  );
}

function SectionRow({
  section,
  daysCount,
  frozenCount,
}: {
  section: Section;
  daysCount: number;
  frozenCount: number;
}) {
  const frozenWidth = COLUMN_CONFIG.slice(0, Math.max(0, frozenCount)).reduce(
    (sum, c) => sum + c.width,
    0,
  );

  return (
    <div className="flex border-b border-border bg-[var(--rk-light)]">
      <div
        className={`${frozenCount > 0 ? "sticky left-0 z-20 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]" : "relative"} flex items-center gap-2 bg-[var(--rk-light)] px-3 py-2`}
        style={{ width: frozenWidth || 100 }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: section.color }} />
        <input
          value={section.name}
          onChange={(e) => actions.updateSection(section.id, { name: e.target.value })}
          className="bg-transparent text-sm font-semibold text-[var(--rk-navy)] outline-none focus:ring-2 focus:ring-ring rounded px-1"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="ml-auto text-xs text-muted-foreground hover:text-[var(--rk-danger)]">
              ✕
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Section?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the section <strong>"{section.name}"</strong> and all
                its associated tasks. This action cannot be undone.
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
      </div>
      <div style={{ width: STICKY_W - frozenWidth }} className="bg-[var(--rk-light)]" />
      <div style={{ width: daysCount * DAY_W }} className="bg-[var(--rk-light)]" />
    </div>
  );
}

function TaskRow({
  task,
  rangeStart,
  days,
  isLast,
  frozenCount,
}: {
  task: Task;
  rangeStart: string;
  days: { iso: string; isWeekend: boolean; isToday: boolean; isGoLive: boolean }[];
  isLast: boolean;
  frozenCount: number;
}) {
  const state = useProject();
  const today = todayISO();

  const planStartDay = daysBetween(rangeStart, task.planStart);
  const planLeft = planStartDay * DAY_W;
  const planWidth = task.planDuration * DAY_W;

  const actualLeft = task.actualStart
    ? daysBetween(rangeStart, task.actualStart) * DAY_W
    : planLeft;
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
      {COLUMN_CONFIG.map((c, i) => {
        const isSticky = i < frozenCount;
        const leftOffset = COLUMN_CONFIG.slice(0, i).reduce((sum, col) => sum + col.width, 0);
        const isRightmostFrozen = i === frozenCount - 1;

        const cellProps = {
          className: `flex items-center border-r border-border bg-background group-hover:bg-muted/40 transition-colors duration-150 ${
            isSticky ? "sticky z-10" : "relative"
          } ${isRightmostFrozen ? "shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]" : ""}`,
          style: {
            width: c.width,
            left: isSticky ? leftOffset : undefined,
          },
        };

        if (i === 0) {
          return (
            <div key={c.label} {...cellProps}>
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
          );
        }

        if (i === 1) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} pr-1`}>
              <OwnerCell
                value={task.owner}
                stakeholders={state.stakeholders}
                onChange={(v) => actions.updateTask(task.id, { owner: v })}
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
              />
            </div>
          );
        }

        if (i === 3) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="number"
                value={task.planDuration}
                onChange={(v) =>
                  actions.updateTask(task.id, { planDuration: Math.max(1, parseInt(v) || 1) })
                }
                className="text-xs text-center"
              />
            </div>
          );
        }

        if (i === 4) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="date"
                value={task.actualStart ?? ""}
                onChange={(v) => actions.updateTask(task.id, { actualStart: v || null })}
                className="text-xs"
              />
            </div>
          );
        }

        if (i === 5) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="number"
                value={task.actualDuration}
                onChange={(v) =>
                  actions.updateTask(task.id, { actualDuration: Math.max(0, parseInt(v) || 0) })
                }
                className="text-xs text-center"
              />
            </div>
          );
        }

        if (i === 6) {
          return (
            <div key={c.label} {...cellProps} className={`${cellProps.className} px-1`}>
              <EditableCell
                type="number"
                value={task.percentComplete}
                onChange={(v) =>
                  actions.updateTask(task.id, {
                    percentComplete: Math.min(100, Math.max(0, parseInt(v) || 0)),
                  })
                }
                className="text-xs text-center font-semibold"
              />
            </div>
          );
        }

        if (i === 7) {
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
          className="gantt-bar absolute top-2 h-3 rounded-[1px] opacity-60"
          style={{
            left: planLeft,
            width: planWidth,
            background: "#CBBED1",
            backgroundImage:
              "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.4) 2px,rgba(255,255,255,0.4) 4px)",
            border: "1px solid rgba(0,0,0,0.1)",
          }}
          title={`Planned: ${task.planStart} → ${planEnd}`}
        />

        {/* actual background bar */}
        <div
          className="gantt-bar absolute top-6 h-4 rounded-[1px] overflow-hidden"
          style={{
            left: actualLeft,
            width: actualWidth,
            background: today > planEnd ? "#E6AC5C" : "#CBBED1",
            backgroundImage:
              "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.4) 2px,rgba(255,255,255,0.4) 4px)",
            opacity: 0.8,
            border: "1px solid rgba(0,0,0,0.05)",
          }}
        >
          {/* actual progress bar */}
          {task.percentComplete > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${task.percentComplete}%`,
                background: today > planEnd ? "#E6AC5C" : "var(--rk-navy)",
                opacity: 1,
              }}
            />
          )}
        </div>
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
function AddSectionDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleAdd = () => {
    if (name.trim()) {
      actions.addSection(name.trim());
      setName("");
      setOpen(false);
      toast.success("Section added successfully");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted font-medium flex items-center gap-2">
          <Plus className="h-3 w-3" /> Add section
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Section</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <div className="text-sm text-muted-foreground">
            Give your section a clear name (e.g., Phase 1: Planning).
          </div>
          <Input
            placeholder="e.g. Technical Implementation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} className="bg-[var(--rk-navy)] text-white hover:opacity-90">
            Create Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
