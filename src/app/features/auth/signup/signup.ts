import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { InputField } from '../../../shared/components/input/input';
import { Button } from '../../../shared/components/button/button';
import { Auth } from '../../../core/auth/services/auth';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../shared/validators/password.validator';
import { SignupResponse } from '../../../core/auth/models/signup.model';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, CommonModule, InputField, Button, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup implements OnInit {
  signupForm!: FormGroup<{
    name: FormControl<string | null>;
    email: FormControl<string | null>;
    jobTitle: FormControl<string | null>;
    password: FormControl<string | null>;
    confirmPassword: FormControl<string | null>;
  }>;

  isLoading = false;
  errorMessage: string | null = null;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(Auth);
  private cdr = inject(ChangeDetectorRef); // Injected for manual UI updates
  private destroyRef = inject(DestroyRef); // Injected to manage memory cleanup

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.signupForm = this.fb.group(
      {
        name: [
          '',
          [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(50),
            // Validates letters and spaces only
            Validators.pattern(/^\p{L}+(?: \p{L}+)*$/u),
          ],
        ],
        email: ['', [Validators.required, Validators.email]],
        jobTitle: [''],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(64),
            // Custom Validator function from shared module
            passwordStrengthValidator,
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator },
    );
  }

  get formControls() {
    return this.signupForm.controls;
  }

  onSubmit(): void {
    this.errorMessage = null;

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValues = this.signupForm.value;

    const payload = {
      email: formValues.email,
      password: formValues.password,
      data: {
        name: formValues.name,
        job_title: formValues.jobTitle || undefined,
      },
    };

    this.authService
      .signup(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isLoading = false;

          // Casting the 'unknown' response to sign up response interface
          const res = response as SignupResponse;

          if (res.access_token) {
            this.authService.saveSession(res.access_token, false);
            this.cdr.detectChanges();
            this.router.navigate(['/project']);
          } else {
            // In case of email verification process
            console.warn(
              'Signup successful, but no token returned. Email verification may be required.',
            );
            this.cdr.detectChanges();
            this.router.navigate(['/login']);
          }
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage =
            'Signup failed. The email might already be in use or the server is busy.';
          this.cdr.detectChanges();
        },
      });
  }
}
