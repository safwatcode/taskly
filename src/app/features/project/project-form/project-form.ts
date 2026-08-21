import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ProjectPayload } from '../models/project.model';
import { Observable } from 'rxjs';
import { InputField } from '../../../shared/components/input/input';

@Component({
  selector: 'app-project-form',
  imports: [RouterLink, ReactiveFormsModule, InputField],
  templateUrl: './project-form.html',
  styleUrl: './project-form.css',
  host: {
    class: 'flex flex-col flex-1 h-full min-h-0',
  },
})
export class ProjectForm implements OnInit {
  // Form and State Variables
  projectForm!: FormGroup;
  isEditMode = false;
  projectId: string | null = null;
  originalProjectName = '';

  // UI State Indicators
  isPageLoading = false;
  isSubmitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef); // Handles automatic unsubscription

  ngOnInit(): void {
    this.initForm();
    this.checkRouteParams();
  }

  private initForm(): void {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
    });
  }

  get controls() {
    return this.projectForm.controls;
  }

  get descriptionLength(): number {
    return this.projectForm.get('description')?.value?.length || 0;
  }

  private checkRouteParams(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('projectId');
      if (id) {
        this.isEditMode = true;
        this.projectId = id;
        this.isPageLoading = true;
        this.loadProjectDetails();
      }
    });
  }

  private loadProjectDetails(): void {
    if (!this.projectId) return;

    this.projectService
      .getProjectById(this.projectId)
      .pipe(
        takeUntilDestroyed(this.destroyRef), // Prevents memory leaks if component is destroyed early
        finalize(() => {
          this.isPageLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (project) => {
          this.originalProjectName = project.name;
          this.projectForm.patchValue({
            name: project.name,
            description: project.description,
          });
        },
        error: (err) => {
          this.errorMessage =
            err.message || 'An unexpected error occurred while getting project data.';
          console.error(`Failed to load project data: ${err.message || 'Unknown error'}`);
        },
      });
  }

  onSubmit(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    const formValues = this.projectForm.value;
    const payload: ProjectPayload = {
      name: formValues.name.trim(),
      description: formValues.description?.trim() || undefined,
    };

    // The request will emit something, ignoring the specific value because I care for the status not the value
    let request$: Observable<unknown>;

    if (this.isEditMode && this.projectId) {
      request$ = this.projectService.updateProject(this.projectId, payload);
    } else {
      request$ = this.projectService.addProject(payload);
    }

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef), // Cleans up subscription on navigate away
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = this.isEditMode
            ? 'Project successfully updated! Redirecting to Projects page...'
            : 'Project created successfully! Redirecting to Projects page...';

          if (!this.isEditMode) {
            this.projectForm.reset();
          }

          setTimeout(() => {
            this.router.navigate(['/project']);
          }, 2000);
        },
        error: (err) => {
          this.errorMessage =
            err.message ||
            `An unexpected error occurred while ${this.isEditMode ? 'updating' : 'creating'} the project.`;
          console.error(
            `Failed to ${this.isEditMode ? 'update' : 'create'} project: ${err.message || 'Unknown error'}`,
          );
        },
      });
  }

  // Back button in add project and edit project pages
  onCancel(): void {
    this.router.navigate(['/project']);
  }
}
