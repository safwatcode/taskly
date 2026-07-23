import { ChangeDetectorRef, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth/services/auth';
import { Button } from '../../../shared/components/button/button';
import { InputField } from '../../../shared/components/input/input';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  imports: [Button, ReactiveFormsModule, InputField, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword implements OnDestroy {
  forgotPasswordForm: FormGroup;
  isLoading = false;
  isSuccess = false;
  apiError: string | null = null;

  resendTimer = signal<number>(0);
  trials = 0;
  maxTrials = 3;

  private timeInterval: any = null;

  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get formControls() {
    return this.forgotPasswordForm.controls;
  }

  formattedTimer = computed(() => {
    const totalSeconds = this.resendTimer();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  executeRecovery(): void {
    if (this.trials >= this.maxTrials) return;

    this.isLoading = true;
    const email = this.forgotPasswordForm.value.email;

    this.authService.recoverPassword(email).subscribe({
      next: () => {
        this.handleSuccess();
      },
      error: (err) => {
        if (err.status === 400 || err.status === 404) {
          this.handleSuccess();
        } else {
          this.isLoading = false;
          this.apiError = 'A network error occurred. Please try again.';

          this.cdr.detectChanges();

          console.error('Password recovery failed', err);
        }
      },
    });
  }

  private handleSuccess(): void {
    this.isLoading = false;
    this.isSuccess = true;
    this.trials++;

    this.cdr.detectChanges();

    this.startTimer();

  }

  startTimer(): void {
    this.resendTimer.set(300);
    this.clearTimer();

    this.timeInterval = setInterval(() => {
      if (this.resendTimer() > 0) {
        this.resendTimer.update((val) => val - 1);
      } else {
        this.clearTimer();
      }
    }, 1000);
  }

  clearTimer(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  resendEmail(): void {
    if (this.resendTimer() === 0 && this.trials < this.maxTrials) {
      this.executeRecovery();
    }
  }

  onSubmit(): void {
    this.apiError = null;

    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.executeRecovery();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
