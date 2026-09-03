import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { ProjectContextService } from '../services/project-context.service';
import { Auth } from '../../../core/auth/services/auth';
import { ProjectEpicResponse } from '../models/project.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DatePipe, NgClass } from '@angular/common';
import { UserProfileResponse } from '../../../core/auth/models/user-profile.model';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { EpicDetailsPopup } from './epic-details-popup/epic-details-popup';

@Component({
  selector: 'app-project-epics',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink, FormsModule, Pagination, EpicDetailsPopup],
  templateUrl: './project-epics.html',
  styleUrl: './project-epics.css',
  host: {
    class: 'flex flex-col flex-1 h-full min-h-0',
  },
})
export class ProjectEpics implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  // Data States
  projectId = '';
  projectName = '';
  epics: ProjectEpicResponse[] = [];
  selectedEpicId: string | null = null;

  private nameDictionary = new Map<string, string>();

  activeUserName: string | null = null;
  activeUserEmail: string | null = null;

  // Search, Pagination & UI States
  isLoading = true;
  errorMessage: string | null = null;

  searchTerm = '';
  searchSubject = new Subject<string>();

  // Pagination State
  currentPage = 1;
  pageSize = 6;
  totalEpics = 0;

  ngOnInit(): void {
    this.initializeSearch();
    this.initializeContext();
    this.initializeDeepLinking();
  }

  // Setup Search Debounce
  private initializeSearch(): void {
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchTerm = term;
        this.currentPage = 1; // Reset to page 1 on a new search
        this.fetchEpicsOnly();
      });
  }

  // Initial Load (Fires once to get Project Name, User Profile, and Harvest Members)
  private initializeContext(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('projectId');

      if (id) {
        this.projectId = id;
        setTimeout(() => this.projectContext.setProjectId(this.projectId), 0);

        this.isLoading = true;

        forkJoin({
          project: this.projectService.getProjectById(this.projectId),
          userProfile: this.authService.getUserProfile().pipe(catchError(() => of(null))),
          // BACKGROUND HARVEST: Fetch members silently to build our Name Dictionary
          members: this.projectService
            .getProjectMembers(this.projectId)
            .pipe(catchError(() => of([]))),
        })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (data) => {
              this.projectName = data.project.name;

              // Harvest Active User Profile
              if (data.userProfile) {
                const res = data.userProfile as UserProfileResponse;
                this.activeUserName = res.user_metadata?.name || null;
                this.activeUserEmail = res.email || res.user_metadata?.email || null;

                if (this.activeUserEmail && this.activeUserName) {
                  this.nameDictionary.set(this.activeUserEmail.toLowerCase(), this.activeUserName);
                }
              }

              // Harvest Project Members
              data.members.forEach((m) => {
                if (m.email && m.name) {
                  this.nameDictionary.set(m.email.toLowerCase(), m.name);
                }
              });

              // After context and dictionary are loaded, fetch the epics
              this.fetchEpicsOnly();
            },
            error: () => {
              this.errorMessage = 'Failed to load project details.';
              this.isLoading = false;
              this.cdr.detectChanges();
            },
          });
      } else {
        this.isLoading = false;
        this.errorMessage = 'Project not found.';
        this.cdr.detectChanges();
      }
    });
  }

  // Fetch Epics (Fires on load, on search, and on page change)
  protected fetchEpicsOnly(silent = false): void {
    this.errorMessage = null;

    if (!silent) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }

    const offset = (this.currentPage - 1) * this.pageSize;

    this.projectService
      .getProjectEpics(this.projectId, this.searchTerm, this.pageSize, offset)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (paginatedData) => {
          this.totalEpics = paginatedData.totalElements;

          this.epics = paginatedData.content.map((epic) => {
            const updatedEpic = { ...epic };

            // Apply Dictionary Injection to Assignee
            if (
              updatedEpic.assignee &&
              (!updatedEpic.assignee.name || !updatedEpic.assignee.name.trim()) &&
              updatedEpic.assignee.email
            ) {
              const dictName = this.nameDictionary.get(updatedEpic.assignee.email.toLowerCase());
              if (dictName) updatedEpic.assignee.name = dictName;
            }

            // Apply Dictionary Injection to Creator
            if (
              updatedEpic.created_by &&
              (!updatedEpic.created_by.name || !updatedEpic.created_by.name.trim()) &&
              updatedEpic.created_by.email
            ) {
              const dictName = this.nameDictionary.get(updatedEpic.created_by.email.toLowerCase());
              if (dictName) updatedEpic.created_by.name = dictName;
            }

            return updatedEpic;
          });

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMessage = 'Failed to search epics';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  // Listen the URL for deep links (for copy link feature)
  private initializeDeepLinking(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const epicIdFromUrl = params.get('epic');

      if (epicIdFromUrl) {
        // If the URL has ?epic=..., automatically open the popup
        this.selectedEpicId = epicIdFromUrl;
      } else {
        // If the URL doesn't have it, ensure the popup is closed
        this.selectedEpicId = null;
      }
    });
  }
  // Triggered by the search input element
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  // Triggered by the pagination component
  onPageChange(page: number): void {
    this.currentPage = page;
    // Fetch the new page data
    this.fetchEpicsOnly();
  }

  // Epic popup
  openEpicDetails(id: string): void {
    this.selectedEpicId = id;
  }

  closeEpicDetails(): void {
    this.selectedEpicId = null;

    // Clean up the URL by navigating to the current route but dropping the query params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { epic: null },
      queryParamsHandling: 'merge',
    });
  }

  retryConnection(): void {
    if (this.projectId) {
      this.isLoading = true;
      this.initializeContext();
    }
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
