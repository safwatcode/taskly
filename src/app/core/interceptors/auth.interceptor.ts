import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const supabaseURL = environment.supabase.url;
  const supabaseAnonKey = environment.supabase.anonKey;

  const authService = inject(Auth);
  const router = inject(Router);

  if (req.url.startsWith(supabaseURL)) {
    const token = authService.getToken();

    // Initializing headers with anonymous key and content type
    let headers = req.headers
      .set('apikey', supabaseAnonKey)
      .set('Content-Type', 'application/json');

    // Authorizing the Bearer token if a valid session exists
    if (token) {
      // Check if a specific component already provided a custom Authorization header before blindly overwriting it
      if (!req.headers.has('Authorization')) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // Request Cloning
    const clonedReq = req.clone({ headers });

    // Process the request and intercept any incoming errors from the backend
    return next(clonedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Global 401 Unauthorized Error Handler
        if (error.status === 401) {
          console.warn('Unauthorized request detected. Redirecting to login page...');
          // Wipe the invalid token
          authService.clearSession();
          // Redirect the user automatically to the login page
          router.navigate(['/login']);
        }

        // Pass the error back down the stream so individual components can still handle other errors (like 404s or 500s)
        return throwError(() => error);
      }),
    );
  }

  // If the URL is not Supabase, let the original request proceed untouched
  return next(req);
};
