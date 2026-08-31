import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { BoardColumn, ProjectTaskResponse } from '../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { combineLatest } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { TaskDetailsPopup } from './task-details-popup/task-details-popup';

@Component({
  selector: 'app-project-tasks',
  standalone: true,
  imports: [
    RouterLink,
    NgClass,
    DatePipe,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    NgTemplateOutlet,
    ReactiveFormsModule,
    TaskDetailsPopup,
    UpperCasePipe,
    CdkDragPreview,
  ],
  templateUrl: './project-tasks.html',
  styleUrl: './project-tasks.css',
  host: { class: 'flex flex-col flex-1 h-full overflow-hidden bg-slate-50' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTasks implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private breakpointObserver = inject(BreakpointObserver);
  private destroyRef = inject(DestroyRef);

  projectId = signal('');
  projectName = signal('');

  currentView = signal<'board' | 'list'>('board');
  isViewDropdownOpen = signal(false);

  private lastFetchedView: 'board' | 'list' | null = null;
  private lastFetchedProjectId: string | null = null;

  searchControl = new FormControl('');

  // Signals for list view
  listTasks = signal<ProjectTaskResponse[]>([]);
  isListLoading = signal(true);
  listError = signal(false);

  listCurrentPage = signal(1);
  listPageSize = signal(5);
  listTotalItems = signal(0);
  listTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.listTotalItems() / this.listPageSize())),
  );

  isMobileView = signal(false);
  isListLoadingMore = signal(false);
  listLoadingMoreError = signal(false);

  toastError = signal<string | null>(null);
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  selectedTaskId = signal<string | null>(null);

  // Signals for Board view
  boardColumns = signal<BoardColumn[]>([
    {
      id: 'TO_DO',
      label: 'TO DO',
      dotClass: 'bg-slate-400',
      borderClass: 'border border-slate-100',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'IN_PROGRESS',
      label: 'IN PROGRESS',
      dotClass: 'bg-[#0052CC]',
      borderClass: 'border border-slate-100 border-l-4 border-l-[#0052CC]',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'BLOCKED',
      label: 'BLOCKED',
      dotClass: 'bg-[#BA1A1A]',
      borderClass: 'border border-red-200',
      bgClass: 'bg-[#FFF4F4]',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'IN_REVIEW',
      label: 'IN REVIEW',
      dotClass: 'bg-purple-500',
      borderClass: 'border border-slate-100 border-l-4 border-l-purple-500',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'READY_FOR_QA',
      label: 'READY FOR QA',
      dotClass: 'bg-teal-500',
      borderClass: 'border border-slate-100 border-l-4 border-l-teal-500',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'REOPENED',
      label: 'REOPENED',
      dotClass: 'bg-orange-500',
      borderClass: 'border border-slate-100 border-l-4 border-l-orange-500',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'READY_FOR_PRODUCTION',
      label: 'READY FOR PRODUCTION',
      dotClass: 'bg-blue-400',
      borderClass: 'border border-slate-100 border-l-4 border-l-blue-400',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'DONE',
      label: 'DONE',
      dotClass: 'bg-emerald-500',
      borderClass: 'border border-slate-100 border-l-4 border-l-emerald-500 opacity-70',
      bgClass: 'bg-slate-50',
      tasks: [],
      isLoading: true,
      error: false,
    },
  ]);

  ngOnInit(): void {
    this.fetchTasks();
  }

  private fetchTasks(): void {
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
      this.breakpointObserver.observe(['(max-width: 767px)']),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, qParams, breakpointState]) => {
        const newProjectId = params.get('projectId') || '';
        const viewParam = qParams.get('view');
        this.isMobileView.set(breakpointState.matches);

        if (newProjectId && newProjectId !== this.projectId()) {
          this.projectId.set(newProjectId);
          this.projectContext.setProjectId(newProjectId);
          this.fetchProjectName();
          this.searchControl.setValue('', { emitEvent: false });
        }

        this.currentView.set(this.isMobileView() || viewParam === 'list' ? 'list' : 'board');

        if (this.projectId()) {
          if (
            this.lastFetchedProjectId !== this.projectId() ||
            this.lastFetchedView !== this.currentView()
          ) {
            this.executeActiveViewFetch();
            this.lastFetchedProjectId = this.projectId();
            this.lastFetchedView = this.currentView();
          }
        }
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.executeActiveViewFetch());
  }

  onTaskUpdated(payload: { id: string; changes: Partial<ProjectTaskResponse> }): void {
    // Update List View Data
    this.listTasks.update((tasks) =>
      tasks.map((t) => (t.id === payload.id ? { ...t, ...payload.changes } : t)),
    );

    // Update Board Columns Data
    this.boardColumns.update((cols) => {
      // Clone all tasks to ensure Signal change detection works correctly
      const updatedCols = cols.map((c) => ({ ...c, tasks: [...c.tasks] }));
      let currentColIndex = -1;
      let taskIndex = -1;

      for (let i = 0; i < updatedCols.length; i++) {
        taskIndex = updatedCols[i].tasks.findIndex((t) => t.id === payload.id);
        if (taskIndex > -1) {
          currentColIndex = i;
          break;
        }
      }

      if (currentColIndex > -1 && taskIndex > -1) {
        const existingTask = updatedCols[currentColIndex].tasks[taskIndex];
        const updatedTask = { ...existingTask, ...payload.changes };

        // Handle Status Move if necessary
        if (payload.changes.status && payload.changes.status !== existingTask.status) {
          updatedCols[currentColIndex].tasks.splice(taskIndex, 1); // Remove from old
          const newCol = updatedCols.find((c) => c.id === payload.changes.status);
          if (newCol) newCol.tasks.unshift(updatedTask); // Prepend to new column
        } else {
          updatedCols[currentColIndex].tasks[taskIndex] = updatedTask; // In-place update
        }
      }
      return updatedCols;
    });
  }

  openTaskDetails(taskId: string): void {
    this.selectedTaskId.set(taskId);
  }

  closeTaskDetails(): void {
    this.selectedTaskId.set(null);
  }

  private executeActiveViewFetch(): void {
    if (this.currentView() === 'list') {
      this.listCurrentPage.set(1);
      this.fetchListTasks();
    } else {
      this.loadAllColumnsIndependently();
    }
  }

  switchView(view: 'board' | 'list'): void {
    this.isViewDropdownOpen.set(false);
    if (this.currentView() === view) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view },
      queryParamsHandling: 'merge',
    });
  }

  private fetchProjectName(): void {
    this.projectService
      .getProjectById(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((project) => this.projectName.set(project.name));
  }

  protected fetchListTasks(append = false): void {
    if (append) {
      this.isListLoadingMore.set(true);
      this.listLoadingMoreError.set(false);
    } else {
      this.isListLoading.set(true);
    }
    this.listError.set(false);

    const limit = this.listPageSize();
    const offset = (this.listCurrentPage() - 1) * limit;

    this.projectService
      .getAllProjectTasks(this.projectId(), limit, offset, this.searchControl.value || '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (append) {
            this.listTasks.update((prev) => [...prev, ...response.content]);
          } else {
            this.listTasks.set(response.content);
          }
          this.listTotalItems.set(response.totalElements);
          this.isListLoading.set(false);
          this.isListLoadingMore.set(false);
        },
        error: () => {
          if (append) {
            this.listLoadingMoreError.set(true);
            this.listCurrentPage.update((p) => p - 1);
          } else {
            this.listError.set(true);
          }
          this.isListLoading.set(false);
          this.isListLoadingMore.set(false);
        },
      });
  }

  nextListPage(): void {
    if (this.listCurrentPage() < this.listTotalPages()) {
      this.listCurrentPage.update((p) => p + 1);
      this.fetchListTasks();
    }
  }

  prevListPage(): void {
    if (this.listCurrentPage() > 1) {
      this.listCurrentPage.update((p) => p - 1);
      this.fetchListTasks();
    }
  }

  onListScroll(event: Event): void {
    if (
      !this.isMobileView() ||
      this.isListLoading() ||
      this.isListLoadingMore() ||
      this.listLoadingMoreError()
    )
      return;

    const target = event.target as HTMLElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;

    if (isNearBottom && this.listCurrentPage() < this.listTotalPages()) {
      this.listCurrentPage.update((p) => p + 1);
      this.fetchListTasks(true);
    }
  }

  private loadAllColumnsIndependently(): void {
    this.boardColumns.update((cols) => {
      cols.forEach((c) => {
        c.isLoading = true;
        c.error = false;
        c.offset = 0;
        c.hasMore = true;
        c.loadingMoreError = false;
      });
      return [...cols];
    });

    this.boardColumns().forEach((column) => {
      this.projectService
        .getProjectTasksByStatus(
          this.projectId(),
          column.id,
          10,
          column.offset,
          this.searchControl.value || '',
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (tasks) => {
            this.boardColumns.update((cols) => {
              const target = cols.find((c) => c.id === column.id)!;
              target.tasks = tasks || [];
              if (tasks.length < 10) target.hasMore = false;
              target.isLoading = false;
              return [...cols];
            });
          },
          error: () => {
            this.boardColumns.update((cols) => {
              const target = cols.find((c) => c.id === column.id)!;
              target.error = true;
              target.isLoading = false;
              return [...cols];
            });
          },
        });
    });
  }

  onBoardColumnScroll(event: Event, colId: string): void {
    const col = this.boardColumns().find((c) => c.id === colId)!;
    if (col.isLoading || col.isFetchingMore || !col.hasMore || col.loadingMoreError) return;

    const target = event.target as HTMLElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;

    if (isNearBottom) {
      this.loadMoreTasksForColumn(col);
    }
  }

  loadMoreTasksForColumn(col: BoardColumn): void {
    this.boardColumns.update((cols) => {
      const target = cols.find((c) => c.id === col.id)!;
      target.isFetchingMore = true;
      target.loadingMoreError = false;
      target.offset! += 10;
      return [...cols];
    });

    const updatedCol = this.boardColumns().find((c) => c.id === col.id)!;

    this.projectService
      .getProjectTasksByStatus(
        this.projectId(),
        col.id,
        10,
        updatedCol.offset,
        this.searchControl.value || '',
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tasks) => {
          this.boardColumns.update((cols) => {
            const target = cols.find((c) => c.id === col.id)!;
            target.tasks = [...target.tasks, ...tasks];
            if (tasks.length < 10) target.hasMore = false;
            target.isFetchingMore = false;
            return [...cols];
          });
        },
        error: () => {
          this.boardColumns.update((cols) => {
            const target = cols.find((c) => c.id === col.id)!;
            target.loadingMoreError = true;
            target.isFetchingMore = false;
            target.offset! -= 10;
            return [...cols];
          });
        },
      });
  }

  drop(event: CdkDragDrop<ProjectTaskResponse[]>, newStatus: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const taskToMove = event.previousContainer.data[event.previousIndex];
      const previousStatus = taskToMove.status;

      // Drag update
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      taskToMove.status = newStatus;

      this.projectService.updateTask(taskToMove.id, { status: newStatus }).subscribe({
        next: () => {
          //   UI updated successfully
        },
        error: () => {
          transferArrayItem(
            event.container.data,
            event.previousContainer.data,
            event.currentIndex,
            event.previousIndex,
          );
          taskToMove.status = previousStatus;
          this.showToast('Failed to move task. Please check your connection.');
        },
      });
    }
  }

  private showToast(message: string): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastError.set(message);
    this.toastTimeout = setTimeout(() => this.toastError.set(null), 4000);
  }

  getTaskDateState(dateString: string | null | undefined): 'TODAY' | 'DELAYED' | 'NORMAL' {
    if (!dateString) return 'NORMAL';
    const due = new Date(dateString);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due.getTime() < today.getTime()) return 'DELAYED';
    if (due.getTime() === today.getTime()) return 'TODAY';
    return 'NORMAL';
  }

  getStatusBadge(status: string) {
    switch (status) {
      case 'TO_DO':
        return { bg: 'bg-[#E8EDF9]', text: 'text-[#0052CC]', label: 'TO DO' };
      case 'IN_PROGRESS':
        return { bg: 'bg-[#E8EDF9]', text: 'text-[#0052CC]', label: 'IN PROGRESS' };
      case 'BLOCKED':
        return { bg: 'bg-[#FFDAD6]', text: 'text-[#BA1A1A]', label: 'BLOCKED' };
      case 'IN_REVIEW':
        return { bg: 'bg-[#E8EDF9]', text: 'text-[#0052CC]', label: 'REVIEW' };
      case 'READY_FOR_QA':
        return { bg: 'bg-teal-100', text: 'text-teal-700', label: 'READY FOR QA' };
      case 'REOPENED':
        return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'REOPENED' };
      case 'READY_FOR_PRODUCTION':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'PRODUCTION' };
      case 'DONE':
        return { bg: 'bg-[#82F9BE]', text: 'text-[#004E32]', label: 'DONE' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
    }
  }

  getInitials(name: string | null | undefined): string {
    if (!name || !name.trim()) return 'N/A';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
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
