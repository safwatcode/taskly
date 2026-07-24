import { Routes } from '@angular/router';
import { Signup } from './features/auth/signup/signup';
import { Login } from './features/auth/login/login';
import { MainLayout } from './shared/components/layout/main-layout/main-layout';
import { authGuard } from './core/auth/guards/auth-guard';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Project } from './features/project/project';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'sign-up', component: Signup },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'project',
        children: [
          {
            path: '',
            component: Project,
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./features/project/add-project/add-project').then((m) => m.AddProject),
          },
        ],
      },
      { path: '', redirectTo: 'project', pathMatch: 'full' },
    ],
  },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: '**', redirectTo: 'login' },
];
