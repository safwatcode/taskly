import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ProjectService } from '../../services/project.service';
import { Auth } from '../../../../core/auth/services/auth';
import {
  ProjectEpicResponse,
  ProjectMemberResponse,
  ProjectTaskResponse,
} from '../../models/project.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserProfileResponse } from '../../../../core/auth/models/user-profile.model';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-task-details-popup',
  imports: [DatePipe, NgClass],
  templateUrl: './task-details-popup.html',
  styleUrl: './task-details-popup.css',
})
export class TaskDetailsPopup implements OnInit {
  @Input({ required: true }) taskId!: string;
  @Input({ required: true }) projectId!: string;
  @Output() closeDialog = new EventEmitter<void>();

  private projectService = inject(ProjectService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  task: ProjectTaskResponse | null = null;
  members: ProjectMemberResponse[] = [];
  epicDetails: ProjectEpicResponse | null = null;

  isLoading = true;
  errorMessage: string | null = null;

  // For Close on ESC key
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.onClose();
  }

  ngOnInit(): void {
    if (this.taskId && this.projectId) {
      this.fetchTaskDetails();
    }
  }

  private fetchTaskDetails(): void {
    this.isLoading = true;
    this.errorMessage = null;

    forkJoin({
      taskData: this.projectService.getTaskDetails(this.projectId, this.taskId),
      membersData: this.projectService.getProjectMembers(this.projectId),
      userProfile: this.authService.getUserProfile().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          let activeUserName: string | null = null;
          let activeUserEmail: string | null = null;

          if (data.userProfile) {
            const res = data.userProfile as UserProfileResponse;
            activeUserName = res.user_metadata?.name || null;
            activeUserEmail = res.email || res.user_metadata?.email || null;
          }

          // Map members for accurate display
          this.members = data.membersData.map((member) => {
            if (
              member.email === activeUserEmail &&
              (!member.name || !member.name.trim()) &&
              activeUserName
            ) {
              return { ...member, name: activeUserName };
            }
            return member;
          });

          const fetchedTask = { ...data.taskData };

          // Map Assignee and Reporter (Created By)
          if (
            fetchedTask.assignee &&
            fetchedTask.assignee.email === activeUserEmail &&
            !fetchedTask.assignee.name &&
            activeUserName
          ) {
            fetchedTask.assignee = { ...fetchedTask.assignee, name: activeUserName };
          }

          // Assuming API returns created_by. Modify if it strictly returns reporter
          const taskAny = fetchedTask as any;
          if (
            taskAny.created_by &&
            taskAny.created_by.email === activeUserEmail &&
            !taskAny.created_by.name &&
            activeUserName
          ) {
            taskAny.created_by = { ...taskAny.created_by, name: activeUserName };
          }

          this.task = fetchedTask;

          // If the task belongs to an epic, fetch the epic details!
          if (this.task.epic_id) {
            this.projectService
              .getEpicDetails(this.projectId, this.task.epic_id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (epic) => {
                  this.epicDetails = epic;
                  this.cdr.detectChanges();
                },
              });
          }

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          // Empty state vs Error state
          this.errorMessage =
            err.message === 'Task not found' ? 'Task not found' : 'Failed to load task details';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onClose(): void {
    this.closeDialog.emit();
  }

  copyLink(): void {
    const url = `${window.location.origin}${window.location.pathname}?task=${this.taskId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Task link copied to the clipboard!');
    });
  }

  // Colored Badge based on Value
  getStatusConfig(status: string) {
    switch (status) {
      case 'DONE':
      case 'COMPLETED':
        return {
          bg: 'bg-[#82F9BE]',
          text: 'text-[#004E32]',
          border: 'border-[#82F9BE]',
          label: 'COMPLETED',
        };
      case 'IN_PROGRESS':
        return {
          bg: 'bg-[#E8EDF9]',
          text: 'text-[#0052CC]',
          border: 'border-blue-200',
          label: 'IN PROGRESS',
        };
      case 'TO_DO':
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-200',
          label: 'TO DO',
        };
      case 'BLOCKED':
        return {
          bg: 'bg-[#FFDAD6]',
          text: 'text-[#BA1A1A]',
          border: 'border-red-200',
          label: 'BLOCKED',
        };
      case 'IN_REVIEW':
        return {
          bg: 'bg-purple-500',
          text: 'text-white',
          border: 'border-slate-100',
          label: 'IN REVIEW',
        };
      case 'READY_FOR_QA':
        return {
          bg: 'bg-teal-500',
          text: 'text-white',
          border: 'border-slate-100',
          label: 'READY FOR QA',
        };
      case 'REOPENED':
        return {
          bg: 'bg-orange-500',
          text: 'text-white',
          border: 'border-slate-100',
          label: 'REOPENED',
        };
      case 'READY_FOR_PRODUCTION':
        return {
          bg: 'bg-blue-400',
          text: 'text-white',
          border: 'border-slate-100',
          label: 'READY FOR PRODUCTION',
        };
      default:
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-200',
          label: status,
        };
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
