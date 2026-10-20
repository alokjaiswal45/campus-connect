
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  // Public endpoints do not require authentication
  const publicEndpoints = [
    '/api/auth/register',
    '/api/auth/send-otp',
    '/api/auth/verify-otp'
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
    'http://localhost:8080'
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

  return next(authenticatedRequest);
};
