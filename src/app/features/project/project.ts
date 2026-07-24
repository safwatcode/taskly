import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-project',
  imports: [RouterLink],
  templateUrl: './project.html',
  styleUrl: './project.css',
})
export class Project {
  projects = [];
}
