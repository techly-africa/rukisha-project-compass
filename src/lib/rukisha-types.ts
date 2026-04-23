export type TaskStatus = "not_started" | "in_progress" | "complete" | "at_risk";

export interface Task {
  id: string;
  sectionId: string;
  activity: string;
  owner: string;
  planStart: string; // ISO date YYYY-MM-DD
  planDuration: number; // days
  actualStart: string | null;
  actualDuration: number; // days
  percentComplete: number; // 0-100
}

export interface Section {
  id: string;
  name: string;
  color: string; // accent color hint
}

export interface ProjectState {
  projectName: string;
  goLiveDate: string; // YYYY-MM-DD
  sections: Section[];
  tasks: Task[];
  darkMode: boolean;
}
