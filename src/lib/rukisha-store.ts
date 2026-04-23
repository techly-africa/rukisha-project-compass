import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectState, Section, Task } from "./rukisha-types";

function todayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const emptyState: ProjectState = {
  projectName: "Rukisha Launch",
  goLiveDate: todayISO(28),
  sections: [],
  tasks: [],
  darkMode: false,
};

let state: ProjectState = emptyState;
let projectId: string | null = null;
let loaded = false;
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

// --- Load + realtime ---
async function loadAll() {
  const { data: projects } = await supabase
    .from("rk_project")
    .select("*")
    .order("updated_at", { ascending: true })
    .limit(1);

  if (!projects || projects.length === 0) return;
  const project = projects[0];
  projectId = project.id;

  const [{ data: sections }, { data: tasks }] = await Promise.all([
    supabase.from("rk_sections").select("*").eq("project_id", projectId!).order("position"),
    supabase.from("rk_tasks").select("*").eq("project_id", projectId!).order("position"),
  ]);

  const localDark =
    typeof window !== "undefined" ? localStorage.getItem("rk-dark") === "1" : false;

  state = {
    projectName: project.name,
    goLiveDate: project.go_live_date,
    sections: (sections ?? []).map(mapSection),
    tasks: (tasks ?? []).map(mapTask),
    darkMode: localDark,
  };
  loaded = true;
  emit();
}

let channelStarted = false;
function startRealtime() {
  if (channelStarted) return;
  channelStarted = true;
  supabase
    .channel("rukisha-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "rk_project" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "rk_sections" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "rk_tasks" }, () => loadAll())
    .subscribe();
}

export function useProject(): ProjectState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => emptyState,
  );
}

export function useHydratedProject() {
  const [, setReady] = useState(false);
  useEffect(() => {
    loadAll().then(() => {
      setReady(true);
      startRealtime();
    });
  }, []);
}

export function useIsLoaded(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
}

// --- Mutations ---
export const actions = {
  async setProjectName(name: string) {
    if (!projectId) return;
    setState((s) => ({ ...s, projectName: name }));
    await supabase.from("rk_project").update({ name, updated_at: new Date().toISOString() }).eq("id", projectId);
  },
  async setGoLive(date: string) {
    if (!projectId) return;
    setState((s) => ({ ...s, goLiveDate: date }));
    await supabase
      .from("rk_project")
      .update({ go_live_date: date, updated_at: new Date().toISOString() })
      .eq("id", projectId);
  },
  toggleDark() {
    setState((s) => {
      const next = !s.darkMode;
      if (typeof window !== "undefined") localStorage.setItem("rk-dark", next ? "1" : "0");
      return { ...s, darkMode: next };
    });
  },
  async updateTask(id: string, patch: Partial<Task>) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    const dbPatch: Partial<DbTask> = {};
    if (patch.activity !== undefined) dbPatch.activity = patch.activity;
    if (patch.owner !== undefined) dbPatch.owner = patch.owner;
    if (patch.planStart !== undefined) dbPatch.plan_start = patch.planStart;
    if (patch.planDuration !== undefined) dbPatch.plan_duration = patch.planDuration;
    if (patch.actualStart !== undefined) dbPatch.actual_start = patch.actualStart;
    if (patch.actualDuration !== undefined) dbPatch.actual_duration = patch.actualDuration;
    if (patch.percentComplete !== undefined) dbPatch.percent_complete = patch.percentComplete;
    if (patch.sectionId !== undefined) dbPatch.section_id = patch.sectionId;
    if (Object.keys(dbPatch).length === 0) return;
    await supabase.from("rk_tasks").update(dbPatch).eq("id", id);
  },
  async addTask(sectionId: string) {
    if (!projectId) return;
    const position = state.tasks.length;
    const { data } = await supabase
      .from("rk_tasks")
      .insert({
        project_id: projectId,
        section_id: sectionId,
        activity: "New task",
        owner: "",
        plan_start: todayISO(),
        plan_duration: 5,
        actual_duration: 0,
        percent_complete: 0,
        position,
      })
      .select()
      .single();
    if (data) {
      setState((s) => ({ ...s, tasks: [...s.tasks, mapTask(data as DbTask)] }));
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
    setState((s) => ({ ...s, tasks }));
    // Persist new positions
    await Promise.all(
      tasks.map((t, i) => supabase.from("rk_tasks").update({ position: i }).eq("id", t.id)),
    );
  },
  async addSection(name: string) {
    if (!projectId) return;
    const position = state.sections.length;
    const { data } = await supabase
      .from("rk_sections")
      .insert({ project_id: projectId, name, color: "#2E75B6", position })
      .select()
      .single();
    if (data) setState((s) => ({ ...s, sections: [...s.sections, mapSection(data as DbSection)] }));
  },
  async updateSection(id: string, patch: Partial<Section>) {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
    }));
    const dbPatch: Partial<DbSection> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.color !== undefined) dbPatch.color = patch.color;
    if (Object.keys(dbPatch).length === 0) return;
    await supabase.from("rk_sections").update(dbPatch).eq("id", id);
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
    if (!confirm("Reset all data? This will clear every task and section in the cloud.")) return;
    await supabase.from("rk_tasks").delete().eq("project_id", projectId);
    await supabase.from("rk_sections").delete().eq("project_id", projectId);
    await loadAll();
  },
  importState(_next: ProjectState) {
    // Snapshot import disabled in cloud mode — data is shared.
    console.warn("importState is disabled when synced to Lovable Cloud.");
  },
};

// --- Derived helpers ---
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
  if (today > planEnd && t.percentComplete < 100) return { status: "at_risk", label: "Overdue", tone: "danger" };
  const planEndSoon = dateAdd(t.planStart, t.planDuration - 2);
  if (today > planEndSoon && t.percentComplete < 70)
    return { status: "at_risk", label: "At Risk", tone: "warn" };
  if (t.actualStart && t.percentComplete > 0) return { status: "in_progress", label: "In Progress", tone: "primary" };
  return { status: "not_started", label: "Not Started", tone: "muted" };
}

export { todayISO, uid };
