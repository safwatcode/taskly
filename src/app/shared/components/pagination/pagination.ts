import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  currentPage = input.required<number>();
  totalItems = input.required<number>();
  pageSize = input.required<number>();

  pageChange = output<number>();

  // Calculate total pages
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));

  // Pagination buttons
  visiblePages = computed(() => {
    const current = this.currentPage();
    const total = this.totalPages();

    // If 5 or fewer pages, show them all: [1] [2] [3] [4] [5]
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    // If near the start: [1] [2] [3] [4] [...] [15]
    if (current <= 3) {
      return [1, 2, 3, 4, '...', total];
    }

    // If near the end: [1] [...] [12] [13] [14] [15]
    else if (current >= total - 2) {
      return [1, '...', total - 3, total - 2, total - 1, total];
    }

    // If in the middle: [1] [...] [6] [7] [8] [...] [15]
    else {
      return [1, '...', current - 1, current, current + 1, '...', total];
    }
  });

  // Calculates the starting number
  startItem = computed(() => {
    if (this.totalItems() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  // Calculates the ending number
  endItem = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.totalItems());
  });

  currentDisplayedCount = computed(() => {
    return this.endItem() - this.startItem() + 1;
  });

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.pageChange.emit(this.currentPage() + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.pageChange.emit(this.currentPage() - 1);
    }
  }
}
