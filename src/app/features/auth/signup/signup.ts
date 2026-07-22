import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { InputField } from '../../../shared/components/input/input';
import { Button } from '../../../shared/components/button/button';
import { Auth } from '../../../core/auth/services/auth';

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
            // Custom Validator function
            this.passwordStrengthValidator,
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value || '';
    if (!value) return null;

    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*()_+{}[\]:;<>,.?~\\/-]/.test(value);
    const noWhiteSpace = /^\S+$/.test(value);

    const errors: any = {};
    if (!hasUpper || !hasLower || !hasDigit) errors.missingUpperLowerDigit = true;
    if (!hasSpecial) errors.missingSpecial = true;
    if (!noWhiteSpace) errors.hasWhiteSpace = true;

    return Object.keys(errors).length > 0 ? errors : null;
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    const confirmCtrl = control.get('confirmPassword');

    if (password && confirmPassword && password !== confirmPassword) {
      confirmCtrl?.setErrors({ mismatch: true });
      return { mismatch: true };
    } else {
      if (confirmCtrl?.hasError('mismatch')) {
        delete confirmCtrl.errors?.['mismatch'];
        if (!Object.keys(confirmCtrl.errors || {}).length) {
          confirmCtrl.setErrors(null);
        }
      }
      return null;
    }
  }

  // Helper method to access signup form controls easily in the signup template
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
    console.log('Sending payload to /auth/v1/sign-up:', payload);

    this.authService.signup(payload).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/project']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Signup failed', err);
      },
    });
  }
}
