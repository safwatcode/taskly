import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  input,
  OnInit,
  output,
  signal,
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
import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-task-details-popup',
  standalone: true,
  imports: [DatePipe, NgClass, FormsModule, NgTemplateOutlet],
  templateUrl: './task-details-popup.html',
  styleUrl: './task-details-popup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailsPopup implements OnInit {
  taskId = input.required<string>();
  projectId = input.required<string>();
  closeDialog = output<void>();
  taskUpdated = output<{ id: string; changes: Partial<ProjectTaskResponse> }>();

  private projectService = inject(ProjectService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);

  // Signal States
  task = signal<ProjectTaskResponse | null>(null);
  members = signal<ProjectMemberResponse[]>([]);
  epics = signal<ProjectEpicResponse[]>([]);
  epicDetails = signal<ProjectEpicResponse | null>(null);

  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // UI Edit Toggles
  isEditingTitle = signal(false);
  isEditingDescription = signal(false);
  isAssigneeDropdownOpen = signal(false);
  isEpicDropdownOpen = signal(false);
  isStatusDropdownOpen = signal(false);

  // Draft Values
  draftTitle = '';
  draftDescription = '';
  draftAssigneeId = '';
  draftEpicId = '';
  draftDueDate = '';

  // Toast Error State
  toastError = signal<string | null>(null);
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  statuses = [
    'TO_DO',
    'IN_PROGRESS',
    'BLOCKED',
    'IN_REVIEW',
    'READY_FOR_QA',
    'REOPENED',
    'READY_FOR_PRODUCTION',
    'DONE',
  ];

  // For Close on ESC key
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.onClose();
  }

  get minDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  ngOnInit(): void {
    if (this.taskId() && this.projectId()) {
      this.fetchTaskDetails();
    }
  }

  private fetchTaskDetails(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      taskData: this.projectService.getTaskDetails(this.projectId(), this.taskId()),
      membersData: this.projectService.getProjectMembers(this.projectId()),
      epicsData: this.projectService.getProjectEpics(this.projectId(), '', 100, 0),
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

          // Name Dictionary
          // Harvest the correct name from EVERY available source
          const nameDict = new Map<string, string>();

          // Source A: Active User Auth Profile
          if (activeUserEmail && activeUserName) {
            nameDict.set(activeUserEmail.toLowerCase(), activeUserName);
          }

          // Source B: Task Assignee data
          if (data.taskData.assignee?.email && data.taskData.assignee?.name) {
            nameDict.set(data.taskData.assignee.email.toLowerCase(), data.taskData.assignee.name);
          }

          // Source C: Task Reporter data
          const anyTask = data.taskData as any;
          if (anyTask.created_by?.email && anyTask.created_by?.name) {
            nameDict.set(anyTask.created_by.email.toLowerCase(), anyTask.created_by.name);
          }

          // Source D: Other Members
          data.membersData.forEach((m) => {
            if (m.email && m.name) nameDict.set(m.email.toLowerCase(), m.name);
          });

          // Deduplication and injection
          const uniqueMembersMap = new Map<string, ProjectMemberResponse>();

          data.membersData.forEach((member) => {
            const emailKey = member.email?.toLowerCase();
            const key = emailKey || member.id;

            // If they don't have a name, but our Dictionary found it, inject it!
            if (!member.name && emailKey && nameDict.has(emailKey)) {
              member.name = nameDict.get(emailKey);
            }

            const existing = uniqueMembersMap.get(key);
            if (!existing) {
              uniqueMembersMap.set(key, member);
            } else if (!existing.name && member.name) {
              uniqueMembersMap.set(key, member);
            }
          });

          // Process the perfected unique members array
          const mappedMembers = Array.from(uniqueMembersMap.values());
          this.members.set(mappedMembers);
          this.epics.set(data.epicsData.content);

          // Patch the Task Object
          const fetchedTask = { ...data.taskData };

          if (
            fetchedTask.assignee &&
            (!fetchedTask.assignee.name || !fetchedTask.assignee.name.trim()) &&
            fetchedTask.assignee.email
          ) {
            // Inject the name from the dictionary
            fetchedTask.assignee.name = nameDict.get(fetchedTask.assignee.email.toLowerCase())!;
          }

          if (
            anyTask.created_by &&
            (!anyTask.created_by.name || !anyTask.created_by.name.trim()) &&
            anyTask.created_by.email
          ) {
            // Inject the name from the dictionary
            anyTask.created_by.name = nameDict.get(anyTask.created_by.email.toLowerCase());
          }

          this.task.set(fetchedTask);
          this.epicDetails.set(this.epics().find((e) => e.id === fetchedTask.epic_id) || null);

          // Initialize Drafts
          this.draftTitle = fetchedTask.title;
          this.draftDescription = fetchedTask.description || '';
          this.draftEpicId = fetchedTask.epic_id || '';
          this.draftDueDate = fetchedTask.due_date ? fetchedTask.due_date.substring(0, 10) : '';

          let initialAssigneeId =
            fetchedTask.assignee?.sub || (fetchedTask.assignee as any)?.user_id || '';

          if (!initialAssigneeId && fetchedTask.assignee) {
            const matchedMember = this.members().find(
              (m) =>
                m.email === fetchedTask.assignee?.email || m.name === fetchedTask.assignee?.name,
            );
            if (matchedMember) {
              initialAssigneeId =
                (matchedMember as any).user_id ||
                (matchedMember as any).sub ||
                matchedMember.id ||
                '';
            }
          }
          this.draftAssigneeId = initialAssigneeId;

          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(
            err.message === 'Task not found' ? 'Task not found' : 'Failed to load task details',
          );
          this.isLoading.set(false);
        },
      });
  }

  // Signal Updates

  enableEdit(field: 'title' | 'description'): void {
    if (field === 'title') {
      this.isEditingTitle.set(true);
      this.draftTitle = this.task()!.title;
    } else {
      this.isEditingDescription.set(true);
      this.draftDescription = this.task()!.description || '';
    }

    // Give Angular time to render the @if block, then focus the visible input
    setTimeout(() => {
      const inputs = document.querySelectorAll(`[data-edit="${field}"]`);
      inputs.forEach((el) => {
        const htmlElement = el as HTMLElement;
        // offsetParent is only null if the element is hidden (display: none)
        if (htmlElement.offsetParent !== null) {
          htmlElement.focus();
        }
      });
    }, 0);
  }

  saveTitle(): void {
    this.isEditingTitle.set(false);
    const newTitle = this.draftTitle.trim();
    const currentTask = this.task();
    if (!currentTask || !newTitle || newTitle === currentTask.title) return;

    const previousValue = currentTask.title;
    this.task.update((t) => (t ? { ...t, title: newTitle } : t));

    this.projectService.updateTask(currentTask.id, { title: newTitle }).subscribe({
      next: () => this.taskUpdated.emit({ id: currentTask.id, changes: { title: newTitle } }),
      error: () => {
        this.task.update((t) => (t ? { ...t, title: previousValue } : t));
        this.draftTitle = previousValue;
        this.showToast('Failed to update task. Please try again.');
      },
    });
  }

  saveDescription(): void {
    this.isEditingDescription.set(false);
    const newDesc = this.draftDescription.trim();
    const currentTask = this.task();
    if (!currentTask || newDesc === (currentTask.description || '')) return;

    const previousValue = currentTask.description;
    this.task.update((t) => (t ? { ...t, description: newDesc } : t));

    this.projectService
      .updateTask(currentTask.id, { description: newDesc || (null as any) })
      .subscribe({
        next: () =>
          this.taskUpdated.emit({
            id: currentTask.id,
            changes: { description: newDesc || undefined },
          }),
        error: () => {
          this.task.update((t) => (t ? { ...t, description: previousValue } : t));
          this.draftDescription = previousValue || '';
          this.showToast('Failed to update task. Please try again.');
        },
      });
  }

  selectAssignee(memberId: string | null): void {
    this.isAssigneeDropdownOpen.set(false);
    const currentTask = this.task();
    if (!currentTask) return;

    // Check if it is currently assigned by looking at the object presence
    const isCurrentlyAssigned =
      !!currentTask.assignee && (!!currentTask.assignee.name || !!currentTask.assignee.email);
    const wantsUnassigned = !memberId;

    const currentAssigneeId =
      currentTask.assignee?.sub || (currentTask.assignee as any)?.user_id || '';
    const newAssigneeId = memberId || '';

    // Cancel if nothing changed (Both unassigned)
    if (!isCurrentlyAssigned && wantsUnassigned) return;

    // Cancel if nothing changed (Both assigned to the SAME person, provided the ID exists)
    if (
      isCurrentlyAssigned &&
      !wantsUnassigned &&
      currentAssigneeId === newAssigneeId &&
      currentAssigneeId !== ''
    )
      return;

    this.draftAssigneeId = newAssigneeId;
    const previousAssignee = currentTask.assignee;

    // Construct the new assignee or set explicitly to null (Unassigned)
    let newAssignee = null;
    if (memberId) {
      const selectedMember = this.members().find(
        (m) => ((m as any).user_id || (m as any).sub || m.id) === memberId,
      );
      if (selectedMember) {
        newAssignee = { sub: memberId, name: selectedMember.name, email: selectedMember.email };
      }
    }

    this.task.update((t) => (t ? { ...t, assignee: newAssignee as any } : t));

    // API Call
    this.projectService
      .updateTask(currentTask.id, { assignee_id: memberId || (null as any) })
      .subscribe({
        next: () =>
          this.taskUpdated.emit({ id: currentTask.id, changes: { assignee: newAssignee as any } }),
        error: () => {
          // Rollback on failure
          this.task.update((t) => (t ? { ...t, assignee: previousAssignee } : t));
          this.draftAssigneeId = previousAssignee?.sub || (previousAssignee as any)?.user_id || '';
          this.showToast('Failed to update task. Please try again.');
        },
      });
  }
  selectEpic(epicId: string | null): void {
    this.isEpicDropdownOpen.set(false);
    this.draftEpicId = epicId || '';
    const currentTask = this.task();
    if (!currentTask || (currentTask.epic_id || '') === this.draftEpicId) return;

    const previousEpicId = currentTask.epic_id;
    this.task.update((t) => (t ? { ...t, epic_id: epicId || undefined } : t));
    this.epicDetails.set(this.epics().find((e) => e.id === epicId) || null);

    this.projectService.updateTask(currentTask.id, { epic_id: epicId || (null as any) }).subscribe({
      next: () =>
        this.taskUpdated.emit({ id: currentTask.id, changes: { epic_id: epicId || undefined } }),
      error: () => {
        this.task.update((t) => (t ? { ...t, epic_id: previousEpicId } : t));
        this.draftEpicId = previousEpicId || '';
        this.epicDetails.set(this.epics().find((e) => e.id === previousEpicId) || null);
        this.showToast('Failed to update task. Please try again.');
      },
    });
  }

  selectStatus(status: string): void {
    this.isStatusDropdownOpen.set(false);
    const currentTask = this.task();
    if (!currentTask || currentTask.status === status) return;

    const previousStatus = currentTask.status;
    this.task.update((t) => (t ? { ...t, status } : t));

    this.projectService.updateTask(currentTask.id, { status }).subscribe({
      next: () => this.taskUpdated.emit({ id: currentTask.id, changes: { status } }),
      error: () => {
        this.task.update((t) => (t ? { ...t, status: previousStatus } : t));
        this.showToast('Failed to update task. Please try again.');
      },
    });
  }

  saveDueDate(): void {
    const newDeadline = this.draftDueDate;
    const currentTask = this.task();
    if (!currentTask || newDeadline === (currentTask.due_date?.substring(0, 10) || '')) return;

    if (newDeadline && newDeadline < this.minDate) {
      this.draftDueDate = currentTask.due_date?.substring(0, 10) || '';
      this.showToast('Due date cannot be set in the past.');
      return;
    }

    const previousValue = currentTask.due_date;
    const isoDate = newDeadline ? new Date(newDeadline).toISOString() : (null as any);
    this.task.update((t) => (t ? { ...t, due_date: isoDate } : t));

    this.projectService.updateTask(currentTask.id, { due_date: isoDate }).subscribe({
      next: () => this.taskUpdated.emit({ id: currentTask.id, changes: { due_date: isoDate } }),
      error: () => {
        this.task.update((t) => (t ? { ...t, due_date: previousValue } : t));
        this.draftDueDate = previousValue?.substring(0, 10) || '';
        this.showToast('Failed to update task. Please try again.');
      },
    });
  }

  private showToast(message: string): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastError.set(message);
    this.toastTimeout = setTimeout(() => this.toastError.set(null), 4000);
  }

  onClose(): void {
    this.closeDialog.emit();
  }

  copyLink(): void {
    const url = `${window.location.origin}/project/${this.projectId()}/tasks?task=${this.taskId()}`;

    navigator.clipboard.writeText(url).then(() => {
      alert('Task link copied to the clipboard!');
    });
  }

  formatStatus(status: string): string {
    return status ? status.replace(/_/g, ' ') : '';
  }

  // UI Helpers
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
    return parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
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
