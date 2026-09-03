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
              import('./features/project/project-form/project-form').then((m) => m.ProjectForm),
          },
          {
            path: ':projectId/edit',
            loadComponent: () =>
              import('./features/project/project-form/project-form').then((m) => m.ProjectForm),
          },
          {
            path: ':projectId/members',
            loadComponent: () =>
              import('./features/project/project-members/project-members').then(
                (m) => m.ProjectMembers,
              ),
          },
          {
            path: ':projectId/epics',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/project/project-epics/project-epics').then(
                    (m) => m.ProjectEpics,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./features/project/project-epics/add-project-epic/add-project-epic').then(
                    (m) => m.AddProjectEpic,
                  ),
              },
            ],
          },
          {
            path: ':projectId/tasks',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/project/project-tasks/project-tasks').then(
                    (m) => m.ProjectTasks,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./features/project/project-tasks/add-project-tasks/add-project-tasks').then(
                    (m) => m.AddProjectTasks,
                  ),
              },
            ],
          },
        ],
      },
      { path: '', redirectTo: 'project', pathMatch: 'full' },
    ],
  },
  {
    path: 'invite',
    loadComponent: () =>
      import('./features/project/project-members/accept-invitation/accept-invitation').then(
        (m) => m.AcceptInvitation,
      ),
  },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: '**', redirectTo: 'login' },
];
