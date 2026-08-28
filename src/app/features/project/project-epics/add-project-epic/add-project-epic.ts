import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Includes NgClass and DatePipe
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ProjectService } from '../../services/project.service';
import { ProjectContextService } from '../../services/project-context.service';
import { EpicPayload, ProjectMemberResponse } from '../../models/project.model';
import { Auth } from '../../../../core/auth/services/auth';
import { UserProfileResponse } from '../../../../core/auth/models/user-profile.model';

@Component({
  selector: 'app-add-project-epic',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './add-project-epic.html',
  host: {
    class: 'flex flex-col flex-1 h-full min-h-0 bg-slate-50',
  },
})
export class AddProjectEpic implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private authService = inject(Auth);

  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  // Form & Data State
  epicForm!: FormGroup;
  projectId = '';
  projectName = '';
  members: ProjectMemberResponse[] = [];

  // UI States
  isLoadingData = true;
  isSubmitting = false;
  loadError: string | null = null;
  submitError: string | null = null;

  // Controls the custom assignee dropdown
  isAssigneeDropdownOpen = false;

  // Dynamically block past dates in the date picker
  get minDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Getter to display the selected assignee's name and avatar in the UI
  get selectedAssignee(): ProjectMemberResponse | undefined {
    const selectedId = this.epicForm.get('assignee_id')?.value;
    if (!selectedId) return undefined;

    return this.members.find((m: any) => (m.user_id || m.sub || m.id) === selectedId);
  }

  get controls() {
    return this.epicForm.controls;
  }

  ngOnInit(): void {
    this.initForm();
    this.addProjectEpics();
  }

  private addProjectEpics(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('projectId');
      if (id) {
        this.projectId = id;

        // Sync Sidebar State
        setTimeout(() => {
          this.projectContext.setProjectId(this.projectId);
        }, 0);

        this.loadInitialData();
      } else {
        this.loadError = 'Project not found.';
        this.isLoadingData = false;
      }
    });
  }

  private initForm(): void {
    // Generate today's date format as the default deadline
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${yyyy}-${mm}-${dd}`;

    this.epicForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      assignee_id: [''],
      deadline: [defaultDate, [this.futureDateValidator]],
    });
  }

  private loadInitialData(): void {
    this.isLoadingData = true;
    this.loadError = null;

    forkJoin({
      project: this.projectService.getProjectById(this.projectId),
      members: this.projectService.getProjectMembers(this.projectId),
      userProfile: this.authService.getUserProfile().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.projectName = data.project.name;

          // Extract the logged-in user's name and email from the Auth token
          let activeUserName: string | null = null;
          let activeUserEmail: string | null = null;

          if (data.userProfile) {
            const res = data.userProfile as UserProfileResponse;
            activeUserName = res.user_metadata?.name || null;
            activeUserEmail = res.email || res.user_metadata?.email || null;
          }

          // Inject Auth name if DB name is missing for the active user
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

          this.isLoadingData = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load project context', err);
          this.loadError = 'Failed to load project details. Please try again.';
          this.isLoadingData = false;
          this.cdr.detectChanges();
        },
      });
  }

  // Custom Validator for Deadline
  private futureDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }

    const [year, month, day] = control.value.split('-');
    const selectedDate = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();

    // Reset time to strictly compare dates
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return { pastDate: true };
    }
    return null;
  }

  // Handles selection from the custom dropdown menu
  selectAssignee(id: string | null): void {
    this.epicForm.patchValue({ assignee_id: id });
    this.isAssigneeDropdownOpen = false;
  }

  onSubmit(): void {
    this.submitError = null;

    if (this.epicForm.invalid) {
      this.epicForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    // Build payload ensuring empty strings for optional fields aren't sent
    const formValues = this.epicForm.value;
    const payload: EpicPayload = {
      project_id: this.projectId,
      title: formValues.title.trim(),
    };

    if (formValues.description?.trim()) {
      payload.description = formValues.description.trim();
    }

    // Ensure it's not empty AND not the literal string "undefined"
    if (formValues.assignee_id && formValues.assignee_id !== 'undefined') {
      payload.assignee_id = formValues.assignee_id;
    }

    if (formValues.deadline) {
      payload.deadline = formValues.deadline;
    }

    this.projectService
      .createEpic(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          // Navigate back to the epics list upon success
          this.router.navigate(['/project', this.projectId, 'epics']);
        },
        error: (err) => {
          console.error('Error creating epic:', err);
          this.submitError = 'Failed to create epic. Please try again later.';
        },
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
