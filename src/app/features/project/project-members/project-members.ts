import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { ProjectMemberResponse } from '../models/project.model';
import { Auth } from '../../../core/auth/services/auth';
import { UserProfileResponse } from '../../../core/auth/models/user-profile.model';
import { InviteMemberPopup } from './invite-member-popup/invite-member-popup';

@Component({
  selector: 'app-project-members',
  standalone: true,
  imports: [CommonModule, RouterLink, InviteMemberPopup],
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

  // Using project id to open pass to the popup modal
  projectId = '';

  isInviteModalOpen = signal(false);

  ngOnInit(): void {
    this.fetchProjectMembers();
  }

  private fetchProjectMembers(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('projectId');

      if (id) {
        this.projectId = id; // Save it here
        setTimeout(() => this.projectContext.setProjectId(id), 0);
        this.fetchData(id);
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

    // Fetching Project, Members, Auth, and Tasks simultaneously
    forkJoin({
      project: this.projectService.getProjectById(projectId),
      members: this.projectService.getProjectMembers(projectId),
      userProfile: this.authService.getUserProfile().pipe(catchError(() => of(null))),

      // A process called "Background Harvest": silently fetch up to 100 tasks just to mine the missing names
      // catchError ensures that if this background fetch fails, it doesn't break the members page

      tasks: this.projectService
        .getAllProjectTasks(projectId, 100, 0)
        .pipe(catchError(() => of({ content: [], totalElements: 0 }))),
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

          // Name Dictionary
          const nameDict = new Map<string, string>();

          // Harvest names from the background tasks
          if (data.tasks && data.tasks.content) {
            data.tasks.content.forEach((task) => {
              if (task.assignee?.email && task.assignee?.name) {
                nameDict.set(task.assignee.email.toLowerCase(), task.assignee.name);
              }
              const tAny = task as any;
              if (tAny.created_by?.email && tAny.created_by?.name) {
                nameDict.set(tAny.created_by.email.toLowerCase(), tAny.created_by.name);
              }
            });
          }

          // Harvest names from any members that actually came back correctly
          data.members.forEach((m) => {
            if (m.email && m.name) {
              nameDict.set(m.email.toLowerCase(), m.name);
            }
          });
          // Duplicate Prevention (Front-End only)
          const uniqueMembersMap = new Map<string, ProjectMemberResponse>();
          data.members.forEach((member) => {
            const emailKey = member.email?.toLowerCase();
            const key = emailKey || member.id;

            // Inject from Active User Profile
            if (emailKey === activeUserEmail && !member.name && activeUserName) {
              member.name = activeUserName;
            }

            // Inject from the Background Tasks Dictionary
            if (!member.name && emailKey && nameDict.has(emailKey)) {
              member.name = nameDict.get(emailKey)!;
            }

            const existing = uniqueMembersMap.get(key);

            if (!existing) {
              uniqueMembersMap.set(key, member);
            } else if (!existing.name && member.name) {
              // If we already saved a nameless duplicate, overwrite it with the named one!
              uniqueMembersMap.set(key, member);
            }
          });

          this.members = Array.from(uniqueMembersMap.values()).sort((a, b) => {
            const roleA = a.role?.toUpperCase() || '';
            const roleB = b.role?.toUpperCase() || '';

            // Sorting the members with the 'OWNER' role of the project at the top
            if (roleA === 'OWNER' && roleB !== 'OWNER') return -1;
            if (roleB === 'OWNER' && roleA !== 'OWNER') return 1;

            // The else we will sort them alphabetically by their name or email (In case if the Unknown name problem)
            const nameA = (a.name || a.email || '').toLowerCase();
            const nameB = (b.name || b.email || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
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

  // UI helpers
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
