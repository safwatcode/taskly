import { Component, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatePipe, NgClass } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

import { ProjectService } from '../project/services/project.service';
import {
  DailyStat,
  ProjectResponse,
  ProjectTaskCountResponse,
} from '../project/models/project.model';

@Component({
  selector: 'app-my-statistics',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, BaseChartDirective, NgClass],
  templateUrl: './my-statistics.html',
  styleUrl: './my-statistics.css',
  host: { class: 'flex flex-col flex-1 h-full overflow-hidden bg-slate-50 relative' },
})
export class MyStatistics implements OnInit {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private destroyRef = inject(DestroyRef);

  filterForm!: FormGroup;

  // UI Toggles
  isDateDropdownOpen = signal(false);
  isProjectDropdownOpen = signal(false);
  isStatusDropdownOpen = signal(false);
  currentViewDate = signal<Date>(new Date());
  tempStartDate = signal<Date | null>(null);
  tempEndDate = signal<Date | null>(null);
  dateRangeError = signal<boolean>(false);
  weekDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  // Data Signals
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  projectsList = signal<ProjectResponse[]>([]);

  totalTasks = signal<number>(0);
  completedTasks = signal<number>(0);
  overdueTasks = signal<number>(0);

  calendarData = signal<DailyStat[]>([]);
  projectsCount = signal<ProjectTaskCountResponse[]>([]);
  chartTotals = signal<Record<string, number>>({});
  chartLegend = signal<{ label: string; value: number; color: string; percentage: number }[]>([]);

  //  We store the final calendar days in a Signal
  processedCalendarDays = signal<
    {
      dateString: string;
      date: Date;
      stats: { key: string; value: number }[];
      isEmpty: boolean;
      isToday: boolean;
    }[]
  >([]);

  availableStatuses = [
    'TO_DO',
    'IN_PROGRESS',
    'BLOCKED',
    'IN_REVIEW',
    'READY_FOR_QA',
    'REOPENED',
    'READY_FOR_PRODUCTION',
    'DONE',
  ];

