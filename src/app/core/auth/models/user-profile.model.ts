export interface UserProfileResponse {
  email: string | undefined;
  user_metadata?: {
    name?: string;
    job_title?: string;
    email?: string;
  };
}
