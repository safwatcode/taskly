import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../../../core/auth/services/auth';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLinkActive, RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  @Input() isMobileOpen = false;
  @Output() closeMobile = new EventEmitter<void>();

  private authService = inject(Auth);
  private router = inject(Router);

  isCollapsed = signal(false);
  logoutError = signal<string | null>(null);

  toggleCollapse() {
    this.isCollapsed.update((val) => !val);
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
