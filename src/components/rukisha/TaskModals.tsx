import { useState, useEffect } from "react";
import {
  actions,
  daysBetween,
  getTaskStatus,
  todayISO,
  useProject,
} from "@/lib/rukisha-store";
import type { Task } from "@/lib/rukisha-types";
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
import { Plus, Trash2, Calendar, User, Folder, CheckSquare, Link as LinkIcon, Edit3 } from "lucide-react";

// ─── CREATE TASK MODAL ────────────────────────────────────────────────────────

export function CreateTaskModal({
  defaultSectionId,
  defaultDate,
  defaultPercentComplete,
  children,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  defaultSectionId?: string;
  defaultDate?: string;
  defaultPercentComplete?: number;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const state = useProject();
  const isPM = state.isSuperAdmin || state.userRole === "PM";

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen || setInternalOpen;

  const [activity, setActivity] = useState("");
  const [sectionId, setSectionId] = useState(defaultSectionId || state.sections[0]?.id || "");
  const [owner, setOwner] = useState("");
  const [planStart, setPlanStart] = useState(defaultDate || todayISO());
  const [planDuration, setPlanDuration] = useState(5);
  const [percentComplete, setPercentComplete] = useState(defaultPercentComplete || 0);

  // Sync defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setActivity("");
      setSectionId(defaultSectionId || state.sections[0]?.id || "");
      setOwner("");
      setPlanStart(defaultDate || todayISO());
      setPlanDuration(5);
      setPercentComplete(defaultPercentComplete || 0);
    }
  }, [isOpen, defaultSectionId, defaultDate, defaultPercentComplete, state.sections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity.trim()) {
      toast.error("Please enter a task activity name");
      return;
    }
    const targetSection = sectionId || state.sections[0]?.id;
    if (!targetSection) {
      toast.error("Please select or create a project section first");
      return;
    }

    await actions.addTask(targetSection, {
      activity: activity.trim(),
      owner,
      planStart,
      planDuration: Math.max(1, Number(planDuration) || 1),
      percentComplete: Number(percentComplete) || 0,
    });

    setOpen(false);
  };

  if (!isPM) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[var(--rk-navy)]">
            <Plus className="h-5 w-5 text-[var(--rk-navy)]" />
            Add New Task
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Activity Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Activity Name *
            </label>
            <Input
              autoFocus
              placeholder="e.g. System Integration Testing"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="h-9"
              required
            />
          </div>

          {/* Section & Owner Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Folder className="h-3 w-3" /> Section
              </label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {state.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Owner / Assignee
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Unassigned</option>
                {state.teamMembers.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Plan Start & Duration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Plan Start Date
              </label>
              <Input
                type="date"
                value={planStart}
                onChange={(e) => setPlanStart(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Duration (Days)
              </label>
              <Input
                type="number"
                min="1"
                max="365"
                value={planDuration}
                onChange={(e) => setPlanDuration(Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>

          {/* Initial % Complete */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Initial Progress</span>
              <span className="font-mono text-foreground font-bold">{percentComplete}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={percentComplete}
              onChange={(e) => setPercentComplete(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[var(--rk-navy)]"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[var(--rk-navy)] hover:bg-[var(--rk-navy)]/90 text-white">
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── TASK DETAIL & EDIT MODAL ──────────────────────────────────────────────────

export function TaskDetailModal({ task, children }: { task: Task; children: React.ReactNode }) {
  const state = useProject();
  const isPM = state.isSuperAdmin || state.userRole === "PM";

  const [isEditing, setIsEditing] = useState(false);

  // Form edit state
  const [activity, setActivity] = useState(task.activity);
  const [owner, setOwner] = useState(task.owner || "");
  const [sectionId, setSectionId] = useState(task.sectionId);
  const [planStart, setPlanStart] = useState(task.planStart);
  const [planDuration, setPlanDuration] = useState(task.planDuration);
  const [actualStart, setActualStart] = useState(task.actualStart || "");
  const [actualDuration, setActualDuration] = useState(task.actualDuration || 0);
  const [percentComplete, setPercentComplete] = useState(task.percentComplete);

  // Checklist & Dependency states
  const [newSubTask, setNewSubTask] = useState("");
  const [selectedDependency, setSelectedDependency] = useState("");
  const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
  const [editingSubTaskTitle, setEditingSubTaskTitle] = useState("");

  // Sync props when task changes
  useEffect(() => {
    setActivity(task.activity);
    setOwner(task.owner || "");
    setSectionId(task.sectionId);
    setPlanStart(task.planStart);
    setPlanDuration(task.planDuration);
    setActualStart(task.actualStart || "");
    setActualDuration(task.actualDuration || 0);
    setPercentComplete(task.percentComplete);
  }, [task]);

  const handleSave = async () => {
    if (!activity.trim()) {
      toast.error("Activity name cannot be empty");
      return;
    }

    await actions.updateTask(task.id, {
      activity: activity.trim(),
      owner,
      sectionId,
      planStart,
      planDuration: Math.max(1, Number(planDuration) || 1),
      actualStart: actualStart || null,
      actualDuration: Number(actualDuration) || 0,
      percentComplete: Number(percentComplete) || 0,
    });

    setIsEditing(false);
    toast.success("Task updated");
  };

  const handleArchive = async () => {
    await actions.deleteTask(task.id);
    toast.success("Task archived");
  };

  const completedCount = task.subTasks?.filter((st) => st.isCompleted).length || 0;
  const totalCount = task.subTasks?.length || 0;
  const currentDependencies = task.dependencies || [];
  const availableTasks = state.tasks.filter(
    (t) => t.id !== task.id && !currentDependencies.includes(t.id),
  );

  const status = getTaskStatus(task);
  const statusColor: Record<string, string> = {
    complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    not_started: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="flex-1 space-y-1">
              {isEditing ? (
                <Input
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  className="text-lg font-bold h-9"
                  placeholder="Task activity name"
                />
              ) : (
                <DialogTitle className="text-xl font-bold text-[var(--rk-navy)] leading-snug">
                  {task.activity}
                </DialogTitle>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor[status.status]}`}>
                  {status.label}
                </span>
                <span>•</span>
                <span>{task.owner || "Unassigned"}</span>
                <span>•</span>
                <span className="font-mono">{task.percentComplete}% Complete</span>
              </div>
            </div>

            {isPM && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant={isEditing ? "default" : "outline"}
                  onClick={isEditing ? handleSave : () => setIsEditing(true)}
                  className={isEditing ? "bg-[var(--rk-navy)] text-white" : ""}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  {isEditing ? "Save" : "Edit"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive Task?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to archive <strong>"{task.activity}"</strong>? It will be removed from all views.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleArchive} className="bg-red-600 hover:bg-red-700 text-white">
                        Archive Task
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── EDIT FORM / READONLY GRID ── */}
        {isEditing ? (
          <div className="mt-2 space-y-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Folder className="h-3 w-3" /> Section
                </label>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none"
                >
                  {state.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Owner
                </label>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none"
                >
                  <option value="">Unassigned</option>
                  {state.teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Plan Start</label>
                <Input
                  type="date"
                  value={planStart}
                  onChange={(e) => setPlanStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Plan Duration</label>
                <Input
                  type="number"
                  min="1"
                  value={planDuration}
                  onChange={(e) => setPlanDuration(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Actual Start</label>
                <Input
                  type="date"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Actual Duration</label>
                <Input
                  type="number"
                  min="0"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* % Progress slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                <span>Progress (% Complete)</span>
                <span className="font-mono text-foreground font-bold">{percentComplete}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={percentComplete}
                onChange={(e) => setPercentComplete(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[var(--rk-navy)]"
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Plan Start</span>
              <div className="text-sm font-medium">{task.planStart}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Plan Duration</span>
              <div className="text-sm font-medium">{task.planDuration} days</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Actual Start</span>
              <div className="text-sm font-medium">{task.actualStart || "Not started"}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Actual Duration</span>
              <div className="text-sm font-medium">
                {task.actualDuration > 0 ? `${task.actualDuration} days` : "-"}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKLIST & DEPENDENCIES GRID ── */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Checklist */}
          <div className="space-y-3 border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-[var(--rk-navy)]" />
              Checklist ({completedCount}/{totalCount})
            </h4>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {task.subTasks?.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-2 group px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={st.isCompleted}
                    onChange={(e) => actions.toggleSubTask(task.id, st.id, e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-gray-300 text-[var(--rk-navy)] focus:ring-[var(--rk-navy)] cursor-pointer"
                  />
                  {editingSubTaskId === st.id ? (
                    <input
                      autoFocus
                      value={editingSubTaskTitle}
                      onChange={(e) => setEditingSubTaskTitle(e.target.value)}
                      onBlur={() => {
                        if (editingSubTaskTitle.trim() && editingSubTaskTitle !== st.title) {
                          actions.updateSubTask(task.id, st.id, {
                            title: editingSubTaskTitle.trim(),
                          });
                        }
                        setEditingSubTaskId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingSubTaskId(null);
                      }}
                      className="flex-1 text-xs border-b border-[var(--rk-navy)] bg-transparent outline-none py-0.5"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        if (isPM) {
                          setEditingSubTaskId(st.id);
                          setEditingSubTaskTitle(st.title);
                        }
                      }}
                      title={isPM ? "Click to edit title" : undefined}
                      className={`flex-1 text-xs ${
                        st.isCompleted ? "line-through text-muted-foreground/60" : "text-foreground"
                      } ${isPM ? "cursor-text hover:text-[var(--rk-navy)]" : ""}`}
                    >
                      {st.title}
                    </span>
                  )}

                  {state.teamMembers.length > 0 && (
                    <select
                      value={st.assignee || ""}
                      onChange={(e) =>
                        actions.updateSubTask(task.id, st.id, { assignee: e.target.value })
                      }
                      disabled={!isPM}
                      className="shrink-0 text-[10px] border border-border rounded px-1 py-0.5 bg-transparent max-w-[85px] text-muted-foreground focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {state.teamMembers.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {isPM && (
                    <button
                      onClick={() => actions.deleteSubTask(task.id, st.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-[var(--rk-danger)] transition-opacity shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {totalCount === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground/60 italic">
                  No checklist items yet.
                </div>
              )}
            </div>

            {isPM && (
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Add checklist item..."
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSubTask.trim()) {
                      actions.addSubTask(task.id, newSubTask.trim());
                      setNewSubTask("");
                    }
                  }}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (newSubTask.trim()) {
                      actions.addSubTask(task.id, newSubTask.trim());
                      setNewSubTask("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>

          {/* Dependencies */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-[var(--rk-navy)]" />
              Dependencies ({currentDependencies.length})
            </h4>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {currentDependencies.map((depId) => {
                const depTask = state.tasks.find((t) => t.id === depId);
                return (
                  <div
                    key={depId}
                    className="flex items-center justify-between group px-2 py-1 rounded-md bg-muted/30 border border-border/50 text-xs"
                  >
                    <span className="truncate mr-2 font-medium" title={depTask?.activity}>
                      {depTask?.activity || "Unknown Task"}
                    </span>
                    {isPM && (
                      <button
                        onClick={() => actions.removeDependency(task.id, depId)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-[var(--rk-danger)] transition-opacity"
                        title="Remove dependency"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}

              {currentDependencies.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground/60 italic">
                  No task dependencies.
                </div>
              )}
            </div>

            {isPM && availableTasks.length > 0 && (
              <div className="flex gap-2 pt-1">
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none"
                  value={selectedDependency}
                  onChange={(e) => setSelectedDependency(e.target.value)}
                >
                  <option value="" disabled>
                    Select dependent task...
                  </option>
                  {availableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.activity}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                  disabled={!selectedDependency}
                  onClick={() => {
                    if (selectedDependency) {
                      actions.addDependency(task.id, selectedDependency);
                      setSelectedDependency("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
