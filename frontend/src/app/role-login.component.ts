import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from './api.service';
import { destination } from './portal-routing';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="role-login">
      <section class="role-login-card">
        <div class="role-login-brand">✦ campus<span>connect</span></div>
        <p class="role-login-eyebrow">{{ sectionLabel }} PORTAL</p>
        <h1>{{ sectionLabel }} sign in</h1>
        <p>Sign in with your verified BMSCE college account.</p>
        <form (ngSubmit)="login()">
          <label>College email</label>
          <input name="email" type="email" [(ngModel)]="email" autocomplete="username" required />
          <label>Password</label>
          <input name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required />
          <p *ngIf="error" class="role-login-error">{{ error }}</p>
          <button type="submit" [disabled]="loading">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
        </form>
        <p class="role-login-note" *ngIf="section === 'student'">
          New student? <a routerLink="/student/onboarding">Register and verify your email</a>.
        </p>
        <p><a [routerLink]="'/' + section + '/forgot-password'">Forgot password?</a></p>
        <nav class="role-login-switch">
          <a routerLink="/student/login">Student</a>
          <a routerLink="/teacher/login">Teacher</a>
          <a routerLink="/staff/login">Staff</a>
          <a routerLink="/admin/login">Admin</a>
        </nav>
      </section>
    </main>
  `
})
export class LoginPageComponent {
  email = '';
  password = '';
  error = '';
  loading = false;
  section = this.route.snapshot.data['section'] as string;
  expectedRole = this.route.snapshot.data['role'] as string;
  get sectionLabel(): string { return this.section.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()); }

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  login(): void {
    this.error = '';
    if (!/^[a-z0-9._%+-]+@bmsce\.ac\.in$/i.test(this.email.trim()) || !this.password) {
      this.error = 'Enter your college email and password.';
      return;
    }
    this.loading = true;
    const token = btoa(String.fromCharCode(...new TextEncoder().encode(this.email.trim().toLowerCase() + ':' + this.password)));
    sessionStorage.setItem('cc_auth', token);
    this.api.get('/auth/me').subscribe({
      next: user => {
        this.loading = false;
        this.password = '';
        if (user.role !== this.expectedRole) {
          sessionStorage.removeItem('cc_auth');
          this.error = 'This account does not have access to the ' + this.sectionLabel + ' portal.';
          return;
        }
        this.router.navigateByUrl(destination(user.role));
      },
      error: () => {
        this.loading = false;
        this.password = '';
        sessionStorage.removeItem('cc_auth');
        this.error = 'Invalid credentials, unverified email, or backend unavailable.';
      }
    });
  }
}
