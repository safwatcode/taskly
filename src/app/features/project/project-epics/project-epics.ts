import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../core/auth/services/auth';
import { ProjectEpicResponse } from '../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { DatePipe, NgClass } from '@angular/common';
import { catchError } from 'rxjs/operators';
import { UserProfileResponse } from '../../../core/auth/models/user-profile.model';

@Component({
  selector: 'app-project-epics',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink, FormsModule], // Add FormsModule here
  templateUrl: './project-epics.html',
  styleUrl: './project-epics.css',
  host: {
    class: 'flex flex-col flex-1 h-full min-h-0',
  },
})
export class ProjectEpics implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  // State properties
  epics: ProjectEpicResponse[] = [];
  filteredEpics: ProjectEpicResponse[] = [];

  isLoading = true;
  errorMessage: string | null = null;
  projectName = '';

  // Search State
  searchTerm = '';

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
      userProfile: this.authService.getUserProfile().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.projectName = data.project.name;

          let activeUserName: string | null = null;
          let activeUserEmail: string | null = null;

          if (data.userProfile) {
            const res = data.userProfile as UserProfileResponse;
            activeUserName = res.user_metadata?.name || null;
            activeUserEmail = res.email || res.user_metadata?.email || null;
          }

          this.epics = data.epics.map((epic) => {
            const updatedEpic = { ...epic };

            if (
              updatedEpic.assignee &&
              updatedEpic.assignee.email === activeUserEmail &&
              (!updatedEpic.assignee.name || !updatedEpic.assignee.name.trim()) &&
              activeUserName
            ) {
              updatedEpic.assignee = { ...updatedEpic.assignee, name: activeUserName };
            }

            if (
              updatedEpic.created_by &&
              updatedEpic.created_by.email === activeUserEmail &&
              (!updatedEpic.created_by.name || !updatedEpic.created_by.name.trim()) &&
              activeUserName
            ) {
              updatedEpic.created_by = { ...updatedEpic.created_by, name: activeUserName };
            }

            return updatedEpic;
          });

          this.isLoading = false;

          // Initialize the filtered list
          this.applyFilters();

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

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase().trim();

    if (term) {
      this.filteredEpics = this.epics.filter(
        (epic) =>
          epic.title.toLowerCase().includes(term) || epic.epic_id.toLowerCase().includes(term),
      );
    } else {
      // If search is empty, show everything
      this.filteredEpics = [...this.epics];
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
      'bg-blue-100 text-[#041B3C]',
      'bg-emerald-100 text-[#041B3C]',
      'bg-indigo-100 text-[#041B3C]',
      'bg-[#65DCA4] text-[#041B3C]',
      'bg-orange-100 text-[#041B3C]',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}
