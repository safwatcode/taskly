import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ProjectResponse } from './models/project.model';
import { ProjectService } from './services/project.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-project',
  imports: [RouterLink, DatePipe],
  templateUrl: './project.html',
  styleUrl: './project.css',
})
export class Project implements OnInit {
  private projectService = inject(ProjectService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  projects: ProjectResponse[] = [];
  isLoading = true;
  hasError = false;

  ngOnInit(): void {
    this.fetchProjects();
  }

  fetchProjects(): void {
    this.isLoading = true;
    this.hasError = false;

    this.projectService
      .getProjects()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (data) => {
          this.projects = data;
        },
        error: (err) => {
          console.error('Failed to load projects', err);
          this.hasError = true;
        },
      });
  }

  retryConnection(): void {
    this.fetchProjects();
  }
}
