import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    // Generate today's date in YYYY-MM-DD format for the default deadline
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

          // 1. Extract the logged-in user's name and email from the Auth token
          let activeUserName: string | null = null;
          let activeUserEmail: string | null = null;

          if (data.userProfile) {
            const res = data.userProfile as UserProfileResponse;
            activeUserName = res.user_metadata?.name || null;
            activeUserEmail = res.email || res.user_metadata?.email || null;
          }

          // 2. Inject Auth name if DB name is missing for the active user
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

  get controls() {
    return this.epicForm.controls;
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

    // STRICT CHECK: Ensure it's not empty AND not the literal string "undefined"
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
}
