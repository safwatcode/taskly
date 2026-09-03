import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import { map, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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
  private rpcInviteMemberURL = `${this.baseURL}/rest/v1/rpc/invite_member`;
  private rpcAcceptInvitationURL = `${this.baseURL}/rest/v1/rpc/accept_invitation`;

  // Global name caching
  private userNameCache = new Map<string, string>();

  private harvestNamesFromTask(task: ProjectTaskResponse): void {
    if (task.assignee?.email && task.assignee?.name) {
      this.userNameCache.set(task.assignee.email.toLowerCase(), task.assignee.name);
    }
    const tAny = task as any;
    if (tAny.created_by?.email && tAny.created_by?.name) {
      this.userNameCache.set(tAny.created_by.email.toLowerCase(), tAny.created_by.name);
    }
  }

  private harvestNamesFromMember(member: ProjectMemberResponse): void {
    if (member.email && member.name) {
      this.userNameCache.set(member.email.toLowerCase(), member.name);
    }
  }

  private enrichMemberName(member: ProjectMemberResponse): ProjectMemberResponse {
    if (!member.name && member.email) {
      const cachedName = this.userNameCache.get(member.email.toLowerCase());
      if (cachedName) member.name = cachedName;
    }
    return member;
  }

  private enrichTaskNames(task: ProjectTaskResponse): ProjectTaskResponse {
    if (task.assignee && !task.assignee.name && task.assignee.email) {
      const cachedName = this.userNameCache.get(task.assignee.email.toLowerCase());
      if (cachedName) task.assignee.name = cachedName;
    }
    const tAny = task as any;
    if (tAny.created_by && !tAny.created_by.name && tAny.created_by.email) {
      const cachedName = this.userNameCache.get(tAny.created_by.email.toLowerCase());
      if (cachedName) tAny.created_by.name = cachedName;
    }
    return task;
  }

  getProjects(limit: number, offset: number): Observable<PaginatedResponse<ProjectResponse>> {
    return this.http
      .get<ProjectResponse[]>(this.rpcProjectsURL, {
        params: { limit, offset },
        headers: { Prefer: 'count=exact' },
        observe: 'response',
      })
      .pipe(
        map((response: HttpResponse<ProjectResponse[]>) => {
          const contentRange = response.headers.get('Content-Range') || '0/0';
          const totalCount = parseInt(contentRange.split('/')[1], 10);
          return { content: response.body || [], totalElements: totalCount };
        }),
      );
  }

  addProject(payload: ProjectPayload): Observable<ProjectResponse[]> {
    const headers = new HttpHeaders({ Prefer: 'return=representation' });
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
    return this.http.get<ProjectMemberResponse[]>(this.rpcProjectMembersURL, { params }).pipe(
      // Harvest any names, then patch any missing ones!
      tap((members) => members.forEach((m) => this.harvestNamesFromMember(m))),
      map((members) => members.map((m) => this.enrichMemberName(m))),
      catchError(this.handleError.bind(this)),
    );
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
    if (searchTerm && searchTerm.trim() !== '')
      params = params.set('title', `ilike.%${searchTerm.trim()}%`);

    return this.http
      .get<ProjectEpicResponse[]>(this.projectEpicsURL, {
        params,
        headers: { Prefer: 'count=exact' },
        observe: 'response',
      })
      .pipe(
        map((response: HttpResponse<ProjectEpicResponse[]>) => {
          const contentRange = response.headers.get('Content-Range') || '0/0';
          const totalCount = parseInt(contentRange.split('/')[1], 10) || 0;
          return { content: response.body || [], totalElements: totalCount };
        }),
        catchError(this.handleError.bind(this)),
      );
  }

  createEpic(payload: EpicPayload): Observable<ProjectEpicResponse[]> {
    const headers = new HttpHeaders({ Prefer: 'return=representation' });
    return this.http
      .post<ProjectEpicResponse[]>(this.epicsURL, payload, { headers })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getEpicDetails(projectId: string, epicId: string): Observable<ProjectEpicResponse> {
    const params = new HttpParams().set('project_id', `eq.${projectId}`).set('id', `eq.${epicId}`);
    const headers = new HttpHeaders({ Prefer: 'return=representation' });

    return this.http.get<ProjectEpicResponse[]>(this.projectEpicsURL, { params, headers }).pipe(
      map((epics) => {
        if (!epics || epics.length === 0) throw new Error('Epic not found');
        return epics[0];
      }),
      catchError(this.handleError.bind(this)),
    );
  }

  getEpicTasks(epicId: string): Observable<ProjectTaskResponse[]> {
    const params = new HttpParams().set('epic_id', `eq.${epicId}`);
    return this.http.get<ProjectTaskResponse[]>(this.projectTasksURL, { params }).pipe(
      // Harvest and Patch
      tap((tasks) => tasks.forEach((t) => this.harvestNamesFromTask(t))),
      map((tasks) => tasks.map((t) => this.enrichTaskNames(t))),
      catchError(this.handleError.bind(this)),
    );
  }

  updateEpic(epicId: string, payload: Partial<EpicPayload>): Observable<void> {
    return this.http
      .patch<void>(`${this.epicsURL}?id=eq.${epicId}`, payload)
      .pipe(catchError(this.handleError.bind(this)));
  }

  createTask(payload: TaskPayload): Observable<ProjectTaskResponse[]> {
    const headers = new HttpHeaders({ Prefer: 'return=representation' });
    return this.http
      .post<ProjectTaskResponse[]>(this.tasksURL, payload, { headers })
      .pipe(catchError(this.handleError.bind(this)));
  }

  updateTask(taskId: string, payload: Partial<TaskPayload>): Observable<void> {
    return this.http
      .patch<void>(`${this.tasksURL}?id=eq.${taskId}`, payload)
      .pipe(catchError(this.handleError.bind(this)));
  }

  getProjectTasksByStatus(
    projectId: string,
    status: string,
    limit = 10,
    offset = 0,
    searchTerm = '',
  ): Observable<ProjectTaskResponse[]> {
    let params = new HttpParams()
      .set('project_id', `eq.${projectId}`)
      .set('status', `eq.${status}`)
      .set('order', 'created_at.desc')
      .set('limit', limit.toString())
      .set('offset', offset.toString());
    if (searchTerm && searchTerm.trim() !== '')
      params = params.set('title', `ilike.%${searchTerm.trim()}%`);

    return this.http.get<ProjectTaskResponse[]>(this.projectTasksURL, { params }).pipe(
      // Harvest and Patch
      tap((tasks) => tasks.forEach((t) => this.harvestNamesFromTask(t))),
      map((tasks) => tasks.map((t) => this.enrichTaskNames(t))),
      catchError(this.handleError.bind(this)),
    );
  }

  getAllProjectTasks(
    projectId: string,
    limit = 5,
    offset = 0,
    searchTerm = '',
  ): Observable<PaginatedResponse<ProjectTaskResponse>> {
    let params = new HttpParams()
      .set('project_id', `eq.${projectId}`)
      .set('order', 'created_at.desc')
      .set('limit', limit.toString())
      .set('offset', offset.toString());
    if (searchTerm && searchTerm.trim() !== '')
      params = params.set('title', `ilike.%${searchTerm.trim()}%`);

    return this.http
      .get<ProjectTaskResponse[]>(this.projectTasksURL, {
        params,
        headers: { Prefer: 'count=exact' },
        observe: 'response',
      })
      .pipe(
        map((response: HttpResponse<ProjectTaskResponse[]>) => {
          const contentRange = response.headers.get('Content-Range') || '0/0';
          const totalCount = parseInt(contentRange.split('/')[1], 10) || 0;

          // Cache harvest and Patch before sending to components
          const enrichedContent = (response.body || []).map((t) => {
            this.harvestNamesFromTask(t);
            return this.enrichTaskNames(t);
          });

          return { content: enrichedContent, totalElements: totalCount };
        }),
        catchError(this.handleError.bind(this)),
      );
  }

  getTaskDetails(projectId: string, taskId: string): Observable<ProjectTaskResponse> {
    const params = new HttpParams().set('project_id', `eq.${projectId}`).set('id', `eq.${taskId}`);

    return this.http.get<ProjectTaskResponse[]>(this.projectTasksURL, { params }).pipe(
      map((tasks) => {
        if (!tasks || tasks.length === 0) throw new Error('Task not found');
        const task = tasks[0];

        // Harvest and Patch
        this.harvestNamesFromTask(task);
        return this.enrichTaskNames(task);
      }),
      catchError(this.handleError.bind(this)),
    );
  }

  inviteMember(email: string, projectId: string): Observable<any> {
    const payload = {
      p_email: email,
      p_project_id: projectId,
      p_app_url: window.location.origin,
      p_base_url: this.baseURL,
    };
    return this.http.post(`${this.rpcInviteMemberURL}`, payload);
  }

  acceptInvitation(token: string): Observable<any> {
    return this.http.post(`${this.rpcAcceptInvitationURL}`, { p_token: token });
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