  // Chart.js Configuration
  public doughnutChartType: ChartType = 'doughnut';
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [] }],
  };
  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
  };

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      this.isDateDropdownOpen.set(false);
      this.isProjectDropdownOpen.set(false);
      this.isStatusDropdownOpen.set(false);
    }
  }

  ngOnInit(): void {
    this.initForm();
    this.fetchProjectsForDropdown();
    this.loadStatistics();
  }

  private initForm(): void {
    const today = new Date();
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(today.getDate() - 6);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    this.filterForm = this.fb.group(
      {
        startDate: [formatDate(sixDaysAgo)],
        endDate: [formatDate(today)],
        projectId: [null],
        status: [null],
      },
      { validators: this.maxDateRangeValidator(7) },
    );
  }

  private maxDateRangeValidator(maxDays: number) {
    return (group: AbstractControl): ValidationErrors | null => {
      const start = group.get('startDate')?.value;
      const end = group.get('endDate')?.value;

      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > maxDays) {
          return { rangeExceeded: true };
        }
      }
      return null;
    };
  }

  private fetchProjectsForDropdown(): void {
    this.projectService
      .getProjects(100, 0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.projectsList.set(res.content);
      });
  }

  applyFilters(): void {
    if (this.filterForm.valid) {
      this.isDateDropdownOpen.set(false);
      this.isProjectDropdownOpen.set(false);
      this.isStatusDropdownOpen.set(false);
      this.loadStatistics();
    } else {
      this.filterForm.markAllAsTouched();
    }
  }

  setFilter(type: 'project' | 'status', value: string | null): void {
    if (type === 'project') this.filterForm.patchValue({ projectId: value });
    if (type === 'status') this.filterForm.patchValue({ status: value });
    this.applyFilters();
  }

  loadStatistics(): void {
    if (this.filterForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formVals = this.filterForm.value;
    const calendarPayload = {
      p_start_date: formVals.startDate,
      p_end_date: formVals.endDate,
      p_project_id: formVals.projectId || null,
      p_status: formVals.status || null,
    };
    const projectPayload = {
      p_start_date: formVals.startDate,
      p_end_date: formVals.endDate,
    };

    forkJoin({
      calendarStats: this.projectService.getTasksCalendarStats(calendarPayload),
      projectCounts: this.projectService.getTasksCountPerProject(projectPayload),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.totalTasks.set(data.calendarStats.total_tasks || 0);
          this.completedTasks.set(data.calendarStats.done_tasks || 0);
          this.overdueTasks.set(data.calendarStats.overdue_tasks || 0);

          this.calendarData.set(data.calendarStats.daily || []);
          this.projectsCount.set(data.projectCounts || []);
          this.chartTotals.set(data.calendarStats.totals || {});

          this.updateChartData(data.calendarStats.totals || {});

          // Generate the UI calendar grid once per load
          this.generateCalendarDays();

          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('We encountered an error loading your statistics.');
          this.isLoading.set(false);
        },
      });
  }
  toggleDatePicker() {
    if (this.isDateDropdownOpen()) {
      this.isDateDropdownOpen.set(false);
    } else {
      const startStr = this.filterForm.value.startDate;
      const endStr = this.filterForm.value.endDate;

      const parseDate = (dStr: string) => {
        if (!dStr) return new Date();
        const [y, m, d] = dStr.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d));
      };

      const startDate = parseDate(startStr);
      this.tempStartDate.set(startDate);
      this.tempEndDate.set(parseDate(endStr));
      // Set view to the month of the currently selected start date
      this.currentViewDate.set(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
      this.dateRangeError.set(false);
      this.isDateDropdownOpen.set(true);
    }
  }

  nextMonth() {
    const current = this.currentViewDate();
    this.currentViewDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  prevMonth() {
    const current = this.currentViewDate();
    this.currentViewDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  get calendarDays() {
    const year = this.currentViewDate().getFullYear();
    const month = this.currentViewDate().getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Adjust for Monday start: 0 = Mon, 1 = Tue, ..., 6 = Sun
    let firstDayIndex = firstDayOfMonth.getDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6;

    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    // Next month padding to fill grid
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }

  onDateClick(day: { date: Date; isCurrentMonth: boolean }) {
    if (!day.isCurrentMonth) return;

    const clickedDate = day.date;

    if (!this.tempStartDate() || (this.tempStartDate() && this.tempEndDate())) {
      // Start a new range selection
      this.tempStartDate.set(clickedDate);
      this.tempEndDate.set(null);
      this.dateRangeError.set(false);
    } else if (this.tempStartDate() && !this.tempEndDate()) {
      // Complete the range selection
      if (clickedDate.getTime() < this.tempStartDate()!.getTime()) {
        this.tempEndDate.set(this.tempStartDate());
        this.tempStartDate.set(clickedDate);
      } else {
        this.tempEndDate.set(clickedDate);
      }

      // Check max 7 days constraint
      const diffTime = Math.abs(this.tempEndDate()!.getTime() - this.tempStartDate()!.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      this.dateRangeError.set(diffDays > 7);
    }
  }

  getDayClasses(day: { date: Date; isCurrentMonth: boolean }): string {
    let classes = 'w-full h-9 flex items-center justify-center text-[13px] transition-colors ';

    if (!day.isCurrentMonth) {
      classes += 'text-slate-300 opacity-50 ';
      return classes;
    }

    classes += 'cursor-pointer ';

    const time = day.date.getTime();
    const start = this.tempStartDate()?.getTime();
    const end = this.tempEndDate()?.getTime();
    const dayOfWeek = day.date.getDay();

    const isStart = start === time;
    const isEnd = end === time;
    const inRange = start && end && time > start && time < end;

    // Color highlights
    if (isStart || isEnd || inRange) {
      classes += 'bg-[#D0E1F9] text-[#0052CC] font-bold ';
    } else {
      classes += 'text-[#041B3C] hover:bg-slate-100 font-medium ';
    }

    // Apply smart border radius (curves the edges properly even when spanning lines)
    if (isStart && (!end || start === end)) {
      classes += 'rounded-md ';
    } else if (isStart) {
      classes += 'rounded-l-md ';
      if (dayOfWeek === 0) classes += 'rounded-r-md '; // Rounds edge if start is on a Sunday
    } else if (isEnd) {
      classes += 'rounded-r-md ';
      if (dayOfWeek === 1) classes += 'rounded-l-md '; // Rounds edge if end is on a Monday
    } else if (inRange) {
      if (dayOfWeek === 1) classes += 'rounded-l-md ';
      if (dayOfWeek === 0) classes += 'rounded-r-md ';
    } else {
      classes += 'rounded-md ';
    }

    return classes;
  }

  applyCustomRange() {
    if (!this.tempStartDate() || !this.tempEndDate() || this.dateRangeError()) {
      return;
    }

    const format = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    this.filterForm.patchValue({
      startDate: format(this.tempStartDate()!),
      endDate: format(this.tempEndDate()!),
    });
    this.isDateDropdownOpen.set(false);
    this.loadStatistics();
  }

  private generateCalendarDays(): void {
    const start = new Date(this.filterForm.value.startDate);
    const end = new Date(this.filterForm.value.endDate);
    const days = [];
    const rawData = this.calendarData();
    const today = new Date();

    const current = new Date(start);
    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];
      const match = rawData.find((d) => d.day === dateString);

      const statsArray: { key: string; value: number }[] = [];
      if (match && match.statuses) {
        Object.entries(match.statuses).forEach(([key, value]) => {
          statsArray.push({ key, value });
        });
      }

      // Pre-calculate isToday to avoid method calls in template
      const isToday =
        current.getDate() === today.getDate() &&
        current.getMonth() === today.getMonth() &&
        current.getFullYear() === today.getFullYear();

      days.push({
        dateString, // We track by this safe string
        date: new Date(current),
        stats: statsArray,
        isEmpty: statsArray.length === 0,
        isToday,
      });

      current.setDate(current.getDate() + 1);
    }

    // Sort the days from Sunday (0) to Saturday (6)
    days.sort((a, b) => a.date.getDay() - b.date.getDay());

    this.processedCalendarDays.set(days);
  }

  // Quick Shift Arrows (Next/Prev Week)
  shiftDateRange(direction: -1 | 1, event: Event): void {
    event.stopPropagation(); // Prevent the click from affecting other elements

    // Auto-close the calendar popup if it happens to be open
    this.isDateDropdownOpen.set(false);

    const currentStartStr = this.filterForm.value.startDate;
    const currentEndStr = this.filterForm.value.endDate;

    if (!currentStartStr || !currentEndStr) return;

    const startDate = new Date(currentStartStr);
    const endDate = new Date(currentEndStr);

    // Calculate the duration of the current range (e.g., 7 days)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // We add 1 to the difference to shift by the full block length
    const shiftAmount = diffDays + 1;

    // Shift both dates backward or forward
    startDate.setDate(startDate.getDate() + direction * shiftAmount);
    endDate.setDate(endDate.getDate() + direction * shiftAmount);

    // Formatter helper
    const format = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Update the form values with the new shifted dates
    this.filterForm.patchValue({
      startDate: format(startDate),
      endDate: format(endDate),
    });

    // Automatically fetch the new dashboard data
    this.loadStatistics();
  }

  private updateChartData(totals: Record<string, number>): void {
    const labels: string[] = [];
    const data: number[] = [];
    const colors: string[] = [];
    const legendItems: { label: string; value: number; color: string; percentage: number }[] = [];

    // Calculate the total number of tasks in the chart to figure out percentages
    const chartTotal = Object.values(totals).reduce((sum, count) => sum + count, 0);

    Object.entries(totals).forEach(([status, count]) => {
      if (count > 0) {
        const labelText = this.formatStatus(status);
        const hexColor = this.getStatusColor(status).hex;

        // Calculate how full the progress bar should be
        const percentage = chartTotal > 0 ? (count / chartTotal) * 100 : 0;

        labels.push(labelText);
        data.push(count);
        colors.push(hexColor);
        legendItems.push({ label: labelText, value: count, color: hexColor, percentage });
      }
    });

    if (data.length === 0) {
      labels.push('No Tasks');
      data.push(1);
      colors.push('#F1F5F9');
      legendItems.push({ label: 'No Tasks', value: 0, color: '#F1F5F9', percentage: 0 });
    }

    this.doughnutChartData = {
      labels,
      datasets: [{ data, backgroundColor: colors, hoverOffset: 4, borderWidth: 0 }],
    };

    this.chartLegend.set(legendItems);
  }

  // UI Helpers
  formatStatus(status: string | number): string {
    return String(status)
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getStatusColor(status: string | number): { bg: string; text: string; hex: string } {
    switch (String(status)) {
      case 'IN_PROGRESS':
        return { bg: 'bg-[#E8EDF9]', text: 'text-[#0052CC]', hex: '#0052CC' };
      case 'DONE':
        return { bg: 'bg-[#82F9BE]', text: 'text-[#004E32]', hex: '#10B981' };
      case 'BLOCKED':
        return { bg: 'bg-[#FFDAD6]', text: 'text-[#BA1A1A]', hex: '#E11D48' };
      case 'TO_DO':
        return { bg: 'bg-slate-100', text: 'text-slate-600', hex: '#64748B' };
      case 'IN_REVIEW':
        return { bg: 'bg-purple-100', text: 'text-purple-700', hex: '#A855F7' };
      case 'READY_FOR_QA':
        return { bg: 'bg-teal-100', text: 'text-teal-700', hex: '#14B8A6' };
      case 'READY_FOR_PRODUCTION':
        return { bg: 'bg-blue-100', text: 'text-blue-700', hex: '#3B82F6' };
      case 'REOPENED':
        return { bg: 'bg-orange-100', text: 'text-orange-700', hex: '#F97316' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-600', hex: '#94A3B8' };
    }
  }

  getSelectedProjectName(): string {
    const id = this.filterForm.value.projectId;
    if (!id) return 'All Projects';
    const proj = this.projectsList().find((p) => p.id === id);
    return proj ? proj.name : 'All Projects';
  }
}
