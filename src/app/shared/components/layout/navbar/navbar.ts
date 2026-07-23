import { Component, EventEmitter, inject, OnInit, Output, signal } from '@angular/core';
import { Auth } from '../../../../core/auth/services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  @Output() toggleMobileMenu = new EventEmitter<void>();

  private authService = inject(Auth);
  private router = inject(Router);

  // Get user data
  userName = signal<string>('Loading...');
  jobTitle = signal<string>('');
  avatarText = signal<string>('--');

  // Logout Handling
  isDropDownOpen = signal<boolean>(false);
  logoutError = signal<string | null>(null);

  ngOnInit() {
    this.authService.getUserProfile().subscribe({
      next: (response) => {
        const metadata = response.user_metadata || {};
        const name = metadata.name || 'Unknown User';
        const jobTitle = metadata.job_title || 'Member';
        const avatarText = this.generateAvatarText(name);

        this.userName.set(name);
        this.jobTitle.set(jobTitle);
        this.avatarText.set(avatarText);
      },
      error: (err) => {
        console.error('Failed to load user profile', err);
      },
    });
  }

  private generateAvatarText(name: string): string {
    if (!name || !name.trim()) return '??';

    const words = name.trim().split(/\s+/);

    if (words.length > 1) {
      const firstInitial = words[0].charAt(0);
      const lastInitial = words[1].charAt(0);
      return (firstInitial + lastInitial).toUpperCase();
    }

    return words[0].slice(0, 2).toUpperCase();
  }

  toggleDropdown() {
    this.isDropDownOpen.update((val) => !val);
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
