import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth/services/auth';
import { Router, RouterLink } from '@angular/router';
import { Button } from '../../../shared/components/button/button';
import { InputField } from '../../../shared/components/input/input';

@Component({
  selector: 'app-login',
  imports: [Button, InputField, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private router = inject(Router);

  constructor() {
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

    this.authService.login(payload).subscribe({
      next: (response) => {
        this.isLoading = false;

        const token = response.access_token || 'test_token';
        this.authService.saveSession(token, formValues.rememberMe);

        this.router.navigate(['/project']);
      },
      error: (err) => {
        this.isLoading = false;

        this.errorMessage = 'Invalid email or password';
        console.error('Login failed', err);
      },
    });
  }
}
