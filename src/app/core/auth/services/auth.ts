import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private supabaseAnonKey = 'sb_publishable_Av9xf7E668gex_Re48dC4g_na-qlGFU';

  private baseURL = 'https://jmltwxyausnmtasziccs.supabase.co';

  private signupURL = `${this.baseURL}/auth/v1/signup`;
  private loginURL = `${this.baseURL}/auth/v1/token?grant_type=password`;

  private http = inject(HttpClient);

  private getSupabaseHeaders(): HttpHeaders {
    return new HttpHeaders({
      apikey: this.supabaseAnonKey,
      'Content-Type': 'application/json',
    });
  }

  signup(payload: any): Observable<any> {
    return this.http.post(this.signupURL, payload, { headers: this.getSupabaseHeaders() });
  }

  login(payload: any): Observable<any> {
    return this.http.post(this.loginURL, payload, { headers: this.getSupabaseHeaders() });
  }

  logout(): Observable<any> {
    const logoutURL = `${this.baseURL}/auth/v1/logout`;
    const token = this.getToken();

    const headers = this.getSupabaseHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.post(logoutURL, {}, { headers });
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    return !!token;
  }

  private getToken(): string | null {
    const sessionToken = sessionStorage.getItem('access_token');
    if (sessionToken) {
      return sessionToken;
    }

    const localTokenData = localStorage.getItem('access_token');
    if (localTokenData) {
      try {
        const parsedData = JSON.parse(localTokenData);
        return parsedData.token;
      } catch (e) {
        console.error('Error parsing local token data:', e);
        return localTokenData;
      }
    }

    return null;
  }

  getUserProfile(): Observable<any> {
    const userURL = `${this.baseURL}/auth/v1/user`;
    const token = this.getToken();

    const headers = this.getSupabaseHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get(userURL, { headers });
  }

  recoverPassword(email: string): Observable<any> {
    const recoverURL = `${this.baseURL}/auth/v1/recover`;

    const headers = this.getSupabaseHeaders();

    return this.http.post(recoverURL, { email }, { headers });
  }

  saveSession(token: string, rememberMe: boolean) {
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
