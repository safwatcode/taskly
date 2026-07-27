import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
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
import { Button } from '../../../shared/components/button/button';
import { InputField } from '../../../shared/components/input/input';
import { LoginResponse } from '../../../core/auth/models/login.model';

@Component({
  selector: 'app-login',
  imports: [Button, InputField, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  loginForm!: FormGroup<{
    email: FormControl<string | null>;
    password: FormControl<string | null>;
    rememberMe: FormControl<boolean | null>;
  }>;

  errorMessage: string | null = null;
  isLoading = false;

  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.initLoginForm();
  }

  private initLoginForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false],
    });
  }

  get loginFormControls() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.errorMessage = null;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValues = this.loginForm.value;

    const payload = {
      email: formValues.email,
      password: formValues.password,
    };

    this.authService
      .login(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isLoading = false;

          // Casting the 'unknown' response to login response interface
          const res = response as LoginResponse;

          if (res.access_token) {
            this.authService.saveSession(res.access_token, formValues.rememberMe ?? false);
            this.cdr.detectChanges();
            this.router.navigate(['/project']);
          } else {
            this.errorMessage = 'Authentication failed: Invalid response from server.';
            this.cdr.detectChanges();
          }
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = 'Invalid email or password';
          this.cdr.detectChanges();
        },
      });
  }
}
