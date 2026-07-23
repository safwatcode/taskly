import { Routes } from '@angular/router';
import { Signup } from './features/auth/signup/signup';
import { Login } from './features/auth/login/login';
import { Project } from './features/project/project';
import { MainLayout } from './shared/components/layout/main-layout/main-layout';
import { authGuard } from './core/auth/guards/auth-guard';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'sign-up', component: Signup },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'project', component: Project },
      { path: '', redirectTo: 'project', pathMatch: 'full' },
    ],
  },
  { path: 'forgot-password', component: ForgotPassword },
  { path: '**', redirectTo: 'login' },
];
