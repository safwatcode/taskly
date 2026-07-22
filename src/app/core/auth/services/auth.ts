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

  saveSession(token: string, rememberMe: boolean) {
    if (rememberMe) {
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const sessionData = {
        token: token,
        expires: oneMonthFromNow.getTime(),
      };

      localStorage.setItem('Taskly_Session', JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem('Taskly_Session', token);
    }
  }

  clearSession(): void {
    // User Logout
    localStorage.removeItem('Taskly_Session');
    // User Logout User Close the tab/browser
    sessionStorage.removeItem('Taskly_Session');
  }
}
