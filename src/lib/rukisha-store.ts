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

function mapSection(s: DbSection): Section {
  return { id: s.id, name: s.name, color: s.color };
}
function mapTask(t: DbTask): Task {
  return {
    id: t.id,
    sectionId: t.section_id,
    activity: t.activity,
    owner: t.owner,
    planStart: t.plan_start,
    planDuration: t.plan_duration,
    actualStart: t.actual_start,
    actualDuration: t.actual_duration,
    percentComplete: t.percent_complete,
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

    const { data: projectListRaw, error: listErr } = await (supabase as any).rpc("get_user_projects", {
      p_email: userEmail
    });

    if (listErr) {
      console.error("Discovery failed:", listErr);
      return;
    }

    projectList = (projectListRaw || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      goLiveDate: p.go_live_date,
      updatedAt: p.updated_at,
      isArchived: p.is_archived,
      progress: Number(p.progress || 0)
    }));

    const { data: adminData } = await (supabase as any)
      .from("rk_superadmins")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();
    isSuperAdmin = !!adminData;

    if (projectList.length === 0 && !listErr) {
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
      setState((s) => ({ ...s, userProjects: projectList }));
      return;
    }

    projectId = targetId;

    const cached = projectCache.get(targetId);
    if (cached && !id) {
      state = { ...cached, userProjects: projectList, userEmail, isSuperAdmin };
      loaded = true;
      emit();
    }

    const [{ data: project }, { data: sections }, { data: tasks }, { data: stakeholders }] = await Promise.all([
      supabase.from("rk_project").select("*").eq("id", targetId).single(),
      supabase.from("rk_sections").select("*").eq("project_id", targetId).order("position"),
      supabase.from("rk_tasks").select("*").eq("project_id", targetId).order("position"),
      supabase.from("rk_stakeholders").select("*").eq("project_id", targetId).order("name"),
    ]);

    if (!project) return;

    const localDark = typeof window !== "undefined" ? localStorage.getItem("rk-dark") === "1" : false;

    const newState: ProjectState = {
      id: project.id,
      projectName: project.name,
      goLiveDate: project.go_live_date,
      stakeholders: (stakeholders || []).map(mapStakeholder),
      sections: (sections || []).map(mapSection),
      tasks: (tasks || []).map(mapTask),
      darkMode: localDark,
      userProjects: projectList,
      userEmail,
      isSuperAdmin,
    };

    projectCache.set(project.id, newState);
    state = newState;
    loaded = true;
    emit();
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
    .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "rk_tasks", 
        filter: `project_id=eq.${projectId}` 
    }, () => loadAll())
    .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "rk_project", 
        filter: `id=eq.${projectId}` 
    }, () => loadAll())
    .subscribe();
}

export function useProject(): ProjectState {
  return useSyncExternalStore(subscribe, () => state, () => emptyState);
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
  return useSyncExternalStore(subscribe, () => loaded, () => false);
}

// --- Combined Actions ---
export const actions = {
  async setProjectName(name: string) {
    if (!projectId) return;
    setState((s: ProjectState) => ({ ...s, projectName: name }));
    await supabase.from("rk_project").update({ name, updated_at: new Date().toISOString() }).eq("id", projectId);
  },
  async setGoLive(date: string) {
    if (!projectId) return;
    setState((s: ProjectState) => ({ ...s, goLiveDate: date }));
    await supabase.from("rk_project").update({ go_live_date: date, updated_at: new Date().toISOString() }).eq("id", projectId);
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
    const { data } = await supabase.from("rk_stakeholders").insert({ project_id: projectId, name, role }).select().single();
    if (data) setState((s) => ({ ...s, stakeholders: [...s.stakeholders, mapStakeholder(data)] }));
  },
  async updateStakeholder(id: string, patch: Partial<Stakeholder>) {
    setState((s) => ({ ...s, stakeholders: s.stakeholders.map((st) => (st.id === id ? { ...st, ...patch } : st)) }));
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
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    const dbPatch: any = {};
    if (patch.activity !== undefined) dbPatch.activity = patch.activity;
    if (patch.owner !== undefined) dbPatch.owner = patch.owner;
    if (patch.planStart !== undefined) dbPatch.plan_start = patch.planStart;
    if (patch.planDuration !== undefined) dbPatch.plan_duration = patch.planDuration;
    if (patch.actualStart !== undefined) dbPatch.actual_start = patch.actualStart;
    if (patch.actualDuration !== undefined) dbPatch.actual_duration = patch.actualDuration;
    if (patch.percentComplete !== undefined) dbPatch.percent_complete = patch.percentComplete;
    if (patch.sectionId !== undefined) dbPatch.section_id = patch.sectionId;
    if (Object.keys(dbPatch).length === 0) return;
    try {
      const { error } = await (supabase as any).rpc("update_task_secure", {
        p_id: id,
        p_activity: dbPatch.activity,
        p_owner: dbPatch.owner,
        p_plan_start: dbPatch.plan_start,
        p_plan_duration: dbPatch.plan_duration,
        p_actual_start: dbPatch.actual_start,
        p_actual_duration: dbPatch.actual_duration,
        p_percent_complete: dbPatch.percent_complete,
        p_section_id: dbPatch.section_id
      });
      if (error) throw error;
    } catch (err) {
      console.error("Task update failed:", err);
      toast.error("Failed to save task change");
      loadAll();
    }
  },
  async addTask(sectionId: string) {
    if (!projectId) return;
    try {
      const { data, error } = await supabase.from("rk_tasks").insert({
        project_id: projectId,
        section_id: sectionId,
        activity: "New task",
        owner: "",
        plan_start: todayISO(),
        plan_duration: 5,
        actual_duration: 0,
        percent_complete: 0,
        position: state.tasks.length,
      }).select().single();
      if (error) throw error;
      if (data) setState((s) => ({ ...s, tasks: [...s.tasks, mapTask(data as DbTask)] }));
    } catch (err) {
      console.error("Task creation failed:", err);
      toast.error("Failed to add mission task");
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
    await Promise.all(tasks.map((t, i) => supabase.from("rk_tasks").update({ position: i }).eq("id", t.id)));
  },
  async addSection(name: string) {
    if (!projectId) return;
    const { data } = await supabase.from("rk_sections").insert({ project_id: projectId, name, color: "#2E75B6", position: state.sections.length }).select().single();
    if (data) setState((s) => ({ ...s, sections: [...s.sections, mapSection(data as DbSection)] }));
  },
  async updateSection(id: string, patch: Partial<Section>) {
    setState((s) => ({ ...s, sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)) }));
    await supabase.from("rk_sections").update(patch).eq("id", id);
  },
  async deleteSection(id: string) {
    setState((s) => ({ ...s, sections: s.sections.filter((sec) => sec.id !== id), tasks: s.tasks.filter((t) => t.sectionId !== id) }));
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
    const { data: project } = await supabase.from("rk_project").insert({ name, go_live_date: todayISO(28) }).select().single();
    if (project && email) {
      await supabase.from("rk_team").insert({ project_id: project.id, email, name: email.split("@")[0] });
      await loadAll(project.id);
      return project.id;
    }
  },
  async switchProject(id: string) {
    await loadAll(id);
  },
  importState(_next: ProjectState) {
    console.warn("importState is disabled when synced to Cloud.");
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
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime();
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
