import { Routes } from '@angular/router';
import { Signup } from './features/auth/signup/signup';
import { Login } from './features/auth/login/login';
import { Project } from './features/project/project';

export const routes: Routes = [
  { path: '', component: Signup, pathMatch: 'full' },
  { path: 'sign-up', component: Signup },
  { path: 'login', component: Login },
  { path: 'project', component: Project },
];
