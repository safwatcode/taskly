import { Component, EventEmitter, inject, Input, Output, signal, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../../../core/auth/services/auth';

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

  isCollapsed = signal<boolean>(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('sidebarCollapsed') === 'true'
      : false,
  );

  // Prevent animations on page load
  enableTransition = signal<boolean>(false);
  logoutError = signal<string | null>(null);

  ngOnInit() {
    // Delay adding transition classes
    setTimeout(() => {
      this.enableTransition.set(true);
    }, 50);
  }

  toggleCollapse() {
    this.isCollapsed.update((val) => {
      const newState = !val;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sidebarCollapsed', String(newState));
      }
      return newState;
    });
  }

  onLogout() {
    this.logoutError.set(null);

    this.authService.logout().subscribe({
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
