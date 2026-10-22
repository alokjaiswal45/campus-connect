import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="role-login"><section class="role-login-card">
      <div class="role-login-brand">✦ campus<span>connect</span></div>
      <p class="role-login-eyebrow">STUDENT ACCOUNT</p>
      <h1>{{ changing ? 'Change password' : 'Reset password' }}</h1>
      <p>{{ changing ? 'Confirm your current password before choosing a new one.' : 'Request a code at your registered college email. Only you can reset your password.' }}</p>
      <p *ngIf="error" class="role-login-error" role="alert">{{ error }}</p>
      <p *ngIf="notice" role="status">{{ notice }}</p>
      <ng-container *ngIf="!done">
        <form *ngIf="!changing && !codeRequested" (ngSubmit)="requestCode()">
          <label for="reset-email">College email</label>
          <input id="reset-email" name="email" type="email" [(ngModel)]="email" maxlength="254" required autocomplete="username">
          <button type="submit" [disabled]="busy">{{ busy ? 'Requesting…' : 'Send reset code' }}</button>
        </form>
        <form *ngIf="changing || codeRequested" (ngSubmit)="save()">
          <ng-container *ngIf="!changing">
            <p>Code requested for {{ email }}</p>
            <label for="reset-code">Six-digit email code</label>
            <input id="reset-code" name="otp" [(ngModel)]="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code">
          </ng-container>
          <ng-container *ngIf="changing">
            <label for="current-password">Current password</label>
            <input id="current-password" name="currentPassword" type="password" [(ngModel)]="currentPassword" required autocomplete="current-password">
          </ng-container>
          <label for="new-password">New password</label>
          <input id="new-password" name="newPassword" type="password" [(ngModel)]="newPassword" minlength="8" maxlength="72" required autocomplete="new-password">
          <small>At least 8 characters; up to 72 UTF-8 bytes. Choose a different password from your current one.</small>
          <label for="confirm-password">Confirm new password</label>
          <input id="confirm-password" name="confirmation" type="password" [(ngModel)]="confirmation" required autocomplete="new-password">
          <button type="submit" [disabled]="busy">{{ busy ? 'Updating…' : 'Update password' }}</button>
          <button *ngIf="!changing" type="button" (click)="requestCode()" [disabled]="busy || resendAt > now()">Resend code</button>
        </form>
      </ng-container>
      <p><a [routerLink]="changing && !done ? '/student/dashboard' : '/student/login'">{{ changing && !done ? 'Back to dashboard' : 'Back to sign in' }}</a></p>
    </section></main>
  `
})
export class StudentPasswordComponent {
  changing = this.route.snapshot.data['change'] === true;
  email = ''; otp = ''; currentPassword = ''; newPassword = ''; confirmation = '';
  busy = false; done = false; codeRequested = false; error = ''; notice = ''; resendAt = 0;
  now(): number { return Date.now(); }
  constructor(private route: ActivatedRoute, private api: ApiService) {}
  requestCode(): void {
    if (this.busy || this.resendAt > Date.now()) return;
    this.error = '';
    if (!/^[a-z0-9._%+-]+@bmsce\.ac\.in$/i.test(this.email.trim())) {
      this.error = 'Enter your registered BMSCE college email.'; return;
    }
    this.email = this.email.trim().toLowerCase();
    this.busy = true;
    this.api.post('/auth/password-reset/request', { email: this.email }).subscribe({
      next: result => {
        this.busy = false; this.codeRequested = true; this.otp = ''; this.resendAt = Date.now() + 60000;
        setTimeout(() => this.resendAt = 0, 60000);
        this.notice = result.message;
      },
      error: (err: any) => { this.busy = false; this.error = err.error?.error || err.error?.message || 'Unable to request a code. Please try again later.'; }
    });
  }
  save(): void {
    if (this.busy) return;
    this.error = ''; this.notice = '';
    this.otp = this.otp.trim();
    if (this.newPassword.length < 8 || new TextEncoder().encode(this.newPassword).length > 72) {
      this.error = 'Use at least 8 characters and no more than 72 UTF-8 bytes.'; return;
    }
    if (this.newPassword !== this.confirmation) { this.error = 'The new passwords do not match.'; return; }
    if (this.changing ? !this.currentPassword : !/^[0-9]{6}$/.test(this.otp)) {
      this.error = this.changing ? 'Enter your current password.' : 'Enter the six-digit email code.'; return;
    }
    this.busy = true;
    const path = this.changing ? '/auth/change-password' : '/auth/password-reset/confirm';
    const body = this.changing ? { currentPassword: this.currentPassword, newPassword: this.newPassword }
      : { email: this.email, otp: this.otp, newPassword: this.newPassword };
    this.api.post(path, body).subscribe({
      next: result => {
        this.busy = false; this.done = true;
        this.currentPassword = ''; this.newPassword = ''; this.confirmation = ''; this.otp = '';
        sessionStorage.removeItem('cc_auth'); this.notice = result.message;
      },
      error: err => { this.busy = false; this.error = err.error?.error || 'Unable to update your password.'; }
    });
  }
}
