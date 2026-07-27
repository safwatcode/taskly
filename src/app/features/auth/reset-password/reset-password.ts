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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
  resetPasswordForm!: FormGroup<{
    password: FormControl<string | null>;
    confirmPassword: FormControl<string | null>;
  }>;

  isLoading = false;
  isSuccess = false;
  successMessage = '';
  apiError: string | null = null;
  accessToken: string | null = null;

  passwordValue = signal<string>('');

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

  ngOnInit(): void {
    this.initForm();
    this.extractTokenFromURL();
  }

  private initForm(): void {
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

    // Track password changes
    this.resetPasswordForm.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        this.passwordValue.set(val || '');
      });
  }

  get resetPasswordFormControls() {
    return this.resetPasswordForm.controls;
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

    const newPassword = this.resetPasswordForm.value.password || '';

    this.authService
      .updateUserPassword(newPassword, this.accessToken)
      .pipe(takeUntilDestroyed(this.destroyRef)) // Protects the HTTP request
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.isSuccess = true;
          this.successMessage = 'Your password has been updated successfully. You can now log in.';
          this.cdr.detectChanges();

          // Store the timeout reference
          const timeoutId = setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);

          // Protects the timeout event
          this.destroyRef.onDestroy(() => clearTimeout(timeoutId));
        },
        error: () => {
          this.isLoading = false;
          this.apiError = 'Failed to update password. Your link may have expired.';
          this.cdr.detectChanges();
        },
      });
  }
}
