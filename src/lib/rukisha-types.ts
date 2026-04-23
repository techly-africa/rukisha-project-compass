export type TaskStatus = "not_started" | "in_progress" | "complete" | "at_risk";

export interface TeamMember {
  id: string;
  email: string;
  name: string;
}

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

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  goLiveDate: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface ProjectState {
  id: string | null;
  projectName: string;
  goLiveDate: string; // YYYY-MM-DD
  stakeholders: Stakeholder[];
  sections: Section[];
  tasks: Task[];
  darkMode: boolean;
  userProjects: ProjectInfo[];
}
