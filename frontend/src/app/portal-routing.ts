import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { ApiService } from './api.service';
import { catchError, map, of } from 'rxjs';
import { AppComponent } from './app.component';
import { LoginPageComponent } from './role-login.component';
import { RolePortalComponent } from './role-portal.component';

const home: Record<string, string> = {
  STUDENT: '/student/dashboard',
  STAFF: '/staff/dashboard',
  TEACHER: '/teacher/dashboard',
  ADMIN: '/admin/dashboard'
};

export function destination(role: string): string {
  return home[role] || '/student/login';
}

export const roleGuard: CanActivateFn = route => {
  const api = inject(ApiService);
  const router = inject(Router);
  const expected = route.data['role'] as string;
  if (!sessionStorage.getItem('cc_auth')) {
    return router.createUrlTree(['/', route.data['section'], 'login']);
  }
  return api.get('/auth/me').pipe(
    map(user => user.role === expected ? true : router.parseUrl(destination(user.role))),
    catchError(() => {
      sessionStorage.removeItem('cc_auth');
      return of(router.createUrlTree(['/', route.data['section'], 'login']));
    })
  );
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'student/login' },
  { path: 'student/onboarding', component: AppComponent },
  ...(['student', 'teacher', 'staff', 'admin'] as const).flatMap(section => {
    const role = section.replace('-', '_').toUpperCase();
    return [
      { path: section + '/login', component: LoginPageComponent, data: { role, section } },
      {
        path: section + '/dashboard',
        component: section === 'student' || section === 'admin' ? AppComponent : RolePortalComponent,
        canActivate: [roleGuard],
        data: { role, section }
      }
    ];
  }),
  { path: '**', redirectTo: 'student/login' }
];
