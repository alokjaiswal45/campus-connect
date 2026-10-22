import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="role-login">
      <section class="role-login-card">
        <div class="role-login-brand">✦ campus<span>connect</span></div>
        <p class="role-login-eyebrow">STUDENT REGISTRATION</p>
        <h1>{{ stage === 'register' ? 'Join Campus Connect' : 'Verify your college email' }}</h1>
        <p>{{ stage === 'register' ? 'Create a student account with your BMSCE college email.' : 'Enter the six-digit OTP sent to your college email.' }}</p>
        <form (ngSubmit)="stage === 'register' ? register() : verify()">
          <ng-container *ngIf="stage === 'register'">
            <label>Full name</label><input name="name" [(ngModel)]="name" maxlength="100" required autocomplete="name">
          </ng-container>
          <label>College email</label><input name="email" type="email" [(ngModel)]="email" required autocomplete="email" placeholder="student@bmsce.ac.in">
          <ng-container *ngIf="stage === 'register'">
            <label>Password</label><input name="password" type="password" [(ngModel)]="password" minlength="8" required autocomplete="new-password">
          </ng-container>
          <ng-container *ngIf="stage === 'verify'">
            <label>Six-digit verification code</label><input name="otp" [(ngModel)]="otp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" required>
          </ng-container>
          <p *ngIf="error" class="role-login-error">{{ error }}</p>
          <p *ngIf="notice" class="teacher-notice">{{ notice }}</p>
          <button type="submit" [disabled]="busy">{{ busy ? 'Please wait…' : stage === 'register' ? 'Create student account' : 'Verify email' }}</button>
        </form>
        <p class="role-login-note" *ngIf="stage === 'verify'"><button type="button" class="onboarding-link" (click)="sendOtp()" [disabled]="busy">Resend verification code</button></p>
        <p class="role-login-note">Already registered? <a routerLink="/student/login">Student sign in</a></p>
        <p class="role-login-note" *ngIf="stage === 'register'"><button type="button" class="onboarding-link" (click)="stage = 'verify'; error = ''">I already need to verify my email</button></p>
      </section>
    </main>
  `
})
export class StudentOnboardingComponent {
  name = ''; email = ''; password = ''; otp = '';
  stage: 'register' | 'verify' = 'register';
  busy = false; error = ''; notice = '';
  constructor(private api: ApiService) {}
  private validEmail(): boolean { return /^[a-z0-9._%+-]+@bmsce\.ac\.in$/i.test(this.email.trim()); }
  register(): void {
    this.error = ''; this.notice = '';
    if (!this.name.trim() || !this.validEmail() || this.password.length < 8) {
      this.error = 'Enter your name, BMSCE email and a password of at least 8 characters.'; return;
    }
    this.busy = true;
    this.api.post('/auth/register', { name: this.name.trim(), email: this.email.trim().toLowerCase(), password: this.password }).subscribe({
      next: () => { this.busy = false; this.password = ''; this.stage = 'verify'; this.sendOtp(); },
      error: (err: any) => { this.busy = false; this.error = err.error?.error || err.error?.message || 'Registration failed.'; }
    });
  }
  sendOtp(): void {
    this.error = ''; this.notice = '';
    if (!this.validEmail()) { this.error = 'Enter a valid BMSCE email.'; return; }
    this.busy = true;
    this.api.post('/auth/send-otp', { email: this.email.trim().toLowerCase() }).subscribe({
      next: () => { this.busy = false; this.notice = 'If verification is required, a code will be sent to your college email.'; },
      error: (err: any) => { this.busy = false; this.error = err.error?.error || err.error?.message || 'Unable to request verification code. Please try again later.'; }
    });
  }
  verify(): void {
    this.error = ''; this.notice = '';
    if (!this.validEmail() || !/^\d{6}$/.test(this.otp.trim())) { this.error = 'Enter a valid email and six-digit OTP.'; return; }
    this.busy = true;
    this.api.post('/auth/verify-otp', { email: this.email.trim().toLowerCase(), otp: this.otp.trim() }).subscribe({
      next: () => { this.busy = false; this.otp = ''; this.notice = 'Email verified. You can now sign in using the Student portal.'; },
      error: (err: any) => { this.busy = false; this.error = err.error?.error || err.error?.message || 'Invalid or expired OTP.'; }
    });
  }
}
