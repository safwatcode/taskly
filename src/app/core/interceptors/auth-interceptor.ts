import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const supabaseURL = 'https://jmltwxyausnmtasziccs.supabase.co';
  const supabaseAnonKey = 'sb_publishable_Av9xf7E668gex_Re48dC4g_na-qlGFU';

  if (req.url.startsWith(supabaseURL)) {
    let token = sessionStorage.getItem('access_token');

    if (!token) {
      const localTokenData = localStorage.getItem('access_token');
      if (localTokenData) {
        try {
          token = JSON.parse(localTokenData).token;
        } catch (e) {
          token = localTokenData;
        }
      }
    }

    let headers = req.headers
      .set('apikey', supabaseAnonKey)
      .set('Content-Type', 'application/json');

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    const clonedReq = req.clone({ headers });

    return next(clonedReq);
  }

  return next(req);
};
