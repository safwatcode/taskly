import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private baseURL = 'https://jmltwxyausnmtasziccs.supabase.co';

  private signupURL = `${this.baseURL}/auth/v1/signup`;
  private loginURL = `${this.baseURL}/auth/v1/token?grant_type=password`;

  private http = inject(HttpClient);

  signup(payload: any): Observable<any> {
    return this.http.post(this.signupURL, payload);
  }

  login(payload: any): Observable<any> {
    return this.http.post(this.loginURL, payload);
  }

  logout(): Observable<any> {
    const logoutURL = `${this.baseURL}/auth/v1/logout`;
    return this.http.post(logoutURL, {});
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    return !!token;
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
    return this.http.get(userURL);
  }

  recoverPassword(email: string): Observable<any> {
    const recoverURL = `${this.baseURL}/auth/v1/recover`;
    return this.http.post(recoverURL, { email });
  }

  updateUserPassword(password: string, token: string) {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.put(`${this.baseURL}/auth/v1/user`, { password }, { headers });
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
