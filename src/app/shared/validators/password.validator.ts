import { AbstractControl, ValidationErrors } from '@angular/forms';

export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value || '';
  if (!value) return null;

  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSpecial = /[!@#$%^&*()_+{}[\]:;<>,.?~\\/-]/.test(value);
  const noWhiteSpace = /^\S+$/.test(value);

  // Overriding 'any' by explicitly typing the errors object as a dictionary of booleans
  const errors: Record<string, boolean> = {};

  if (!hasUpper || !hasLower || !hasDigit) errors['missingUpperLowerDigit'] = true;
  if (!hasSpecial) errors['missingSpecial'] = true;
  if (!noWhiteSpace) errors['hasWhiteSpace'] = true;

  return Object.keys(errors).length > 0 ? errors : null;
}

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  const confirmCtrl = control.get('confirmPassword');

  if (!confirmCtrl) return null;

  if (password && confirmPassword && password !== confirmPassword) {
    confirmCtrl.setErrors({ ...confirmCtrl.errors, mismatch: true });
    return { mismatch: true };
  } else {
    if (confirmCtrl.hasError('mismatch')) {
      const currentErrors = confirmCtrl.errors;

      if (currentErrors) {
        const { mismatch, ...remainingErrors } = currentErrors;

        // If there are other errors left, keep them. Otherwise, clear the errors entirely.
        confirmCtrl.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
      }
    }
    return null;
  }
}
