import { AbstractControl, ValidationErrors } from '@angular/forms';

export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
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

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
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
