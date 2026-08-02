export type TaskStatus = "not_started" | "in_progress" | "complete" | "at_risk";

export interface TeamMember {
  id: string;
  email: string;
  name: string;
}

export interface OrgMember {
  id: string;
  orgId: string;
  email: string;
  name: string;
  orgRole: "Admin" | "PM" | "Staff";
  createdAt: string;
  projects?: { projectId: string; projectName: string; role: string }[];
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  assignee?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  url: string;
  size?: string;
  createdAt: string;
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
  subTasks?: SubTask[];
  dependencies?: string[];
  description?: string;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
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
  progress: number;
}

export interface ProjectState {
  id: string | null;
  projectName: string;
  goLiveDate: string; // YYYY-MM-DD
  stakeholders: Stakeholder[];
  sections: Section[];
  tasks: Task[];
  teamMembers: TeamMember[];
  darkMode: boolean;
  userProjects: ProjectInfo[];
  userEmail: string | null;
  userRole?: string | null;
  isSuperAdmin: boolean;
}
