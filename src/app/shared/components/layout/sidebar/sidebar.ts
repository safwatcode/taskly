import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../../../core/auth/services/auth';
import { ProjectContextService } from '../../../../features/project/services/project-context.service'; // Adjust path

@Component({
  selector: 'app-sidebar',
  imports: [RouterLinkActive, RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  @Input() isMobileOpen = false;
  @Output() closeMobile = new EventEmitter<void>();

  private authService = inject(Auth);
  private router = inject(Router);
  private projectContext = inject(ProjectContextService);
  private destroyRef = inject(DestroyRef);

  projectId = this.projectContext.activeProjectId;

  isCollapsed = signal<boolean>(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('sidebarCollapsed') === 'true'
      : false,
  );

  // To prevent animations on page load
  enableTransition = signal<boolean>(false);
  logoutError = signal<string | null>(null);

  ngOnInit(): void {
    this.initializeTransition();
  }

  private initializeTransition(): void {
    // Delay adding transition classes when collapsing the sidebar for better UX
    const timeoutId = setTimeout(() => {
      this.enableTransition.set(true);
    }, 50);

    // Prevents the timeout from attempting to update a signal if the component is destroyed early
    this.destroyRef.onDestroy(() => clearTimeout(timeoutId));
  }

  toggleCollapse(): void {
    this.isCollapsed.update((val) => {
      const newState = !val;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sidebarCollapsed', String(newState));
      }
      return newState;
    });
  }

  onLogout(): void {
    this.logoutError.set(null);

    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.authService.clearSession();
          this.router.navigate(['/login']);
        },
        error: (err) => {
          console.error('Logout failed', err);
          this.logoutError.set('Logout failed, please try again.');
        },
      });
  }
}
