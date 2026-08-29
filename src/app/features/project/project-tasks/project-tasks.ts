import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { BoardColumn, ProjectTaskResponse } from '../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { combineLatest } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TaskDetailsPopup } from './task-details-popup/task-details-popup';

@Component({
  selector: 'app-project-tasks',
  imports: [
    RouterLink,
    NgClass,
    DatePipe,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    NgTemplateOutlet,
    UpperCasePipe,
    CdkDragPreview,
    ReactiveFormsModule,
    TaskDetailsPopup,
  ],
  templateUrl: './project-tasks.html',
  styleUrl: './project-tasks.css',
  host: { class: 'flex flex-col flex-1 h-full overflow-hidden bg-slate-50' },
})
export class ProjectTasks implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private breakpointObserver = inject(BreakpointObserver);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  projectId = '';
  projectName = '';
  selectedTaskId: string | null = null;

  currentView: 'board' | 'list' = 'board';
  // State custom View Switcher dropdown
  isViewDropdownOpen = false;

  // Tracking variables to prevent redundant API calls during resize
  private lastFetchedView: 'board' | 'list' | null = null;
  private lastFetchedProjectId: string | null = null;

  listTasks: ProjectTaskResponse[] = [];
  isListLoading = true;
  listError = false;

  // For Pagination
  listCurrentPage = 1;
  listPageSize = 5;
  listTotalItems = 0;

  // Tracking mobile state & infinite scroll loading
  isMobileView = false;
  isListLoadingMore = false;
  listLoadingMoreError = false;

  // Search Control
  searchControl = new FormControl('');

  toastError: string | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  boardColumns: BoardColumn[] = [
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
      borderClass: 'border-none',
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
  ];

  get listTotalPages(): number {
    return Math.max(1, Math.ceil(this.listTotalItems / this.listPageSize));
  }

  ngOnInit(): void {
    this.fetchAll();
  }

  private fetchAll(): void {
    // Listen to URL params and screen size concurrently
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
      this.breakpointObserver.observe(['(max-width: 767px)']),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, qParams, breakpointState]) => {
        const newProjectId = params.get('projectId') || '';
        const viewParam = qParams.get('view');
        this.isMobileView = breakpointState.matches;

        if (newProjectId && newProjectId !== this.projectId) {
          this.projectId = newProjectId;
          this.projectContext.setProjectId(this.projectId);
          this.fetchProjectName();
          this.searchControl.setValue('', { emitEvent: false }); // Reset search on project switch
        }

        this.currentView = this.isMobileView || viewParam === 'list' ? 'list' : 'board';

        if (this.projectId) {
          if (
            this.lastFetchedProjectId !== this.projectId ||
            this.lastFetchedView !== this.currentView
          ) {
            this.executeActiveViewFetch();
            this.lastFetchedProjectId = this.projectId;
            this.lastFetchedView = this.currentView;
          }
        }
      });

    // Search Debounce Listener
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.executeActiveViewFetch();
      });
  }

  // Wrapper function to trigger fetches and reset limits/offsets
  private executeActiveViewFetch(): void {
    if (this.currentView === 'list') {
      this.listCurrentPage = 1;
      this.fetchListTasks();
    } else {
      this.loadAllColumnsIndependently();
    }
  }

  switchView(view: 'board' | 'list'): void {
    // Close dropdown on selection
    this.isViewDropdownOpen = false;

    // Don't navigate if they click the view they are already on
    if (this.currentView === view) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view },
      queryParamsHandling: 'merge',
    });
  }

  protected fetchListTasks(append = false): void {
    if (append) {
      this.isListLoadingMore = true;
      this.listLoadingMoreError = false;
    } else {
      // Providing full loader when changing page
      this.isListLoading = true;
    }
    this.listError = false;

    const limit = this.listPageSize;
    const offset = (this.listCurrentPage - 1) * limit;

    this.projectService
      .getAllProjectTasks(this.projectId, limit, offset, this.searchControl.value || '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (append) {
            this.listTasks = [...this.listTasks, ...response.content];
          } else {
            this.listTasks = response.content;
          }
          this.listTotalItems = response.totalElements;
          this.isListLoading = false;
          this.isListLoadingMore = false;
          this.cdr.detectChanges();
        },
        error: () => {
          if (append) {
            this.listLoadingMoreError = true;
            this.listCurrentPage--; // Rollback page if failure
          } else {
            this.listError = true;
          }
          this.isListLoading = false;
          this.isListLoadingMore = false;
          this.cdr.detectChanges();
        },
      });
  }

  onListScroll(event: Event): void {
    // Infinite scroll behavior on mobile screens
    if (!this.isMobileView || this.isListLoading || this.isListLoadingMore) return;

    const target = event.target as HTMLElement;

    // Check if the user has scrolled within 50px of the bottom
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;

    if (isNearBottom && this.listCurrentPage < this.listTotalPages) {
      this.listCurrentPage++;
      // Call with append = true
      this.fetchListTasks(true);
    }
  }

  private fetchProjectName(): void {
    this.projectService
      .getProjectById(this.projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((project) => {
        this.projectName = project.name;
        this.cdr.detectChanges();
      });
  }

  private loadAllColumnsIndependently(): void {
    this.boardColumns.forEach((column) => {
      column.isLoading = true;
      column.error = false;

      // Reset infinite scroll state per column
      column.offset = 0;
      column.hasMore = true;
      column.loadingMoreError = false;

      this.projectService
        .getProjectTasksByStatus(
          this.projectId,
          column.id,
          10,
          column.offset,
          this.searchControl.value || '',
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (tasks) => {
            column.tasks = tasks || [];
            if (tasks.length < 10) column.hasMore = false;
            column.isLoading = false;
            this.cdr.detectChanges();
          },
          error: () => {
            column.error = true;
            column.isLoading = false;
            this.cdr.detectChanges();
          },
        });
    });
  }

  onBoardColumnScroll(event: Event, col: BoardColumn): void {
    if (col.isLoading || col.isFetchingMore || !col.hasMore || col.loadingMoreError) return;

    const target = event.target as HTMLElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;

    if (isNearBottom) {
      this.loadMoreTasksForColumn(col);
    }
  }

  // Handle appending new tasks to specific columns via scroll
  loadMoreTasksForColumn(col: BoardColumn): void {
    col.isFetchingMore = true;
    col.loadingMoreError = false;
    col.offset! += 10;

    this.projectService
      .getProjectTasksByStatus(
        this.projectId,
        col.id,
        10,
        col.offset,
        this.searchControl.value || '',
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tasks) => {
          col.tasks = [...col.tasks, ...tasks];
          if (tasks.length < 10) col.hasMore = false;
          col.isFetchingMore = false;
          this.cdr.detectChanges();
        },
        error: () => {
          col.loadingMoreError = true;
          col.isFetchingMore = false;
          col.offset! -= 10; // Rollback offset
          this.cdr.detectChanges();
        },
      });
  }
  drop(event: CdkDragDrop<ProjectTaskResponse[]>, newStatus: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const taskToMove = event.previousContainer.data[event.previousIndex];
      const previousStatus = taskToMove.status;

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      taskToMove.status = newStatus;

      this.projectService.updateTask(taskToMove.id, { status: newStatus }).subscribe({
        next: () => {
          // Success! The UI is already updated.
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
          this.cdr.detectChanges();
        },
      });
    }
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

  openTaskDetails(taskId: string): void {
    this.selectedTaskId = taskId;
  }

  closeTaskDetails(): void {
    this.selectedTaskId = null;
  }

  // Pagination Control
  nextListPage(): void {
    if (this.listCurrentPage < this.listTotalPages) {
      this.listCurrentPage++;
      this.fetchListTasks();
    }
  }

  prevListPage(): void {
    if (this.listCurrentPage > 1) {
      this.listCurrentPage--;
      this.fetchListTasks();
    }
  }

  // UI Helpers
  private showToast(message: string): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastError = message;
    this.cdr.detectChanges();
    this.toastTimeout = setTimeout(() => {
      this.toastError = null;
      this.cdr.detectChanges();
    }, 4000);
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
