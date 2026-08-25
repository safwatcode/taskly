import {
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
import { ProjectEpicResponse } from '../../models/project.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserProfileResponse } from '../../../../core/auth/models/user-profile.model';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-epic-details-popup',
  imports: [NgClass, DatePipe],
  templateUrl: './epic-details-popup.html',
  styleUrl: './epic-details-popup.css',
})
export class EpicDetailsPopup implements OnInit {
  @Input({ required: true }) epicId!: string;
  @Input({ required: true }) projectId!: string;
  @Output() closeDialog = new EventEmitter<void>();

  private projectService = inject(ProjectService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  epic: ProjectEpicResponse | null = null;
  isLoading = true;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.fetchEpicDetails();
  }

  private fetchEpicDetails(): void {
    this.isLoading = true;

    forkJoin({
      epicData: this.projectService.getEpicDetails(this.projectId, this.epicId),
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

          // Map missing names
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

  onClose(): void {
    this.closeDialog.emit();
  }

  copyLink(): void {
    // Generates a link to the current epic
    const url = `${window.location.origin}${window.location.pathname}?epic=${this.epicId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
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
