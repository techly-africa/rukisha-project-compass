import { useEffect, useSyncExternalStore } from "react";
import type { ProjectState, Section, Task } from "./rukisha-types";

const STORAGE_KEY = "rukisha-project-tracker-v1";

function todayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const defaultState: ProjectState = (() => {
  const s1: Section = { id: "s1", name: "Legal & Business", color: "#1A3C5E" };
  const s2: Section = { id: "s2", name: "Compliance", color: "#2E75B6" };
  const s3: Section = { id: "s3", name: "Technical", color: "#C9A227" };
  const tasks: Task[] = [
    { id: uid(), sectionId: "s1", activity: "Register company", owner: "Alice Mwangi", planStart: todayISO(-20), planDuration: 5, actualStart: todayISO(-20), actualDuration: 5, percentComplete: 100 },
    { id: uid(), sectionId: "s1", activity: "Open business bank account", owner: "Brian Otieno", planStart: todayISO(-14), planDuration: 7, actualStart: todayISO(-13), actualDuration: 8, percentComplete: 100 },
    { id: uid(), sectionId: "s1", activity: "Draft shareholder agreement", owner: "Cynthia Wambui", planStart: todayISO(-7), planDuration: 10, actualStart: todayISO(-6), actualDuration: 8, percentComplete: 60 },
    { id: uid(), sectionId: "s2", activity: "Data Protection registration", owner: "David Kimani", planStart: todayISO(-5), planDuration: 8, actualStart: todayISO(-3), actualDuration: 6, percentComplete: 40 },
    { id: uid(), sectionId: "s2", activity: "AML/KYC policy", owner: "Esther Njoroge", planStart: todayISO(-2), planDuration: 12, actualStart: todayISO(-1), actualDuration: 4, percentComplete: 25 },
    { id: uid(), sectionId: "s2", activity: "Regulator submission", owner: "Frank Owino", planStart: todayISO(3), planDuration: 14, actualStart: null, actualDuration: 0, percentComplete: 0 },
    { id: uid(), sectionId: "s3", activity: "Architecture design", owner: "Grace Achieng", planStart: todayISO(-10), planDuration: 7, actualStart: todayISO(-10), actualDuration: 7, percentComplete: 100 },
    { id: uid(), sectionId: "s3", activity: "Build core API", owner: "Henry Mutiso", planStart: todayISO(-3), planDuration: 14, actualStart: todayISO(-2), actualDuration: 10, percentComplete: 55 },
    { id: uid(), sectionId: "s3", activity: "Frontend MVP", owner: "Ivy Kariuki", planStart: todayISO(2), planDuration: 14, actualStart: null, actualDuration: 0, percentComplete: 0 },
    { id: uid(), sectionId: "s3", activity: "Security audit", owner: "Joel Wafula", planStart: todayISO(14), planDuration: 7, actualStart: null, actualDuration: 0, percentComplete: 0 },
  ];
  return {
    projectName: "Rukisha Launch",
    goLiveDate: todayISO(28),
    sections: [s1, s2, s3],
    tasks,
    darkMode: false,
  };
})();

let state: ProjectState = defaultState;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadFromStorage() {
  if (typeof window === "undefined") return;
  // URL snapshot takes precedence
  const hash = window.location.hash;
  if (hash.startsWith("#data=")) {
    try {
      const json = decodeURIComponent(atob(hash.slice(6)));
      const parsed = JSON.parse(json);
      state = { ...defaultState, ...parsed };
      persist();
      emit();
      return;
    } catch {}
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...defaultState, ...JSON.parse(raw) };
      emit();
    }
  } catch {}
}

export function getState(): ProjectState {
  return state;
}

function setState(updater: (s: ProjectState) => ProjectState) {
  state = updater(state);
  persist();
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProject(): ProjectState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => defaultState,
  );
}

export function useHydratedProject() {
  // Ensure load happens once on client
  useEffect(() => {
    loadFromStorage();
  }, []);
}

// --- Mutations ---
export const actions = {
  setProjectName(name: string) {
    setState((s) => ({ ...s, projectName: name }));
  },
  setGoLive(date: string) {
    setState((s) => ({ ...s, goLiveDate: date }));
  },
  toggleDark() {
    setState((s) => ({ ...s, darkMode: !s.darkMode }));
  },
  updateTask(id: string, patch: Partial<Task>) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },
  addTask(sectionId: string) {
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          id: uid(),
          sectionId,
          activity: "New task",
          owner: "",
          planStart: todayISO(),
          planDuration: 5,
          actualStart: null,
          actualDuration: 0,
          percentComplete: 0,
        },
      ],
    }));
  },
  deleteTask(id: string) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  },
  moveTask(id: string, direction: -1 | 1) {
    setState((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return s;
      const target = idx + direction;
      if (target < 0 || target >= s.tasks.length) return s;
      const tasks = [...s.tasks];
      const [removed] = tasks.splice(idx, 1);
      tasks.splice(target, 0, removed);
      return { ...s, tasks };
    });
  },
  addSection(name: string) {
    setState((s) => ({
      ...s,
      sections: [...s.sections, { id: uid(), name, color: "#2E75B6" }],
    }));
  },
  updateSection(id: string, patch: Partial<Section>) {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
    }));
  },
  deleteSection(id: string) {
    setState((s) => ({
      ...s,
      sections: s.sections.filter((sec) => sec.id !== id),
      tasks: s.tasks.filter((t) => t.sectionId !== id),
    }));
  },
  reset() {
    state = defaultState;
    persist();
    emit();
  },
  importState(next: ProjectState) {
    state = { ...defaultState, ...next };
    persist();
    emit();
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
