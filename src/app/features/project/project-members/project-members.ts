import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { ProjectMemberResponse } from '../models/project.model';

// For fetching user profile data to solve getting user's name problem in members list
import { Auth } from '../../../core/auth/services/auth';
import { UserProfileResponse } from '../../../core/auth/models/user-profile.model';

@Component({
  selector: 'app-project-members',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-members.html',
  styleUrls: ['./project-members.css'],
  host: {
    class: 'flex flex-col flex-1 h-full min-h-0',
  },
})
export class ProjectMembers implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  members: ProjectMemberResponse[] = [];
  isLoading = true;
  errorMessage: string | null = null;
  projectName = '';

  ngOnInit(): void {
    this.fetchMembers();
  }

  private fetchMembers(): void {
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

    // Fetching Project, Members, and Current User Profile simultaneously
    forkJoin({
      project: this.projectService.getProjectById(projectId),
      members: this.projectService.getProjectMembers(projectId),

      // catchError ensures that if the Auth fetch fails, it doesn't break the whole page
      userProfile: this.authService.getUserProfile().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.projectName = data.project.name;

          // Extract the logged-in user's name and email from the Auth token. As we did in the navbar (this is the issue)
          let activeUserName: string | null = null;
          let activeUserEmail: string | null = null;

          if (data.userProfile) {
            const res = data.userProfile as UserProfileResponse;
            activeUserName = res.user_metadata?.name || null;
            activeUserEmail = res.email || res.user_metadata?.email || null;
          }

          // Go through the members. If a member is the logged-in user, and the database name is missing, inject the Auth (Sign-up data) name.
          this.members = data.members.map((member) => {
            if (
              member.email === activeUserEmail &&
              (!member.name || !member.name.trim()) &&
              activeUserName
            ) {
              return { ...member, name: activeUserName };
            }
            return member;
          });

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error fetching data:', err);
          this.errorMessage =
            "We're having trouble retrieving your project members right now. Please try again in a moment.";
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

  getRoleBadgeClass(role: string): string {
    switch (role?.toUpperCase()) {
      case 'OWNER':
        return 'bg-[#0052CC] text-white';
      case 'ADMIN':
        return 'bg-blue-100 text-[#0052CC]';
      case 'MEMBER':
      case 'VIEWER':
        return 'bg-slate-200 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  }
}
