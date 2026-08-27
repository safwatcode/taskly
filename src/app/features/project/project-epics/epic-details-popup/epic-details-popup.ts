import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ProjectService } from '../../services/project.service';
import { Auth } from '../../../../core/auth/services/auth';
import { ProjectEpicResponse, ProjectMemberResponse } from '../../models/project.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserProfileResponse } from '../../../../core/auth/models/user-profile.model';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-epic-details-popup',
  standalone: true,
  imports: [NgClass, DatePipe, FormsModule],
  templateUrl: './epic-details-popup.html',
  styleUrl: './epic-details-popup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpicDetailsPopup implements OnInit {
  @Input({ required: true }) epicId!: string;
  @Input({ required: true }) projectId!: string;
  @Output() closeDialog = new EventEmitter<void>();
  @Output() epicUpdated = new EventEmitter<void>();

  private projectService = inject(ProjectService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  epic: ProjectEpicResponse | null = null;
  members: ProjectMemberResponse[] = [];
  isLoading = true;
  errorMessage: string | null = null;

  // Edit States
  isEditingTitle = false;
  isEditingDescription = false;
  isAssigneeDropdownOpen = false;

  // Initial Values for Inputs
  draftTitle = '';
  draftDescription = '';
  draftAssigneeId = '';
  draftDeadline = '';

  // UI Toast State
  toastError: string | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  // Dynamically block past dates in the date picker
  get minDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  ngOnInit(): void {
    this.fetchEpicDetails();
  }

  private fetchEpicDetails(): void {
    this.isLoading = true;

    forkJoin({
      epicData: this.projectService.getEpicDetails(this.projectId, this.epicId),
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

          const fetchedEpic = { ...data.epicData };

          if (
            fetchedEpic.assignee &&
            fetchedEpic.assignee.email === activeUserEmail &&
            !fetchedEpic.assignee.name &&
            activeUserName
          ) {
            fetchedEpic.assignee = { ...fetchedEpic.assignee, name: activeUserName };
          }
          if (
            fetchedEpic.created_by &&
            fetchedEpic.created_by.email === activeUserEmail &&
            !fetchedEpic.created_by.name &&
            activeUserName
          ) {
            fetchedEpic.created_by = { ...fetchedEpic.created_by, name: activeUserName };
          }

          this.epic = fetchedEpic;

          this.draftTitle = this.epic.title;
          this.draftDescription = this.epic.description || '';
          this.draftAssigneeId = this.epic.assignee?.sub || '';
          this.draftDeadline = this.epic.deadline || '';

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMessage = 'Failed to load epic details.';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  enableEdit(field: 'title' | 'description'): void {
    if (field === 'title') {
      this.isEditingTitle = true;
      this.draftTitle = this.epic!.title;
    } else if (field === 'description') {
      this.isEditingDescription = true;
      this.draftDescription = this.epic!.description || '';
    }

    this.cdr.detectChanges();

    setTimeout(() => {
      document.getElementById(`${field}Input`)?.focus();
    }, 0);
  }

  private showToast(message = 'Failed to update epic. Please try again.'): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastError = message;
    this.cdr.detectChanges();

    this.toastTimeout = setTimeout(() => {
      this.toastError = null;
      this.cdr.detectChanges();
    }, 4000);
  }

  saveTitle(): void {
    this.isEditingTitle = false;
    if (!this.epic) return;

    const newTitle = this.draftTitle.trim();
    if (!newTitle || newTitle === this.epic.title) {
      this.draftTitle = this.epic.title;
      return;
    }

    const previousValue = this.epic.title;
    this.epic.title = newTitle;

    this.projectService.updateEpic(this.epic.id, { title: newTitle }).subscribe({
      next: () => {
        this.epicUpdated.emit();
        this.cdr.detectChanges();
      },
      error: () => {
        this.epic!.title = previousValue;
        this.draftTitle = previousValue;
        this.showToast();
        this.cdr.detectChanges();
      },
    });
  }

  saveDescription(): void {
    this.isEditingDescription = false;
    if (!this.epic) return;

    const newDesc = this.draftDescription.trim();
    if (newDesc === (this.epic.description || '')) return;

    const previousValue = this.epic.description;
    this.epic.description = newDesc;

    this.projectService
      .updateEpic(this.epic.id, { description: newDesc || (null as any) })
      .subscribe({
        next: () => {
          this.epicUpdated.emit();
          this.cdr.detectChanges();
        },
        error: () => {
          this.epic!.description = previousValue;
          this.draftDescription = previousValue || '';
          this.showToast();
          this.cdr.detectChanges();
        },
      });
  }

  selectAssignee(memberId: string | null): void {
    // Close the dropdown after assignee selection
    this.isAssigneeDropdownOpen = false;

    // Update the draft ID
    this.draftAssigneeId = memberId || '';

    if (!this.epic) return;

    const previousValue = this.epic.assignee;

    // Find the member using the fallback logic
    const selectedMember = this.members.find(
      (m) => ((m as any).user_id || (m as any).sub || m.id) === this.draftAssigneeId,
    );

    // UI Optimistic Update after select the assignee from the dropdown menu
    if (selectedMember) {
      this.epic.assignee = {
        sub: this.draftAssigneeId,
        name: selectedMember.name,
        email: selectedMember.email,
      };
    } else {
      this.epic.assignee = null as any;
    }

    const payload = { assignee_id: this.draftAssigneeId || (null as any) };

    this.projectService.updateEpic(this.epic.id, payload).subscribe({
      next: () => {
        this.epicUpdated.emit();
        this.cdr.detectChanges();
      },
      error: () => {
        this.epic!.assignee = previousValue;
        this.draftAssigneeId = previousValue?.sub || '';
        this.showToast();
        this.cdr.detectChanges();
      },
    });
  }

  saveDeadline(): void {
    if (!this.epic) return;

    const newDeadline = this.draftDeadline;
    if (newDeadline === (this.epic.deadline || '')) return;

    // Validate that the manually typed date is not in the past
    // We check if newDeadline exists so users can still clear the date

    if (newDeadline && newDeadline < this.minDate) {
      // Revert the input field
      this.draftDeadline = this.epic.deadline || '';
      this.showToast('Deadline cannot be set in the past.');

      this.cdr.detectChanges();
      // Abort the save operation
      return;
    }

    const previousValue = this.epic.deadline;
    this.epic.deadline = newDeadline;

    this.projectService
      .updateEpic(this.epic.id, { deadline: newDeadline || (null as any) })
      .subscribe({
        next: () => {
          this.epicUpdated.emit();
          this.cdr.detectChanges();
        },
        error: () => {
          this.epic!.deadline = previousValue;
          this.draftDeadline = previousValue || '';
          this.showToast(); // Uses default 'Failed to update' message
          this.cdr.detectChanges();
        },
      });
  }

  onClose(): void {
    this.closeDialog.emit();
  }

  copyLink(): void {
    const url = `${window.location.origin}${window.location.pathname}?epic=${this.epicId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Epic link copied to the clipboard!');
    });
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
