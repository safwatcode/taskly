import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private router = inject(Router);

  constructor() {
    // Resetting Password
    const hash = window.location.hash;

    if (hash && hash.includes('type=recovery')) {
      this.router.navigateByUrl(`/reset-password${hash}`);
    }
  }
}
