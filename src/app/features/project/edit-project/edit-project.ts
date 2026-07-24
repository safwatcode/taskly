import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectService } from '../../../core/project/services/project.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { InputField } from '../../../shared/components/input/input';

@Component({
  selector: 'app-edit-project',
  imports: [RouterLink, ReactiveFormsModule, InputField],
  templateUrl: './edit-project.html',
  styleUrl: './edit-project.css',
})
export class EditProject implements OnInit {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  editForm!: FormGroup;
  projectId!: string;
  originalProjectName = '';

  isLoading = true;
  isSaving = false;
  successMessage = false;
  hasError = false;

  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('projectId');
      if (id) {
        this.projectId = id;
        this.loadProjectDetails();
      } else {
        this.router.navigate(['/project']); // Fallback if no ID[cite: 3]
      }
    });
  }

  get editProjectFormControls() {
    return this.editForm.controls;
  }

  get descriptionLength(): number {
    return this.editForm.get('description')?.value?.length || 0;
  }
  loadProjectDetails(): void {
    this.projectService
      .getProjectById(this.projectId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (project) => {
          this.originalProjectName = project.name;
          this.editForm.patchValue({
            name: project.name,
            description: project.description,
          });
        },
        error: () => {
          this.hasError = true;
        },
      });
  }

  onSubmit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.editForm.value;

    this.projectService
      .updateProject(this.projectId, payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = true; // Show success message[cite: 3]
          setTimeout(() => {
            this.router.navigate(['/project']);
          }, 2000); // Redirect after 2 seconds
        },
        error: (err) => {
          console.error('Failed to update project', err);
        },
      });
  }

  onCancel(): void {
    // Redirect back to project listing without saving[cite: 3]
    this.router.navigate(['/project']);
  }
}
