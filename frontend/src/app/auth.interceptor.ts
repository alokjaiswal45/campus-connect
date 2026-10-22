
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const router = inject(Router);
  // Public endpoints do not require authentication
  const publicEndpoints = [
    '/api/auth/register',
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/password-reset/request',
    '/api/auth/password-reset/confirm'
  ];

  const isPublicRequest = publicEndpoints.some(
    endpoint => req.url.split('?')[0].endsWith(endpoint)
  );

  if (isPublicRequest) {
    return next(req);
  }

  // Read saved Basic Authentication credentials
  const token = sessionStorage.getItem('cc_auth');

  if (!token) {
    return next(req);
  }

  // Avoid attaching credentials to unrelated websites
  const backendOrigin = new URL(
    ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:8080' : window.location.origin
  ).origin;

  const requestOrigin = new URL(
    req.url,
    window.location.origin
  ).origin;

  if (requestOrigin !== backendOrigin) {
    return next(req);
  }

  // Add Basic Authentication header
  const authenticatedRequest = req.clone({
    setHeaders: {
      Authorization: 'Basic ' + token
    }
  });

  return next(authenticatedRequest).pipe(catchError(err => {
    if (err.status === 401 && sessionStorage.getItem('cc_auth') === token) {
      sessionStorage.removeItem('cc_auth');
      const section = ['student', 'teacher', 'staff', 'admin'].find(s => router.url.startsWith('/' + s + '/')) || 'student';
      if (!router.url.endsWith('/login')) router.navigateByUrl('/' + section + '/login');
    }
    return throwError(() => err);
  }));
};
