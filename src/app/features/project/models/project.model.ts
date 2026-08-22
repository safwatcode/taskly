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
  name: string;
  email: string;
  avatar: string | null;
  role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
}

// Project Epics
export interface EpicUserSummary {
  sub: string;
  name: string;
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
