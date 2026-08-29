// Models for Data Transfer
export interface ProjectPayload {
  name: string;
  description?: string;
}

// Projects List
export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

// Pagination
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
}

// Project Members
export interface ProjectMemberResponse {
  id: string;
  name?: string;
  email: string;
  avatar: string | null;
  role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
}

// Project Epics
export interface EpicUserSummary {
  sub: string;
  name: string | undefined;
  email: string;
  department?: string;
}

export interface ProjectEpicResponse {
  id: string;
  epic_id: string;
  title: string;
  description?: string;
  deadline: string;
  created_at: string;
  created_by: EpicUserSummary;
  assignee: EpicUserSummary;
}

// Add Project Epic
export interface EpicPayload {
  title: string;
  description?: string;
  assignee_id?: string;
  project_id: string;
  deadline?: string;
}

// Add Project Task
export interface TaskPayload {
  project_id: string;
  title: string;
  status: string;
  epic_id?: string;
  description?: string;
  assignee_id?: string;
  due_date?: string;
}

export interface ProjectTaskResponse {
  id: string;
  project_id: string;
  epic_id?: string;
  title: string;
  description?: string;
  status: string;
  due_date?: string;
  created_at: string;
  assignee?: {
    name: string | null;
    email: string | null;
    sub?: string;
    user_id?: string;
  };
}

// Project Tasks - Board View
export interface BoardColumn {
  id: string;
  label: string;
  dotClass: string;
  borderClass: string;
  bgClass: string;
  tasks: ProjectTaskResponse[];
  isLoading: boolean;
  error: boolean;
  offset?: number;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  loadingMoreError?: boolean;
}
