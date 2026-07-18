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

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, CommonModule, InputField, Button, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  signupForm: FormGroup;
  // [Testing] Loading timing to mocking signup process
  isLoading = false;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  // private authService: AuthService

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
            // \p{L} supports all language letters (including Arabic).
            // (?: [\p{L}]+)* ensures single spaces between words, no consecutive spaces.
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

    if (password && confirmPassword && password !== confirmPassword) {
      control.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  onSubmit() {
    if (this.signupForm.valid) {
      console.log('Form Submitted Successfully:', this.signupForm.value);
    } else {
      this.signupForm.markAllAsTouched();
    }
    this.isLoading = true;
    // const formValues = this.signupForm.value;

    // const payload = {
    //   email: formValues.email,
    //   password: formValues.password,
    //   date: {
    //     name: formValues.name,
    //     job_title: formValues.jobTitle || undefined,
    //   },
    // };
    //
    // console.log('Sending payload to /auth/v1/signup:', payload);
    // setTimeout(() => {
    //   this.isLoading = false;
    //   this.router.navigate(['/project']);
    // }, 1000);
  }

  // Optional for me
  // Helper method to access signup form controls easily in the template
  get formControls() {
    return this.signupForm.controls;
  }
}
