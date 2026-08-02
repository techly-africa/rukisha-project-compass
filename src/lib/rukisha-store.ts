import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectState, Section, Task, Stakeholder, ProjectInfo } from "./rukisha-types";
import { toast } from "sonner";

export type { ProjectInfo };

/**
 * Platform Global State Controllers
 * Moved to top-level to ensure universal scope availability across all mission modules.
 */
let loadingPromise: Promise<void> | null = null;
let currentChannel: any = null;
let state: ProjectState;
let projectId: string | null = null;
let loaded = false;
let userEmail: string | null = null;
let isSuperAdmin = false;
let projectList: ProjectInfo[] = [];
// Prevents the no-email path from calling emit() on every re-render
let noEmailHandled = false;

export function todayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const emptyState: ProjectState = {
  id: null,
  projectName: "Loading...",
  goLiveDate: todayISO(28),
  stakeholders: [],
  sections: [],
  tasks: [],
  teamMembers: [],
  darkMode: false,
  userProjects: [],
  userEmail: null,
  isSuperAdmin: false,
};

state = emptyState;

const projectCache = new Map<string, ProjectState>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(updater: (s: ProjectState) => ProjectState) {
  state = updater(state);
  emit();
}

export function getState(): ProjectState {
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// --- Mapping helpers ---
type DbSection = { id: string; name: string; color: string; position: number };
type DbTask = {
  id: string;
  section_id: string;
  activity: string;
  owner: string;
  plan_start: string;
  plan_duration: number;
  actual_start: string | null;
  actual_duration: number;
  percent_complete: number;
  position: number;
};
type DbStakeholder = { id: string; name: string; role: string };

type DbSubTask = { id: string; task_id: string; title: string; is_completed: boolean };

/**
 * Normalize any date string coming from the DB to a plain YYYY-MM-DD string.
 * Postgres DATE columns are returned as full UTC timestamps like "2026-08-03T00:00:00.000Z".
 * Slicing to 10 chars strips the time component and avoids timezone-shift bugs
 * that would misalign Gantt bars in non-UTC locales.
 */
function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).slice(0, 10);
}

function mapSection(s: DbSection): Section {
  return { id: s.id, name: s.name, color: s.color };
}
function mapTask(
  t: DbTask,
  subtasks: DbSubTask[] = [],
  dependencies: string[] = [],
  comments: any[] = [],
  attachments: any[] = [],
): Task {
  return {
    id: t.id,
    sectionId: t.section_id,
    activity: t.activity,
    owner: t.owner,
    planStart: normalizeDate(t.plan_start),
    planDuration: t.plan_duration,
    actualStart: t.actual_start ? normalizeDate(t.actual_start) : null,
    actualDuration: t.actual_duration,
    percentComplete: t.percent_complete,
    subTasks: subtasks.map(mapSubTask),
    dependencies,
    description: (t as any).description || "",
    comments: comments.map((c: any) => ({
      id: c.id,
      taskId: c.task_id,
      author: c.author,
      content: c.content,
      createdAt: c.created_at,
    })),
    attachments: attachments.map((a: any) => ({
      id: a.id,
      taskId: a.task_id,
      name: a.name,
      url: a.url,
      size: a.size || "",
      createdAt: a.created_at,
    })),
  };
}
function mapSubTask(s: DbSubTask) {
  return {
    id: s.id,
    taskId: s.task_id,
    title: s.title,
    isCompleted: s.is_completed,
    assignee: (s as any).assignee ?? "",
  };
}
function mapStakeholder(s: DbStakeholder): Stakeholder {
  return { id: s.id, name: s.name, role: s.role };
}

