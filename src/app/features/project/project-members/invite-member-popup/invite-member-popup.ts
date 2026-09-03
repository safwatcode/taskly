import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { ProjectService } from '../../services/project.service';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { ProjectMemberResponse } from '../../models/project.model';

@Component({
  selector: 'app-invite-member-popup',
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './invite-member-popup.html',
  styleUrl: './invite-member-popup.css',
})
export class InviteMemberPopup {
  // Signal Inputs and Outputs
  projectId = input.required<string>();
  projectName = input.required<string>();
  existingMembers = input<ProjectMemberResponse[]>([]);
  closeDialog = output<void>();

  private projectService = inject(ProjectService);
  private destroyRef = inject(DestroyRef);

  // Local Signal State
  isInviting = signal(false);
  inviteSuccess = signal(false);
  inviteError = signal<string | null>(null);

  // Strict Email Validation
  inviteEmail = new FormControl('', [Validators.required, Validators.email]);

  onClose(): void {
    if (!this.isInviting()) {
      this.closeDialog.emit();
    }
  }

  sendInvitation(): void {
    if (this.inviteEmail.invalid) {
      this.inviteEmail.markAsTouched();
      return;
    }

    const email = this.inviteEmail.value?.trim();
    if (!email || !this.projectId()) return;

    // Duplicate Prevention (Front-End only)
    const isDuplicate = this.existingMembers().some((m) => m.email?.toLowerCase() === email);
    if (isDuplicate) {
      this.inviteError.set('This user is already a member of the project.');
      return;
    }

    this.isInviting.set(true);
    this.inviteError.set(null);
    this.inviteSuccess.set(false);

    this.projectService
      .inviteMember(email, this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isInviting.set(false);
          this.inviteSuccess.set(true);

          // Auto-close modal after success
          setTimeout(() => {
            this.onClose();
          }, 2500);
        },
        error: (err) => {
          this.isInviting.set(false);
          this.inviteError.set(
            err.error?.message || err.message || 'Failed to send invitation. Please try again.',
          );
        },
      });
  }
}
