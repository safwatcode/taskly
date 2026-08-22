import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { ProjectEpicResponse } from '../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-project-epics',
  imports: [DatePipe, NgClass, RouterLink],
  templateUrl: './project-epics.html',
  styleUrl: './project-epics.css',
})
export class ProjectEpics implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  // State properties
  epics: ProjectEpicResponse[] = [];
  isLoading = true;
  errorMessage: string | null = null;

  projectName = '';

  ngOnInit(): void {
    this.fetchProjectEpics();
  }

  private fetchProjectEpics(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const projectId = params.get('projectId');

      if (projectId) {
        setTimeout(() => {
          this.projectContext.setProjectId(projectId);
        }, 0);

        this.fetchData(projectId);
      } else {
        this.isLoading = false;
        this.errorMessage = 'Project not found.';
        this.cdr.detectChanges();
      }
    });
  }

  private fetchData(projectId: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    // Use forkJoin to run both API calls concurrently
    forkJoin({
      project: this.projectService.getProjectById(projectId),
      epics: this.projectService.getProjectEpics(projectId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.projectName = data.project.name;
          this.epics = data.epics;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMessage =
            "We're having trouble retrieving your project epics right now. Please try again in a moment.";
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  retryConnection(): void {
    const currentProjectId = this.projectContext.activeProjectId();
    if (currentProjectId) {
      this.fetchData(currentProjectId);
    } else {
      const id = this.route.snapshot.paramMap.get('projectId');
      if (id) this.fetchData(id);
    }
  }

  // UI Helpers

  getInitials(name: string | null | undefined): string {
    if (!name || !name.trim()) return 'N/A';

    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getAvatarColorClass(name: string | null | undefined): string {
    if (!name || !name.trim()) return 'bg-slate-100 text-slate-500';

    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-emerald-100 text-emerald-700',
      'bg-indigo-100 text-indigo-700',
      'bg-purple-100 text-purple-700',
      'bg-orange-100 text-orange-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}
