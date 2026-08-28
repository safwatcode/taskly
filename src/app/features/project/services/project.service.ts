import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import { map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  EpicPayload,
  PaginatedResponse,
  ProjectEpicResponse,
  ProjectMemberResponse,
  ProjectPayload,
  ProjectResponse,
  ProjectTaskResponse,
  TaskPayload,
} from '../models/project.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private http = inject(HttpClient);

  private baseURL = environment.supabase.url;
  private projectsURL = `${this.baseURL}/rest/v1/projects`;
  private projectEpicsURL = `${this.baseURL}/rest/v1/project_epics`;
  private epicsURL = `${this.baseURL}/rest/v1/epics`;
  private tasksURL = `${this.baseURL}/rest/v1/tasks`;
  private projectTasksURL = `${this.baseURL}/rest/v1/project_tasks`;

  private rpcProjectsURL = `${this.baseURL}/rest/v1/rpc/get_projects`;
  private rpcProjectMembersURL = `${this.baseURL}/rest/v1/get_project_members`;

  getProjects(limit: number, offset: number): Observable<PaginatedResponse<ProjectResponse>> {
    return this.http
      .get<ProjectResponse[]>(this.rpcProjectsURL, {
        params: { limit, offset },
        // Required header to force the backend to return the exact total count
        headers: { Prefer: 'count=exact' },
        // Return the full response object, not just the body, so we can read headers
        observe: 'response',
      })
      .pipe(
        map((response: HttpResponse<ProjectResponse[]>) => {
          // Extract content from header
          const contentRange = response.headers.get('Content-Range') || '0/0';
          const totalCount = parseInt(contentRange.split('/')[1], 10);

          return {
            content: response.body || [],
            totalElements: totalCount,
          };
        }),
      );
  }

  addProject(payload: ProjectPayload): Observable<ProjectResponse[]> {
    const headers = new HttpHeaders({
      Prefer: 'return=representation',
    });

    return this.http
      .post<ProjectResponse[]>(this.projectsURL, payload, { headers })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getProjectById(id: string): Observable<ProjectResponse> {
    return this.http.get<ProjectResponse[]>(`${this.projectsURL}?id=eq.${id}`).pipe(
      map((projects) => projects[0]),
      catchError(this.handleError.bind(this)),
    );
  }

  updateProject(id: string, payload: Partial<ProjectPayload>): Observable<void> {
    return this.http
      .patch<void>(`${this.projectsURL}?id=eq.${id}`, payload)
      .pipe(catchError(this.handleError.bind(this)));
  }

  getProjectMembers(projectId: string): Observable<ProjectMemberResponse[]> {
    const params = new HttpParams().set('project_id', `eq.${projectId}`);
    return this.http
      .get<ProjectMemberResponse[]>(this.rpcProjectMembersURL, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getProjectEpics(
    projectId: string,
    searchTerm = '',
    limit = 6,
    offset = 0,
  ): Observable<PaginatedResponse<ProjectEpicResponse>> {
    let params = new HttpParams()
      .set('project_id', `eq.${projectId}`)
      .set('limit', limit.toString())
      .set('offset', offset.toString())
      .set('order', 'created_at.asc');

    // Apply case-insensitive wildcard search if term exists
    if (searchTerm && searchTerm.trim() !== '') {
      params = params.set('title', `ilike.%${searchTerm.trim()}%`);
    }

    return this.http
      .get<ProjectEpicResponse[]>(this.projectEpicsURL, {
        params,
        headers: { Prefer: 'count=exact' }, // Required to get total count
        observe: 'response', // Required to access the Content-Range header
      })
      .pipe(
        map((response: HttpResponse<ProjectEpicResponse[]>) => {
          const contentRange = response.headers.get('Content-Range') || '0/0';
          const totalCount = parseInt(contentRange.split('/')[1], 10) || 0;

          return {
            content: response.body || [],
            totalElements: totalCount,
          };
        }),
        catchError(this.handleError.bind(this)),
      );
  }

  createEpic(payload: EpicPayload): Observable<ProjectEpicResponse[]> {
    const headers = new HttpHeaders({
      Prefer: 'return=representation',
    });

    return this.http
      .post<ProjectEpicResponse[]>(this.epicsURL, payload, { headers })
      .pipe(catchError(this.handleError.bind(this)));
  }

  // Epic details popup
  getEpicDetails(projectId: string, epicId: string): Observable<ProjectEpicResponse> {
    const params = new HttpParams().set('project_id', `eq.${projectId}`).set('id', `eq.${epicId}`);

    const headers = new HttpHeaders({
      Prefer: 'return=representation',
    });

    return this.http.get<ProjectEpicResponse[]>(this.projectEpicsURL, { params, headers }).pipe(
      map((epics) => {
        if (!epics || epics.length === 0) {
          throw new Error('Epic not found');
        }
        // API response is an array, use the first item
        return epics[0];
      }),
      catchError(this.handleError.bind(this)),
    );
  }

  getEpicTasks(epicId: string): Observable<ProjectTaskResponse[]> {
    const params = new HttpParams().set('epic_id', `eq.${epicId}`);
    return this.http
      .get<ProjectTaskResponse[]>(this.projectTasksURL, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  updateEpic(epicId: string, payload: Partial<EpicPayload>): Observable<void> {
    return this.http
      .patch<void>(`${this.epicsURL}?id=eq.${epicId}`, payload)
      .pipe(catchError(this.handleError.bind(this)));
  }

  createTask(payload: TaskPayload): Observable<ProjectTaskResponse[]> {
    const headers = new HttpHeaders({
      Prefer: 'return=representation',
    });

    return this.http
      .post<ProjectTaskResponse[]>(this.tasksURL, payload, { headers })
      .pipe(catchError(this.handleError.bind(this)));
  }

  updateTask(taskId: string, payload: Partial<TaskPayload>): Observable<void> {
    return this.http
      .patch<void>(`${this.tasksURL}?id=eq.${taskId}`, payload)
      .pipe(catchError(this.handleError.bind(this)));
  }

  getProjectTasksByStatus(projectId: string, status: string): Observable<ProjectTaskResponse[]> {
    const params = new HttpParams()
      .set('project_id', `eq.${projectId}`)
      .set('status', `eq.${status}`)
      .set('order', 'created_at.desc');

    return this.http
      .get<ProjectTaskResponse[]>(this.projectTasksURL, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred while processing your request.';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Network Error: ${error.error.message}`;
    } else {
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = `Server Error (${error.status}): ${error.message}`;
      }
    }

    console.error('ProjectService Error:', error);

    return throwError(() => ({ message: errorMessage, status: error.status }));
  }
}
