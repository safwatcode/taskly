import { Routes } from '@angular/router';
import { Signup } from './features/auth/signup/signup';

export const routes: Routes = [
  { path: '', component: Signup, pathMatch: 'full' },
  { path: 'sign-up', component: Signup },
];
