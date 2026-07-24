import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProjectPayload, ProjectResponse } from '../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private http = inject(HttpClient);

  private baseURL = 'https://jmltwxyausnmtasziccs.supabase.co';
  private projectsURL = `${this.baseURL}/rest/v1/projects`;

  addProject(payload: ProjectPayload): Observable<ProjectResponse[]> {
    const headers = new HttpHeaders({
      Prefer: 'return=representation',
    });

    return this.http
      .post<ProjectResponse[]>(this.projectsURL, payload, { headers })
      .pipe(catchError(this.handleError.bind(this)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred while creating the project.';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Network Error: ${error.error.message}`;
    } else {
      // Server-side error (Supabase error)
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = `Server Error (${error.status}): ${error.statusText}`;
      }
    }

    console.error('ProjectService Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}
