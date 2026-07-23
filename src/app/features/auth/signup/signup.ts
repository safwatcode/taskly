import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { InputField } from '../../../shared/components/input/input';
import { Button } from '../../../shared/components/button/button';
import { Auth } from '../../../core/auth/services/auth';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../shared/validators/password.validator';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, CommonModule, InputField, Button, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  signupForm: FormGroup;
  isLoading = false;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(Auth);

  constructor() {
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

  onSubmit() {
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

    this.authService.signup(payload).subscribe({
      next: (response) => {
        this.isLoading = false;

        if (response.access_token) {
          this.authService.saveSession(response.access_token, false);
          this.router.navigate(['/project']);
        } else {
          // In case of email verification process
          console.warn(
            'Signup successful, but no token returned. Email verification may be required.',
          );
          this.router.navigate(['/login']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Signup failed', err);
      },
    });
  }
}
