import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="role-portal">
      <header><strong>✦ Campus Connect</strong><button (click)="logout()">Log out</button></header>
      <section class="role-portal-welcome">
        <p>{{ label }} workspace</p>
        <h1>Welcome, {{ user?.name || 'team member' }}</h1>
        <p *ngIf="section === 'staff'">Manage Lost &amp; Found intake, verify ownership claims and record handovers.</p>
        <p *ngIf="section === 'super-admin'">Manage administrator accounts and oversee campus operations.</p>
      </section>
      <section class="role-portal-grid">
        <article *ngIf="section === 'staff'">
          <h2>Lost &amp; Found desk</h2>
          <p>Enter an item ID to review private ownership claims and record verified handovers.</p>
          <label for="item-id">Item ID</label>
          <input id="item-id" type="number" min="1" [(ngModel)]="itemId" />
          <button (click)="loadClaims()" [disabled]="!itemId || busy">Load claims</button>
          <p *ngIf="error" class="role-login-error">{{ error }}</p>
          <p *ngIf="notice">{{ notice }}</p>
          <div *ngFor="let claim of claims" class="staff-claim">
            <strong>Claim #{{ claim.id }} — {{ claim.status }}</strong>
            <p>Claimant: {{ claim.claimantEmail }}</p>
            <p>Ownership details: {{ claim.ownershipAnswer }}</p>
            <div *ngIf="claim.status === 'PENDING'">
              <button (click)="review(claim, true)" [disabled]="busy">Approve</button>
              <button (click)="review(claim, false)" [disabled]="busy">Reject</button>
            </div>
            <div *ngIf="claim.status === 'APPROVED'">
              <p>Pickup reference: {{ claim.pickupReference }}</p>
              <label>Reference presented by student</label>
              <input [(ngModel)]="claim.enteredReference" />
              <label><input type="checkbox" [(ngModel)]="claim.collegeIdChecked" /> College ID checked in person</label>
              <button (click)="handover(claim)" [disabled]="busy || !claim.collegeIdChecked">Confirm handover</button>
            </div>
          </div>
        </article>
        <article *ngIf="section === 'super-admin'">
          <h2>Administrator accounts</h2>
          <p>Existing administrator accounts: {{ admins.length }}</p>
          <p *ngIf="error">{{ error }}</p>
          <ul><li *ngFor="let admin of admins">{{ admin.name }} — {{ admin.email }}</li></ul>
        </article>
      </section>
    </main>
  `
})
export class RolePortalComponent implements OnInit {
  section = this.route.snapshot.data['section'] as string;
  label = this.section === 'staff' ? 'Staff' : 'Super Admin';
  user: any;
  admins: any[] = [];
  claims: any[] = [];
  itemId: number | null = null;
  busy = false;
  notice = '';
  error = '';
  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}
  ngOnInit(): void {
    this.api.get('/auth/me').subscribe({ next: user => this.user = user });
    if (this.section === 'super-admin') {
      this.api.get('/super-admin/admins').subscribe({
        next: data => this.admins = data,
        error: () => this.error = 'Could not load administrator accounts.'
      });
    }
  }
  loadClaims(): void {
    if (!this.itemId) return;
    this.error = '';
    this.notice = '';
    this.api.get('/staff/items/' + this.itemId + '/claims').subscribe({
      next: claims => this.claims = claims,
      error: () => this.error = 'Unable to load claims for this item.'
    });
  }
  review(claim: any, approve: boolean): void {
    this.busy = true;
    this.error = '';
    this.api.put('/staff/claims/' + claim.id + '/review', { approve }).subscribe({
      next: () => { this.busy = false; this.notice = 'Claim reviewed.'; this.loadClaims(); },
      error: (err: any) => { this.busy = false; this.error = err.error?.message || 'Review failed.'; }
    });
  }
  handover(claim: any): void {
    if (!claim.collegeIdChecked || !claim.enteredReference) {
      this.error = 'Check the college ID and enter the pickup reference.';
      return;
    }
    this.busy = true;
    this.error = '';
    this.api.put('/staff/claims/' + claim.id + '/handover', {
      pickupReference: claim.enteredReference,
      collegeIdChecked: claim.collegeIdChecked
    }).subscribe({
      next: () => { this.busy = false; this.notice = 'Handover recorded.'; this.loadClaims(); },
      error: (err: any) => { this.busy = false; this.error = err.error?.message || 'Handover failed.'; }
    });
  }
  logout(): void {
    sessionStorage.removeItem('cc_auth');
    this.router.navigateByUrl('/' + this.section + '/login');
  }
}
