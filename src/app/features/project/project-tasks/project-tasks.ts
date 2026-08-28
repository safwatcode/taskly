import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { BoardColumn } from '../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-project-tasks',
  imports: [RouterLink, NgClass, DatePipe],
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

  // Defined the columns
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
      bgClass: 'bg-[#FFDAD633]',
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

  // Each column should independently fetch its related tasks
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

  // Date Formatting (TODAY, DELAYED, or Normal)
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

  // UI Helpers
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