// --- Load + Realtime ---
async function loadAll(id?: string) {
  if (loadingPromise && !id) return loadingPromise;

  loadingPromise = (async () => {
    const email = (
      typeof window !== "undefined" ? localStorage.getItem("rk-email") : null
    )?.toLowerCase();

    if (!email) {
      // Guard: only signal "no session" once, not on every re-render
      if (!noEmailHandled) {
        noEmailHandled = true;
        loaded = true;
        emit();
      }
      return;
    }
    noEmailHandled = false; // Reset if email appears
    const normalized = email.trim().toLowerCase();

    if (userEmail === normalized && loaded && !id) return;

    userEmail = normalized;

    const { data: projectListRaw, error: listErr } = await (supabase as any).rpc(
      "get_user_projects",
      {
        p_email: userEmail,
      },
    );

    if (listErr) {
      console.error("Discovery failed:", listErr);
      setState((s) => ({ ...s, userProjects: [], id: null, userEmail, isSuperAdmin }));
      loaded = true;
      emit();
      return;
    }

    projectList = (projectListRaw || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      goLiveDate: p.go_live_date,
      updatedAt: p.updated_at,
      isArchived: p.is_archived,
      progress: Number(p.progress || 0),
    }));

    const { data: adminData } = await (supabase as any)
      .from("rk_superadmins")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();
    isSuperAdmin = !!adminData;

    if (projectList.length === 0) {
      setState((s) => ({ ...s, userProjects: [], id: null, userEmail, isSuperAdmin }));
      loaded = true;
      emit();
      return;
    }

    let targetId = id || projectId;
    if (!targetId && projectList.length > 0) {
      if (state.id && projectList.find((p: any) => p.id === state.id)) {
        targetId = state.id;
      } else {
        targetId = projectList[0].id;
      }
    }

    if (!targetId) {
      setState((s) => ({ ...s, userProjects: projectList, id: null, userEmail, isSuperAdmin }));
      loaded = true;
      emit();
      return;
    }

    projectId = targetId;

    const cached = projectCache.get(targetId);
    if (cached && !id) {
      state = { ...cached, userProjects: projectList, userEmail, isSuperAdmin };
      loaded = true;
      emit();
    }

    try {
      const [
        { data: project },
        { data: sections },
        { data: tasks },
        { data: stakeholders },
        { data: teamMember },
        { data: allTeamMembers },
      ] = await Promise.all([
        supabase.from("rk_project").select("*").eq("id", targetId).maybeSingle(),
        supabase.from("rk_sections").select("*").eq("project_id", targetId).order("position"),
        supabase.from("rk_tasks").select("*").eq("project_id", targetId).order("position"),
        supabase.from("rk_stakeholders").select("*").eq("project_id", targetId).order("name"),
        supabase
          .from("rk_team")
          .select("role")
          .eq("project_id", targetId)
          .eq("email", userEmail)
          .maybeSingle(),
        supabase.from("rk_team").select("id, email, name").eq("project_id", targetId).order("name"),
      ]);

      let subtasks: any[] = [];
      let dependencies: any[] = [];
      let comments: any[] = [];
      let attachments: any[] = [];
      if (tasks && tasks.length > 0) {
        const taskIds = tasks.map((t: DbTask) => t.id);
        const [stRes, depsRes, commRes, attRes] = await Promise.all([
          supabase.from("rk_subtasks").select("*").in("task_id", taskIds),
          supabase.from("rk_task_dependencies").select("*").in("task_id", taskIds),
          (supabase as any).from("rk_task_comments").select("*").in("task_id", taskIds).order("created_at"),
          (supabase as any).from("rk_task_attachments").select("*").in("task_id", taskIds).order("created_at"),
        ]);
        subtasks = stRes.data || [];
        dependencies = depsRes.data || [];
        comments = commRes.data || [];
        attachments = attRes.data || [];
      }

      if (!project) {
        setState((s) => ({ ...s, id: null, userProjects: projectList, userEmail, isSuperAdmin }));
        loaded = true;
        emit();
        return;
      }

      const localDark =
        typeof window !== "undefined" ? localStorage.getItem("rk-dark") === "1" : false;

      const newState: ProjectState = {
        id: project.id,
        projectName: project.name,
        goLiveDate: project.go_live_date,
        stakeholders: (stakeholders || []).map(mapStakeholder),
        sections: (sections || []).map(mapSection),
        tasks: (tasks || []).map((t: DbTask) =>
          mapTask(
            t,
            (subtasks || []).filter((st: any) => st.task_id === t.id),
            (dependencies || [])
              .filter((d: any) => d.task_id === t.id)
              .map((d: any) => d.depends_on_task_id),
            (comments || []).filter((c: any) => c.task_id === t.id),
            (attachments || []).filter((a: any) => a.task_id === t.id),
          ),
        ),
        teamMembers: (allTeamMembers || []).map((m: any) => ({
          id: m.id,
          email: m.email,
          name: m.name || m.email,
        })),
        darkMode: localDark,
        userProjects: projectList,
        userEmail,
        userRole:
          !(teamMember as any)?.role || (teamMember as any)?.role === "Member"
            ? "Staff"
            : (teamMember as any).role,
        isSuperAdmin,
        excludeWeekends: project.exclude_weekends ?? true,
        holidays: project.holidays ?? [],
      };

      projectCache.set(project.id, newState);
      state = newState;
      loaded = true;
      emit();
    } catch (err) {
      console.error("Failed to load project details:", err);
      setState((s) => ({ ...s, userProjects: projectList, userEmail, isSuperAdmin }));
      loaded = true;
      emit();
    }
  })().finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

