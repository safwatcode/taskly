// Models for Data Transfer
export interface ProjectPayload {
  name: string;
  description?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}
