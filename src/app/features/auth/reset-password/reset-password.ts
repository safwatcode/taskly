import {
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth/services/auth';
import { Router, RouterLink } from '@angular/router';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../shared/validators/password.validator';
import { InputField } from '../../../shared/components/input/input';
import { Button } from '../../../shared/components/button/button';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, InputField, Button, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword implements OnInit {
  resetPasswordForm: FormGroup;
  isLoading = false;
  isSuccess = false;
  successMessage = '';
  apiError: string | null = null;
  accessToken: string | null = null;

  // Signal for tracking input
  passwordValue = signal<string>('');

  // Computed signals driving the UI security checklist
  hasLength = computed(() => this.passwordValue().length >= 8 && this.passwordValue().length <= 64);
  hasUpper = computed(() => /[A-Z]/.test(this.passwordValue()));
  hasLower = computed(() => /[a-z]/.test(this.passwordValue()));
  hasDigit = computed(() => /[0-9]/.test(this.passwordValue()));
  hasSpecial = computed(() => /[!@#$%^&*()_+{}[\]:;<>,.?~\\/-]/.test(this.passwordValue()));

  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.resetPasswordForm = this.fb.group(
      {
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(64),
            passwordStrengthValidator,
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator },
    );

    // Track password changes and clean up subscription on destroy
    this.resetPasswordForm
      .get('password')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        this.passwordValue.set(val || '');
      });
  }

  get resetPasswordFormControls() {
    return this.resetPasswordForm.controls;
  }

  ngOnInit(): void {
    this.extractTokenFromURL();
  }

  private extractTokenFromURL(): void {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const type = params.get('type');
    const token = params.get('access_token');

    if (type === 'recovery' && token) {
      this.accessToken = token;
    } else {
      this.apiError = 'Invalid or expired reset link';
      this.cdr.detectChanges();
    }
  }

  onSubmit(): void {
    this.apiError = null;

    if (this.resetPasswordForm.invalid || !this.accessToken) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const newPassword = this.resetPasswordForm.value.password;

    this.authService.updateUserPassword(newPassword, this.accessToken).subscribe({
      next: () => {
        this.isLoading = false;
        this.isSuccess = true;
        this.successMessage = 'Your password has been updated successfully. You can now log in.';
        this.cdr.detectChanges();

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.apiError = 'Failed to update password. Your link may have expired.';
        this.cdr.detectChanges();
        console.error('Password reset failed', err);
      },
    });
  }
}
