import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment'; // Adjust path as needed

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private baseURL = environment.supabase.url;

  private signupURL = `${this.baseURL}/auth/v1/signup`;
  private loginURL = `${this.baseURL}/auth/v1/token?grant_type=password`;

  private http = inject(HttpClient);

  signup(payload: unknown): Observable<unknown> {
    return this.http.post(this.signupURL, payload);
  }

  login(payload: unknown): Observable<unknown> {
    return this.http.post(this.loginURL, payload);
  }

  logout(): Observable<unknown> {
    const logoutURL = `${this.baseURL}/auth/v1/logout`;
    return this.http.post(logoutURL, {}).pipe(tap(() => this.clearSession()));
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  public getToken(): string | null {
    const sessionToken = sessionStorage.getItem('access_token');
    if (sessionToken) {
      return sessionToken;
    }

    const localTokenData = localStorage.getItem('access_token');
    if (localTokenData) {
      try {
        const parsedData = JSON.parse(localTokenData);

        // Check if the token has expired
        if (parsedData.expires && Date.now() > parsedData.expires) {
          // Wipe the expired token
          this.clearSession();
          // The user has to log in again
          return null;
        }

        return parsedData.token;
      } catch (e) {
        console.error('Error parsing local token data:', e);
        // Fallback for plain strings
        return localTokenData;
      }
    }

    return null;
  }

  getUserProfile(): Observable<unknown> {
    const userURL = `${this.baseURL}/auth/v1/user`;
    return this.http.get(userURL);
  }

  recoverPassword(email: string): Observable<unknown> {
    const recoverURL = `${this.baseURL}/auth/v1/recover`;
    return this.http.post(recoverURL, { email });
  }

  updateUserPassword(password: string, token: string): Observable<unknown> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.put(`${this.baseURL}/auth/v1/user`, { password }, { headers });
  }

  saveSession(token: string, rememberMe: boolean): void {
    if (rememberMe) {
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const sessionData = {
        token: token,
        expires: oneMonthFromNow.getTime(),
      };

      localStorage.setItem('access_token', JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem('access_token', token);
    }
  }

  clearSession(): void {
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('access_token');
  }
}
