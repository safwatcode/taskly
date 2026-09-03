import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { Auth } from '../../../../core/auth/services/auth';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-accept-invitation',
  imports: [],
  templateUrl: './accept-invitation.html',
  styleUrl: './accept-invitation.css',
})
export class AcceptInvitation implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  token: string | null = null;
  isCheckingAuth = true;
  isAccepting = false;
  isSuccess = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.invitationProcess();
  }

  private invitationProcess(): void {
    // Extract token from query parameters
    this.token = this.route.snapshot.queryParamMap.get('token');

    // Manually build the return URL. Do NOT rely on this.router.url during ngOnInit
    const safeReturnUrl = `/invite?token=${this.token}`;

    if (!this.token) {
      this.isCheckingAuth = false;
      this.errorMessage = 'Invalid invitation link. No token provided.';
      this.cdr.detectChanges();
      return;
    }

    // Local check if the email has an active session or not.
    const localToken = this.authService.getToken();
    if (!localToken) {
      // Pass the safeReturnUrl to guarantee the login page brings them back here
      this.router.navigate(['/login'], { queryParams: { returnUrl: safeReturnUrl } });
      return;
    }

    // Check if user is fully authenticated on the backend
    this.authService
      .getUserProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          if (!user) {
            this.router.navigate(['/login'], { queryParams: { returnUrl: safeReturnUrl } });
          } else {
            // Only authenticated users can accept invitations
            this.isCheckingAuth = false;

            // Force the UI to repaint and reveal the "Accept Invitation" button!
            this.cdr.detectChanges();
          }
        },
        error: () => {
          this.router.navigate(['/login'], { queryParams: { returnUrl: safeReturnUrl } });
        },
      });
  }

  acceptInvite(): void {
    if (!this.token) return;

    this.isAccepting = true;
    this.errorMessage = null;
    this.cdr.detectChanges(); // Update UI to show the loading spinner

    // Call the API
    this.projectService
      .acceptInvitation(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isAccepting = false;
          this.isSuccess = true;
          this.cdr.detectChanges(); // Update UI to show the green success checkmark

          // Redirect user to the project dashboard
          setTimeout(() => this.goToDashboard(), 2000);
        },
        error: (err) => {
          this.isAccepting = false;
          // Error messages are displayed for all failure cases
          this.errorMessage =
            err.error?.message ||
            err.message ||
            'Failed to accept invitation. The link may have expired.';
          this.cdr.detectChanges(); // Update UI to show the red error box
        },
      });
  }

  goToDashboard(): void {
    this.router.navigate(['/project']);
  }
}