function startRealtime() {
  if (!projectId) return;

  if (currentChannel) {
    supabase.removeChannel(currentChannel);
  }

  currentChannel = supabase
    .channel(`project-${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rk_tasks",
        filter: `project_id=eq.${projectId}`,
      },
      () => loadAll(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rk_project",
        filter: `id=eq.${projectId}`,
      },
      () => loadAll(),
    )
    .subscribe();
}

export function useProject(): ProjectState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => emptyState,
  );
}

export function useHydratedProject(id?: string) {
  const [, setReady] = useState(false);
  useEffect(() => {
    loadAll(id).then(() => {
      setReady(true);
      startRealtime();
    });
  }, [id]);
}

export function useIsLoaded(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
}

// --- Combined Actions ---
export const actions = {
  async setProjectName(name: string) {
    if (!projectId) return;
    setState((s: ProjectState) => ({ ...s, projectName: name }));
    await supabase
      .from("rk_project")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", projectId);
  },
  async setGoLive(date: string) {
    if (!projectId) return;
    setState((s: ProjectState) => ({ ...s, goLiveDate: date }));
    await supabase
      .from("rk_project")
      .update({ go_live_date: date, updated_at: new Date().toISOString() })
      .eq("id", projectId);
  },
  toggleDark() {
    setState((s: ProjectState) => {
      const next = !s.darkMode;
      if (typeof window !== "undefined") localStorage.setItem("rk-dark", next ? "1" : "0");
      return { ...s, darkMode: next };
    });
  },
  async addStakeholder(name: string, role: string) {
    if (!projectId) return;
    const { data } = await supabase
      .from("rk_stakeholders")
      .insert({ project_id: projectId, name, role })
      .select()
      .single();
    if (data) setState((s) => ({ ...s, stakeholders: [...s.stakeholders, mapStakeholder(data)] }));
  },
  async updateStakeholder(id: string, patch: Partial<Stakeholder>) {
    setState((s) => ({
      ...s,
      stakeholders: s.stakeholders.map((st) => (st.id === id ? { ...st, ...patch } : st)),
    }));
    try {
      const { error } = await supabase.from("rk_stakeholders").update(patch).eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Stakeholder update failed:", err);
      toast.error("Failed to save stakeholder change");
      loadAll();
    }
  },
  async deleteStakeholder(id: string) {
    setState((s) => ({ ...s, stakeholders: s.stakeholders.filter((st) => st.id !== id) }));
    await supabase.from("rk_stakeholders").delete().eq("id", id);
  },
  async updateTask(id: string, patch: Partial<Task>) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    // Optimistic local update
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

    try {
      const { error } = await (supabase as any).rpc("update_task_secure", {
        p_id: id,
        p_activity: patch.activity !== undefined ? patch.activity : task.activity,
        p_owner: patch.owner !== undefined ? patch.owner : task.owner,
        p_plan_start: patch.planStart !== undefined ? patch.planStart : task.planStart,
        p_plan_duration: patch.planDuration !== undefined ? patch.planDuration : task.planDuration,
        p_actual_start: patch.actualStart !== undefined ? patch.actualStart : task.actualStart,
        p_actual_duration:
          patch.actualDuration !== undefined ? patch.actualDuration : task.actualDuration,
        p_percent_complete:
          patch.percentComplete !== undefined ? patch.percentComplete : task.percentComplete,
        p_section_id: patch.sectionId !== undefined ? patch.sectionId : task.sectionId,
      });
      if (patch.description !== undefined) {
        await supabase.from("rk_tasks").update({ description: patch.description }).eq("id", id);
      }
      if (error) throw error;
    } catch (err) {
      console.error("Task update failed:", err);
      toast.error("Failed to save task change");
      loadAll();
    }
  },
  async addTask(
    sectionId: string,
    initialProps?: {
      activity?: string;
      owner?: string;
      planStart?: string;
      planDuration?: number;
      percentComplete?: number;
    },
  ) {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from("rk_tasks")
        .insert({
          project_id: projectId,
          section_id: sectionId,
          activity: initialProps?.activity || "New task",
          owner: initialProps?.owner || "",
          plan_start: initialProps?.planStart || todayISO(),
          plan_duration: initialProps?.planDuration !== undefined ? initialProps.planDuration : 5,
          actual_duration: 0,
          percent_complete: initialProps?.percentComplete || 0,
          position: state.tasks.length,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setState((s) => ({ ...s, tasks: [...s.tasks, mapTask(data as DbTask)] }));
        toast.success("Task created successfully");
      }
    } catch (err) {
      console.error("Task creation failed:", err);
      toast.error("Failed to add task");
    }
  },

  async deleteTask(id: string) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
    await supabase.from("rk_tasks").delete().eq("id", id);
  },
  async moveTask(id: string, direction: -1 | 1) {
    const idx = state.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= state.tasks.length) return;
    const tasks = [...state.tasks];
    const [removed] = tasks.splice(idx, 1);
    tasks.splice(target, 0, removed);
    setState((s: ProjectState) => ({ ...s, tasks }));
    await Promise.all(
      tasks.map((t, i) => supabase.from("rk_tasks").update({ position: i }).eq("id", t.id)),
    );
  },
  async addSection(name: string) {
    if (!projectId) return;
    const { data } = await supabase
      .from("rk_sections")
      .insert({ project_id: projectId, name, color: "#2E75B6", position: state.sections.length })
      .select()
      .single();
    if (data) setState((s) => ({ ...s, sections: [...s.sections, mapSection(data as DbSection)] }));
  },
  async updateSection(id: string, patch: Partial<Section>) {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
    }));
    await supabase.from("rk_sections").update(patch).eq("id", id);
  },
  async deleteSection(id: string) {
    setState((s) => ({
      ...s,
      sections: s.sections.filter((sec) => sec.id !== id),
      tasks: s.tasks.filter((t) => t.sectionId !== id),
    }));
    await supabase.from("rk_sections").delete().eq("id", id);
  },
  async reset() {
    if (!projectId) return;
    await Promise.all([
      supabase.from("rk_tasks").delete().eq("project_id", projectId),
      supabase.from("rk_sections").delete().eq("project_id", projectId),
      supabase.from("rk_stakeholders").delete().eq("project_id", projectId),
    ]);
    await loadAll();
  },
  async refreshProjects() {
    // Reset guards so this works correctly after a fresh login
    noEmailHandled = false;
    loaded = false;
    loadingPromise = null;
    await loadAll();
  },
  async archiveProject(id: string, archive: boolean = true) {
    await (supabase as any).from("rk_project").update({ is_archived: archive }).eq("id", id);
    await loadAll();
  },
  async createProject(name: string) {
    const email = localStorage.getItem("rk-email")?.toLowerCase();
    const { data: project } = await supabase
      .from("rk_project")
      .insert({ name, go_live_date: todayISO(28) })
      .select()
      .single();
    if (project && email) {
      await supabase
        .from("rk_team")
        .insert({ project_id: project.id, email, name: email.split("@")[0], role: "PM" });
      await loadAll(project.id);
      return project.id;
    }
  },
  async switchProject(id: string) {
    await loadAll(id);
  },
  async addSubTask(taskId: string, title: string) {
    const { data, error } = await supabase
      .from("rk_subtasks")
      .insert({ task_id: taskId, title, is_completed: false })
      .select()
      .single();
    if (error) {
      console.error("Failed to add subtask:", error);
      toast.error("Failed to add checklist item: " + error.message);
      return;
    }
    if (data) {
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        const newSubTasks = [...(task.subTasks || []), mapSubTask(data as DbSubTask)];
        const pct = Math.round(
          (newSubTasks.filter((st) => st.isCompleted).length / newSubTasks.length) * 100,
        );

        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, subTasks: newSubTasks, percentComplete: pct } : t,
          ),
        }));

        await this.updateTask(taskId, { percentComplete: pct });
        await loadAll();
      }
    }
  },
  async toggleSubTask(taskId: string, subTaskId: string, isCompleted: boolean) {
    const { error } = await supabase
      .from("rk_subtasks")
      .update({ is_completed: isCompleted })
      .eq("id", subTaskId);
    if (error) {
      console.error("Failed to toggle subtask:", error);
      toast.error("Failed to update checklist item: " + error.message);
      return;
    }
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      const newSubTasks = (task.subTasks || []).map((st) =>
        st.id === subTaskId ? { ...st, isCompleted } : st,
      );
      const pct = Math.round(
        (newSubTasks.filter((st) => st.isCompleted).length / newSubTasks.length) * 100,
      );

      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, subTasks: newSubTasks, percentComplete: pct } : t,
        ),
      }));

      await this.updateTask(taskId, { percentComplete: pct });
      await loadAll();
    }
  },
  async deleteSubTask(taskId: string, subTaskId: string) {
    const { error } = await supabase.from("rk_subtasks").delete().eq("id", subTaskId);
    if (error) {
      console.error("Failed to delete subtask:", error);
      toast.error("Failed to delete checklist item: " + error.message);
      return;
    }
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      const newSubTasks = (task.subTasks || []).filter((st) => st.id !== subTaskId);
      const pct =
        newSubTasks.length > 0
          ? Math.round(
              (newSubTasks.filter((st) => st.isCompleted).length / newSubTasks.length) * 100,
            )
          : task.percentComplete;

      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, subTasks: newSubTasks, percentComplete: pct } : t,
        ),
      }));

      await this.updateTask(taskId, { percentComplete: pct });
      await loadAll();
    }
  },
  async updateSubTask(
    taskId: string,
    subTaskId: string,
    patch: { title?: string; assignee?: string },
  ) {
    const task = state.tasks.find((t) => t.id === taskId);
    const current = task?.subTasks?.find((st) => st.id === subTaskId);
    if (!current) return;

    const { error } = await (supabase as any).rpc("update_subtask_secure", {
      p_id: subTaskId,
      p_title: patch.title !== undefined ? patch.title : current.title,
      p_assignee: patch.assignee !== undefined ? patch.assignee : (current.assignee ?? ""),
    });
    if (error) {
      console.error("Failed to update subtask:", error);
      toast.error("Failed to update checklist item: " + error.message);
      return;
    }
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subTasks: (t.subTasks || []).map((st) =>
                st.id === subTaskId ? { ...st, ...patch } : st,
              ),
            }
          : t,
      ),
    }));
  },
  async addDependency(taskId: string, dependsOnTaskId: string) {
    const targetTask = state.tasks.find((t) => t.id === dependsOnTaskId);
    if (targetTask && targetTask.percentComplete >= 100) {
      toast.error("Completed tasks cannot be added as dependencies.");
      return;
    }

    const { data, error } = await supabase
      .from("rk_task_dependencies")
      .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId })
      .select()
      .single();
    if (error) {
      console.error("Failed to add dependency:", error);
      toast.error("Failed to add dependency: " + error.message);
      return;
    }
    if (data) {
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, dependencies: [...(t.dependencies || []), dependsOnTaskId] }
            : t,
        ),
      }));
      await loadAll();
    }
  },
  async removeDependency(taskId: string, dependsOnTaskId: string) {
    const { error } = await supabase
      .from("rk_task_dependencies")
      .delete()
      .eq("task_id", taskId)
      .eq("depends_on_task_id", dependsOnTaskId);
    if (error) {
      console.error("Failed to remove dependency:", error);
      toast.error("Failed to remove dependency: " + error.message);
      return;
    }
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, dependencies: (t.dependencies || []).filter((d) => d !== dependsOnTaskId) }
          : t,
      ),
    }));
    await loadAll();
  },

  async addComment(taskId: string, content: string) {
    if (!content.trim()) return;
    const author = userEmail
      ? userEmail.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      : "Team Member";

    try {
      const { data, error } = await (supabase as any)
        .from("rk_task_comments")
        .insert({ task_id: taskId, author, content: content.trim() })
        .select()
        .single();

      const newComment = data
        ? { id: data.id, taskId: data.task_id, author: data.author, content: data.content, createdAt: data.created_at }
        : { id: uid(), taskId, author, content: content.trim(), createdAt: new Date().toISOString() };

      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, comments: [...(t.comments || []), newComment] }
            : t,
        ),
      }));
      toast.success("Comment posted");
    } catch (err: any) {
      console.error("Failed to add comment:", err);
      toast.error("Failed to add comment");
    }
  },

  async deleteComment(taskId: string, commentId: string) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, comments: (t.comments || []).filter((c) => c.id !== commentId) }
          : t,
      ),
    }));
    await (supabase as any).from("rk_task_comments").delete().eq("id", commentId);
    toast.success("Comment deleted");
  },

  async addAttachment(taskId: string, attachment: { name: string; url: string; size?: string }) {
    if (!attachment.name || !attachment.url) return;
    try {
      const { data } = await (supabase as any)
        .from("rk_task_attachments")
        .insert({ task_id: taskId, name: attachment.name, url: attachment.url, size: attachment.size || "" })
        .select()
        .single();

      const newAtt = data
        ? { id: data.id, taskId: data.task_id, name: data.name, url: data.url, size: data.size || "", createdAt: data.created_at }
        : { id: uid(), taskId, name: attachment.name, url: attachment.url, size: attachment.size || "", createdAt: new Date().toISOString() };

      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, attachments: [...(t.attachments || []), newAtt] }
            : t,
        ),
      }));
      toast.success("Attachment added");
    } catch (err: any) {
      console.error("Failed to add attachment:", err);
      toast.error("Failed to add attachment");
    }
  },

  async deleteAttachment(taskId: string, attachmentId: string) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, attachments: (t.attachments || []).filter((a) => a.id !== attachmentId) }
          : t,
      ),
    }));
    await (supabase as any).from("rk_task_attachments").delete().eq("id", attachmentId);
    toast.success("Attachment deleted");
  },
  importState(_next: ProjectState) {
    console.warn("importState is disabled when synced to Cloud.");
  },

  // ─────────────────────────────────────────────
  //  Organization Member Actions
  // ─────────────────────────────────────────────

  /** Fetch all org members for a given orgId */
  async loadOrgMembers(orgId: string) {
    const { data, error } = await (supabase as any)
      .from("rk_org_members")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load organization members");
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      email: r.email,
      name: r.name || r.email,
      orgRole: r.org_role || r.role || "Staff",
      createdAt: r.created_at,
    }));
  },

  /** Invite (add) a member to the organization */
  async inviteOrgMember(orgId: string, email: string, name: string, role: "Admin" | "PM" | "Staff") {
    const cleanEmail = email.trim().toLowerCase();
    // idempotent: check if already exists
    const { data: existing } = await (supabase as any)
      .from("rk_org_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", cleanEmail)
      .maybeSingle();
    if (existing) {
      toast.error("This user is already a member of the organization.");
      return null;
    }
    const { data, error } = await (supabase as any)
      .from("rk_org_members")
      .insert({ org_id: orgId, email: cleanEmail, name: name || cleanEmail, role, org_role: role })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add member: " + error.message);
      return null;
    }
    toast.success(`${name || cleanEmail} added to organization.`);
    return {
      id: data.id,
      orgId: data.org_id,
      email: data.email,
      name: data.name,
      orgRole: data.org_role || data.role || role,
      createdAt: data.created_at,
    };
  },

  /** Update an org member's name or role */
  async updateOrgMember(memberId: string, updates: { name?: string; role?: "Admin" | "PM" | "Staff" }) {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.role !== undefined) {
      payload.role = updates.role;
      payload.org_role = updates.role;
    }
    const { error } = await (supabase as any)
      .from("rk_org_members")
      .update(payload)
      .eq("id", memberId);
    if (error) {
      toast.error("Failed to update member.");
      return false;
    }
    toast.success("Member updated.");
    return true;
  },

  /** Remove a member from the organization */
  async removeOrgMember(memberId: string) {
    const { error } = await (supabase as any)
      .from("rk_org_members")
      .delete()
      .eq("id", memberId);
    if (error) {
      toast.error("Failed to remove member.");
      return false;
    }
    toast.success("Member removed from organization.");
    return true;
  },

  /** Assign a member to a project (ensures org membership first, then adds to rk_team) */
  async assignMemberToProject(
    projectIdTarget: string,
    email: string,
    name: string,
    role: "Admin" | "PM" | "Staff",
  ) {
    const cleanEmail = email.trim().toLowerCase();

    // Find project's org_id
    const { data: proj } = await (supabase as any)
      .from("rk_project")
      .select("org_id")
      .eq("id", projectIdTarget)
      .maybeSingle();

    const targetOrgId = proj?.org_id || "00000000-0000-0000-0000-000000000001";

    // Ensure user belongs to the organization first
    const { data: orgMember } = await (supabase as any)
      .from("rk_org_members")
      .select("id")
      .eq("org_id", targetOrgId)
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!orgMember) {
      // Auto-register user in organization if not already a member
      const assignedRole = role === "Admin" ? "Admin" : role === "PM" ? "PM" : "Staff";
      await (supabase as any)
        .from("rk_org_members")
        .insert({
          org_id: targetOrgId,
          email: cleanEmail,
          name: name || cleanEmail.split("@")[0],
          role: assignedRole,
          org_role: assignedRole,
        });
    }

    const { data: existing } = await (supabase as any)
      .from("rk_team")
      .select("id")
      .eq("project_id", projectIdTarget)
      .eq("email", cleanEmail)
      .maybeSingle();
    if (existing) {
      toast.error("User is already on this project.");
      return false;
    }
    const { error } = await (supabase as any)
      .from("rk_team")
      .insert({ project_id: projectIdTarget, email: cleanEmail, name: name || cleanEmail, role });
    if (error) {
      toast.error("Failed to assign member to project: " + error.message);
      return false;
    }
    toast.success(`${name || cleanEmail} added to project.`);
    return true;
  },

  /** Remove an org member from a project (removes from rk_team) */
  async removeMemberFromProject(projectIdTarget: string, email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await (supabase as any)
      .from("rk_team")
      .delete()
      .eq("project_id", projectIdTarget)
      .eq("email", cleanEmail);
    if (error) {
      toast.error("Failed to remove member from project.");
      return false;
    }
    toast.success("Member removed from project.");
    return true;
  },

  /** Fetch all projects an org member is assigned to */
  async getMemberProjects(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await (supabase as any)
      .from("rk_team")
      .select("project_id, role, rk_project:project_id(name)")
      .eq("email", cleanEmail);
    if (error) return [];
    return (data ?? []).map((r: any) => ({
      projectId: r.project_id,
      role: r.role,
      projectName: r.rk_project?.name ?? r.project_id,
    }));
  },

  /** Fetch all org memberships the current user is in */
  async getUserOrgs(): Promise<{ id: string; name: string; role: string }[]> {
    const email = localStorage.getItem("rk-email")?.trim().toLowerCase();
    if (!email) return [];
    const { data, error } = await (supabase as any)
      .from("rk_org_members")
      .select("org_id, role, org_role, rk_organizations:org_id(id, name)")
      .eq("email", email);
    if (error) return [];
    return (data ?? []).map((r: any) => ({
      id: r.org_id,
      name: r.rk_organizations?.name ?? r.org_id,
      role: r.org_role || r.role || "Staff",
    }));
  },

  /** Update organization details (e.g. name) */
  async updateOrganization(orgId: string, name: string) {
    const { error } = await (supabase as any)
      .from("rk_organizations")
      .update({ name })
      .eq("id", orgId);
    if (error) {
      toast.error("Failed to update organization: " + error.message);
      return false;
    }
    toast.success("Organization details updated.");
    return true;
  },

  // ─────────────────────────────────────────────
  //  Permissions Matrix Actions
  // ─────────────────────────────────────────────

  /** Load role permissions for an org */
  async loadRolePermissions(orgId: string) {
    const { data, error } = await (supabase as any)
      .from("rk_role_permissions")
      .select("*")
      .eq("org_id", orgId);
    if (error) return [];
    return (data ?? []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      role: r.role,
      permissionKey: r.permission_key,
      enabled: r.enabled,
    }));
  },

  /** Save a role permission toggle */
  async saveRolePermission(orgId: string, role: string, permissionKey: string, enabled: boolean) {
    const { error } = await (supabase as any)
      .from("rk_role_permissions")
      .upsert(
        { org_id: orgId, role, permission_key: permissionKey, enabled },
        { onConflict: "org_id,role,permission_key" },
      );
    if (error) {
      toast.error("Failed to update role permission.");
      return false;
    }
    toast.success(`Permission updated for ${role}.`);
    return true;
  },

  /** Load custom user permission overrides for an email in an org */
  async loadUserPermissions(orgId: string, email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await (supabase as any)
      .from("rk_user_permissions")
      .select("*")
      .eq("org_id", orgId)
      .eq("user_email", cleanEmail);
    if (error) return [];
    return (data ?? []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      userEmail: r.user_email,
      permissionKey: r.permission_key,
      granted: r.granted,
    }));
  },

  /** Save or clear a user permission override */
  async saveUserPermissionOverride(
    orgId: string,
    email: string,
    permissionKey: string,
    granted: boolean | null,
  ) {
    const cleanEmail = email.trim().toLowerCase();
    if (granted === null) {
      const { error } = await (supabase as any)
        .from("rk_user_permissions")
        .delete()
        .eq("org_id", orgId)
        .eq("user_email", cleanEmail)
        .eq("permission_key", permissionKey);
      if (error) {
        toast.error("Failed to reset user permission override.");
        return false;
      }
      toast.success("Permission override reset to role default.");
      return true;
    }

    const { error } = await (supabase as any)
      .from("rk_user_permissions")
      .upsert(
        { org_id: orgId, user_email: cleanEmail, permission_key: permissionKey, granted },
        { onConflict: "org_id,user_email,permission_key" },
      );
    if (error) {
      toast.error("Failed to save user permission override.");
      return false;
    }
    toast.success("User permission override saved.");
    return true;
  },

  /** Update project calendar configuration (exclude weekends & holidays) */
  async updateCalendarConfig(excludeWeekends: boolean, holidays: string[]) {
    if (!projectId) return false;
    setState((s) => ({ ...s, excludeWeekends, holidays }));
    const { error } = await (supabase as any)
      .from("rk_project")
      .update({
        exclude_weekends: excludeWeekends,
        holidays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (error) {
      toast.error("Failed to update calendar configuration.");
      return false;
    }
    toast.success("Calendar configuration saved.");
    return true;
  },
};


/** Call after login to force a fresh project fetch with the saved email. */
export function initializeStore() {
  noEmailHandled = false;
  loaded = false;
  loadingPromise = null;
  loadAll();
}

export function dateAdd(iso: string, days: number): string {
  if (!iso || iso.length < 10) return iso;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isWorkingDay(iso: string, excludeWeekends = true, holidays: string[] = []): boolean {
  if (!iso || iso.length < 10) return true;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return true;
  const dayOfWeek = d.getDay();
  if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) return false;
  if (holidays && holidays.includes(iso)) return false;
  return true;
}

export function addWorkingDays(
  startISO: string,
  days: number,
  excludeWeekends = true,
  holidays: string[] = [],
): string {
  if (!startISO || startISO.length < 10) return startISO;
  let curr = startISO;
  let added = 0;
  // If target days is 0 or 1, ensure start date itself is valid
  while (days > 0 && added < days) {
    curr = dateAdd(curr, 1);
    if (isWorkingDay(curr, excludeWeekends, holidays)) {
      added++;
    }
  }
  return curr;
}

export function getComputedFinishDate(
  startISO: string,
  duration: number,
  excludeWeekends = true,
  holidays: string[] = [],
): string {
  if (!startISO || startISO.length < 10) return startISO;
  const dur = Math.max(1, duration);
  // A 1-day task starting on Monday finishes on Monday (0 working days added)
  return addWorkingDays(startISO, dur - 1, excludeWeekends, holidays);
}

export function getWorkingDaysCount(
  startISO: string,
  endISO: string,
  excludeWeekends = true,
  holidays: string[] = [],
): number {
  if (!startISO || !endISO || startISO > endISO) return 0;
  let count = 0;
  let curr = startISO;
  while (curr <= endISO) {
    if (isWorkingDay(curr, excludeWeekends, holidays)) count++;
    curr = dateAdd(curr, 1);
  }
  return count;
}

export function daysBetween(a: string, b: string): number {
  if (!a || !b || a.length < 10 || b.length < 10) return 0;
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const ms = d2.getTime() - d1.getTime();
  return Math.round(ms / 86400000);
}

export function getTaskStatus(t: Task): {
  status: "not_started" | "in_progress" | "complete" | "at_risk" | "overdue";
  label: string;
  tone: "muted" | "primary" | "accent" | "warn" | "danger";
} {
  const today = todayISO();
  const planEnd = dateAdd(t.planStart, t.planDuration);
  if (t.percentComplete >= 100) return { status: "complete", label: "Complete", tone: "accent" };
  if (today > planEnd && t.percentComplete < 100)
    return { status: "at_risk", label: "Overdue", tone: "danger" };
  const planEndSoon = dateAdd(t.planStart, t.planDuration - 2);
  if (today > planEndSoon && t.percentComplete < 70)
    return { status: "at_risk", label: "At Risk", tone: "warn" };
  if (t.actualStart && t.percentComplete > 0)
    return { status: "in_progress", label: "In Progress", tone: "primary" };
  return { status: "not_started", label: "Not Started", tone: "muted" };
}
