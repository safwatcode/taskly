import { Component, DestroyRef, EventEmitter, inject, OnInit, Output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '../../../../core/auth/services/auth';
import { Router } from '@angular/router';
import { UserProfileResponse } from '../../../../core/auth/models/user-profile.model';

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
  private destroyRef = inject(DestroyRef);

  userName = signal<string>('Loading...');
  jobTitle = signal<string>('');
  avatarText = signal<string>('--');

  // Logout Handling
  isDropDownOpen = signal<boolean>(false);
  logoutError = signal<string | null>(null);

  ngOnInit(): void {
    this.fetchUserProfile();
  }

  private fetchUserProfile(): void {
    this.authService
      .getUserProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: unknown) => {
          const res = response as UserProfileResponse;

          const metadata = res.user_metadata || {};
          const name = metadata.name || 'Unknown User';
          const jobTitle = metadata.job_title || 'Member';
          const avatarText = this.generateAvatarText(name);

          this.userName.set(name);
          this.jobTitle.set(jobTitle);
          this.avatarText.set(avatarText);
        },
        error: (err) => {
          console.error('Failed to load user profile', err);
          // Replace the user profile name and avatar if the network request fails
          this.userName.set('Failed to get user profile');
          this.avatarText.set('??');
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

  toggleDropdown(): void {
    this.isDropDownOpen.update((val) => !val);
  }

  onLogout(): void {
    this.logoutError.set(null);

    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef)) // Kills the request if the component unmounts early
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (err) => {
          console.error('Logout failed', err);
          this.logoutError.set('Logout failed, please try again.');
        },
      });
  }
}
