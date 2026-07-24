import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProjectService } from '../../../core/project/services/project.service';
import { ProjectPayload } from '../../../core/project/models/project.model';

@Component({
  selector: 'app-add-project',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './add-project.html',
})
export class AddProject {
  projectForm: FormGroup;
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private projectService = inject(ProjectService);

  constructor() {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
    });
  }

  get addNewProjectFormControls() {
    return this.projectForm.controls;
  }

  get descriptionLength(): number {
    return this.projectForm.get('description')?.value?.length || 0;
  }

  onSubmit() {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const formValues = this.projectForm.value;

    const payload: ProjectPayload = {
      name: formValues.name.trim(),
      description: formValues.description?.trim() || undefined,
    };

    this.projectService.addProject(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.projectForm.reset();

        this.successMessage = 'Project created successfully! Redirecting to Projects page';

        setTimeout(() => {
          this.router.navigate(['/project']);
        }, 2000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.message || 'An unexpected error occurred while creating the project.';
        console.error(`Failed to create project: ${err.message || 'Unknown error'}`);
      },
    });
  }
}
