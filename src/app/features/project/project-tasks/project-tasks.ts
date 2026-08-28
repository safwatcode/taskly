import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { BoardColumn, ProjectTaskResponse } from '../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass } from '@angular/common';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
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
  ],
  templateUrl: './project-tasks.html',
  styleUrl: './project-tasks.css',
  host: { class: 'flex flex-col flex-1 h-full overflow-hidden bg-slate-50' },
})
export class ProjectTasks implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  projectId = '';
  projectName = '';

  // Toast State for Drag & Drop Errors
  toastError: string | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  boardColumns: BoardColumn[] = [
    {
      id: 'TO_DO',
      label: 'TO DO',
      dotClass: 'bg-slate-400',
      borderClass: 'border-none',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'IN_PROGRESS',
      label: 'IN PROGRESS',
      dotClass: 'bg-[#0052CC]',
      borderClass: 'border-l-[#0052CC]',
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
      borderClass: 'border-l-purple-500',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'READY_FOR_QA',
      label: 'READY FOR QA',
      dotClass: 'bg-teal-500',
      borderClass: 'border-l-teal-500',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'REOPENED',
      label: 'REOPENED',
      dotClass: 'bg-orange-500',
      borderClass: 'border-l-orange-500',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'READY_FOR_PRODUCTION',
      label: 'READY FOR PRODUCTION',
      dotClass: 'bg-blue-400',
      borderClass: 'border-l-blue-400',
      bgClass: 'bg-white',
      tasks: [],
      isLoading: true,
      error: false,
    },
    {
      id: 'DONE',
      label: 'DONE',
      dotClass: 'bg-emerald-500',
      borderClass: 'border-l-emerald-500 opacity-70',
      bgClass: 'bg-slate-50',
      tasks: [],
      isLoading: true,
      error: false,
    },
  ];

  ngOnInit(): void {
    this.fetchProjectTasks();
  }

  private fetchProjectTasks(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.projectId = params.get('projectId') || '';
      if (this.projectId) {
        this.projectContext.setProjectId(this.projectId);
        this.fetchProjectName();
        this.loadAllColumnsIndependently();
      }
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

  // Handle Drag and Drop
  drop(event: CdkDragDrop<ProjectTaskResponse[]>, newStatus: string): void {
    // If dropped in the same column, just reorder the array visually
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // If dropped in a different column
      const taskToMove = event.previousContainer.data[event.previousIndex];
      const previousStatus = taskToMove.status;

      // Optimistic UI Update: Move it instantly
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      taskToMove.status = newStatus;

      // API Call to persist the change
      this.projectService.updateTask(taskToMove.id, { status: newStatus }).subscribe({
        next: () => {
          // Success! The UI is already updated.
        },
        error: () => {
          // Rollback UI if API fails
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

  // Toast Helper
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
