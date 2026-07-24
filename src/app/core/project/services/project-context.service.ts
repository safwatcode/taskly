import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ProjectContextService {
  private readonly _activeProjectId = signal<string | null>(null);

  readonly activeProjectId = this._activeProjectId.asReadonly();

  setProjectId(id: string | null) {
    this._activeProjectId.set(id);
  }

  clearProject() {
    this._activeProjectId.set(null);
  }
}
