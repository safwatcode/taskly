import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ProjectContextService } from '../../services/project-context.service';
import { Auth } from '../../../../core/auth/services/auth';
import { UserProfileResponse } from '../../../../core/auth/models/user-profile.model';
import {
  ProjectEpicResponse,
  ProjectMemberResponse,
  TaskPayload,
} from '../../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-add-project-tasks',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, NgClass, DatePipe],
  templateUrl: './add-project-tasks.html',
  styleUrl: './add-project-tasks.css',
  host: {
    class: 'flex flex-col flex-1 h-full min-h-0 bg-slate-50',
  },
})
export class AddProjectTasks implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private authService = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  taskForm!: FormGroup;
  projectId = '';
  projectName = '';

  // Data Arrays
  members: ProjectMemberResponse[] = [];
  epics: ProjectEpicResponse[] = [];

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

  // UI States
  isLoadingData = true;
  isSubmitting = false;
  submitError: string | null = null;

  // Dropdown States
  isStatusDropdownOpen = false;
  isAssigneeDropdownOpen = false;
  isEpicDropdownOpen = false;

  // Dynamically block past dates in the date picker
  get minDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  ngOnInit(): void {
    this.initForm();
    this.loadContext();
  }

  private initForm(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required]],
      status: ['TO_DO', [Validators.required]],
      epic_id: [''],
      assignee_id: [''],
      due_date: ['', [this.futureDateValidator.bind(this)]], // NEW: Added validator
      description: [''],
    });
  }

  // Custom Validator for Due Date
  private futureDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const [year, month, day] = control.value.split('-');
    const selectedDate = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return { pastDate: true };
    }
    return null;
  }

  private loadContext(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.projectId = params.get('projectId') || '';
      if (!this.projectId) return;

      this.projectContext.setProjectId(this.projectId);

      const prefillEpicId = this.route.snapshot.queryParamMap.get('epicId');
      if (prefillEpicId) {
        this.taskForm.patchValue({ epic_id: prefillEpicId });
      }
      const prefillStatus = this.route.snapshot.queryParamMap.get('status');
      if (prefillStatus) this.taskForm.patchValue({ status: prefillStatus });

      this.fetchData();
    });
  }

  private fetchData(): void {
    this.isLoadingData = true;
    forkJoin({
      project: this.projectService.getProjectById(this.projectId),
      members: this.projectService.getProjectMembers(this.projectId),
      epics: this.projectService.getProjectEpics(this.projectId, '', 100, 0),
      userProfile: this.authService.getUserProfile().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.projectName = data.project.name;
          this.epics = data.epics.content;

          let activeUserName: string | null = null;
          let activeUserEmail: string | null = null;

          if (data.userProfile) {
            const res = data.userProfile as UserProfileResponse;
            activeUserName = res.user_metadata?.name || null;
            activeUserEmail = res.email || res.user_metadata?.email || null;
          }

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
        error: () => {
          this.isLoadingData = false;
          this.cdr.detectChanges();
        },
      });
  }

  // Dropdown Interactions
  toggleDropdown(type: 'status' | 'assignee' | 'epic'): void {
    if (type === 'status') {
      this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
      this.isAssigneeDropdownOpen = false;
      this.isEpicDropdownOpen = false;
    } else if (type === 'assignee') {
      this.isAssigneeDropdownOpen = !this.isAssigneeDropdownOpen;
      this.isStatusDropdownOpen = false;
      this.isEpicDropdownOpen = false;
    } else {
      this.isEpicDropdownOpen = !this.isEpicDropdownOpen;
      this.isStatusDropdownOpen = false;
      this.isAssigneeDropdownOpen = false;
    }
  }

  closeAllDropdowns(): void {
    this.isStatusDropdownOpen = false;
    this.isAssigneeDropdownOpen = false;
    this.isEpicDropdownOpen = false;
  }

  selectStatus(status: string): void {
    this.taskForm.patchValue({ status });
    this.closeAllDropdowns();
  }

  selectAssignee(id: string | null): void {
    this.taskForm.patchValue({ assignee_id: id });
    this.closeAllDropdowns();
  }

  selectEpic(id: string | null): void {
    this.taskForm.patchValue({ epic_id: id });
    this.closeAllDropdowns();
  }

  // UI Formatters
  formatStatus(status: string): string {
    return status ? status.replace(/_/g, ' ') : '';
  }

  formatEpicOption(epic: ProjectEpicResponse): string {
    let title = epic.title;
    if (title.length > 100) {
      title = title.substring(0, 100) + '...';
    }
    return `${epic.epic_id} - ${title}`;
  }

  get selectedAssignee(): ProjectMemberResponse | undefined {
    const selectedId = this.taskForm.get('assignee_id')?.value;
    if (!selectedId) return undefined;
    return this.members.find((m: any) => (m.user_id || m.sub || m.id) === selectedId);
  }

  get selectedEpic(): ProjectEpicResponse | undefined {
    const id = this.taskForm.get('epic_id')?.value;
    return this.epics.find((e) => e.id === id);
  }

  get controls() {
    return this.taskForm.controls;
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;
    const formVals = this.taskForm.value;

    const payload: TaskPayload = {
      project_id: this.projectId,
      title: formVals.title.trim(),
      status: formVals.status,
    };

    if (formVals.description?.trim()) payload.description = formVals.description.trim();
    if (formVals.epic_id) payload.epic_id = formVals.epic_id;
    if (formVals.assignee_id) payload.assignee_id = formVals.assignee_id;

    if (formVals.due_date) {
      const dateObj = new Date(formVals.due_date);
      payload.due_date = dateObj.toISOString();
    }

    this.projectService
      .createTask(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          window.history.back();
        },
        error: () => {
          this.submitError = 'Failed to create task. Please try again.';
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
