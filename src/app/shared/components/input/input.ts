import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './input.html',
  styleUrl: './input.css',
})
export class InputField {
  @Input() label = '';
  @Input() inputId = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() control!: FormControl;

  isPasswordVisible = false;

  togglePasswordVisibility() {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  get computedType() {
    if (this.type === 'password') {
      if (this.isPasswordVisible) {
        return 'text';
      } else {
        return 'password';
      }
    } else {
      return this.type;
    }
  }
}
