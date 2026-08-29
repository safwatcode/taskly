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

  currentView: 'board' | 'list' = 'board';
  // State custom View Switcher dropdown
  isViewDropdownOpen = false;

  // Tracking variables to prevent redundant API calls during resize
  private lastFetchedView: 'board' | 'list' | null = null;
  private lastFetchedProjectId: string | null = null;

  listTasks: ProjectTaskResponse[] = [];
  isListLoading = true;
  listError = false;

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
        // True if screen is < 768px
        const isMobile = breakpointState.matches;

        if (newProjectId && newProjectId !== this.projectId) {
          this.projectId = newProjectId;
          this.projectContext.setProjectId(this.projectId);
          this.fetchProjectName();
        }

        // Force 'list' view on mobile. If desktop, respect URL parameter.
        this.currentView = isMobile || viewParam === 'list' ? 'list' : 'board';

        if (this.projectId) {
          // Only trigger API calls if the project or view type actually changed
          if (
            this.lastFetchedProjectId !== this.projectId ||
            this.lastFetchedView !== this.currentView
          ) {
            if (this.currentView === 'list') {
              this.fetchListTasks();
            } else {
              this.loadAllColumnsIndependently();
            }

            this.lastFetchedProjectId = this.projectId;
            this.lastFetchedView = this.currentView;
          }
        }
      });
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

  private fetchListTasks(): void {
    this.isListLoading = true;
    this.listError = false;

    this.projectService
      .getAllProjectTasks(this.projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.listTasks = response.content;
          this.isListLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.listError = true;
          this.isListLoading = false;
          this.cdr.detectChanges();
        },
      });
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

      this.projectService
        .getProjectTasksByStatus(this.projectId, column.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (tasks) => {
            column.tasks = tasks || [];
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

  private showToast(message: string): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastError = message;
    this.cdr.detectChanges();
    this.toastTimeout = setTimeout(() => {
      this.toastError = null;
      this.cdr.detectChanges();
    }, 4000);
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
