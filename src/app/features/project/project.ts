import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ProjectResponse } from '../../core/project/models/project.model';
import { ProjectService } from '../../core/project/services/project.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-project',
  imports: [RouterLink, DatePipe],
  templateUrl: './project.html',
  styleUrl: './project.css',
})
export class Project {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

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
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (data) => {
          this.projects = data;
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (err.status === 401) {
            this.router.navigate(['/login']);
          } else {
            this.hasError = true;
            this.cdr.detectChanges();
          }
        },
      });
  }

  retryConnection(): void {
    this.fetchProjects();
  }
}
