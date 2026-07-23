import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLinkActive, RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  @Input() isMobileOpen = false;
  @Output() closeMobile = new EventEmitter<void>();

  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((val) => !val);
  }
}
