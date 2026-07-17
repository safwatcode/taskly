import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  imports: [CommonModule],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  @Input() text = 'Submit';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
}
