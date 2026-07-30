import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { PaginatedResponse, ProjectResponse } from './models/project.model';
import { ProjectService } from './services/project.service';
import { DatePipe } from '@angular/common';
import { Pagination } from '../../shared/components/pagination/pagination';

@Component({
  selector: 'app-project',
  imports: [RouterLink, DatePipe, Pagination],
  templateUrl: './project.html',
  styleUrl: './project.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col flex-1 h-full min-h-0',
  },
})
export class Project implements OnInit, AfterViewInit {
  private projectService = inject(ProjectService);
  private destroyRef = inject(DestroyRef);

  projects = signal<ProjectResponse[]>([]);
  isLoading = signal<boolean>(true);
  isAppending = signal<boolean>(false);
  hasError = signal<boolean>(false);

  currentPage = signal<number>(1);

  // Limit of projects per page
  pageSize = signal<number>(5);
  totalProjects = signal<number>(0);

  totalPages = computed(() => Math.ceil(this.totalProjects() / this.pageSize()));

  // Elements to handle mobile infinite scrolling
  scrollContainer = viewChild<ElementRef>('scrollContainer');
  scrollTrigger = viewChild<ElementRef>('scrollTrigger');
  private observer: IntersectionObserver | null = null;

  ngOnInit(): void {
    this.executeFetch(false);
  }

  ngAfterViewInit(): void {
    this.setupInfiniteScroll();
  }

  executeFetch(isAppendingAction: boolean): void {
    if (isAppendingAction) {
      this.isAppending.set(true);
    } else {
      this.isLoading.set(true);
    }
    this.hasError.set(false);

    const limit = this.pageSize();

    // Offset calculation
    const offset = (this.currentPage() - 1) * limit;

    this.projectService
      .getProjects(limit, offset)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
          this.isAppending.set(false);
        }),
      )
      .subscribe({
        next: (response: PaginatedResponse<ProjectResponse>) => {
          if (isAppendingAction) {
            // Append data for mobile infinite scroll
            this.projects.update((prev) => [...prev, ...response.content]);
          } else {
            // Replace data for desktop pagination
            this.projects.set(response.content);
          }
          this.totalProjects.set(response.totalElements);
        },
        error: (err) => {
          console.error('Failed to load projects', err);
          this.hasError.set(true);
        },
      });
  }

  onPageChange(newPage: number): void {
    this.currentPage.set(newPage);
    this.executeFetch(false);

    // scroll back to top of list on desktop page change
    document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private setupInfiniteScroll(): void {
    const trigger = this.scrollTrigger()?.nativeElement;
    const container = this.scrollContainer()?.nativeElement;

    if (!trigger) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;

        if (
          isVisible &&
          !this.isLoading() &&
          !this.isAppending() &&
          this.currentPage() < this.totalPages()
        ) {
          this.currentPage.update((p) => p + 1);
          this.executeFetch(true);
        }
      },
      {
        // Bind the observer strictly to the scrolling div instead of the window
        root: container || null,
        threshold: 0.1,
      },
    );

    this.observer.observe(trigger);

    this.destroyRef.onDestroy(() => {
      if (this.observer) this.observer.disconnect();
    });
  }
  retryConnection(): void {
    this.executeFetch(false);
  }
}
