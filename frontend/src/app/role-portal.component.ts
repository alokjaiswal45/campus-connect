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
          <p>Browse reports, receive found items and review private ownership claims.</p>
          <button (click)="loadItems()">Refresh inventory</button>
          <div class="staff-inventory">
            <button *ngFor="let item of inventory" class="inventory-entry" (click)="selectItem(item)">
              <strong>{{ item.title }}</strong>
              <span>{{ item.kind }} · {{ item.status }}</span>
              <small>{{ item.location || 'Location not specified' }}</small>
              <small *ngIf="item.custodyAcceptedAt">In custody: {{ item.custodyLocation }}</small>
            </button>
          </div>
          <label for="item-id">Item ID</label>
          <input id="item-id" type="number" min="1" [(ngModel)]="itemId" />
          <button (click)="loadClaims()" [disabled]="!itemId || busy">Load claims</button>
          <div class="portal-form">
            <label>Physical storage location <input [(ngModel)]="storageLocation" placeholder="Desk cabinet A-1"></label>
            <button (click)="intake()" [disabled]="!itemId || !storageLocation.trim() || busy">Receive item into custody</button>
          </div>
          <p *ngIf="error" class="role-login-error">{{ error }}</p>
          <p *ngIf="notice">{{ notice }}</p>
          <div *ngFor="let claim of claims" class="staff-claim">
            <strong>Claim #{{ claim.id }} — {{ claim.status }}</strong>
            <p>Claimant: {{ claim.claimantEmail }}</p>
            <p>Ownership details: {{ claim.ownershipAnswer }}</p>
            <button (click)="viewEvidence(claim.id)">View private evidence photo</button>
            <img *ngIf="evidenceUrls[claim.id]" [src]="evidenceUrls[claim.id]" alt="Private ownership evidence" class="staff-evidence">
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
          <form (ngSubmit)="createAdmin()" class="portal-form">
            <label>Full name <input name="adminName" [(ngModel)]="newAdmin.name" required></label>
            <label>College email <input name="adminEmail" type="email" [(ngModel)]="newAdmin.email" required></label>
            <label>Temporary password <input name="adminPassword" type="password" [(ngModel)]="newAdmin.password" minlength="12" required></label>
            <button type="submit" [disabled]="busy || newAdmin.password.length < 12">Create administrator</button>
          </form>
          <ul><li *ngFor="let admin of admins">{{ admin.name }} — {{ admin.email }}
            <button (click)="revokeAdmin(admin)" [disabled]="busy">Revoke admin role</button>
          </li></ul>
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
  newAdmin = { name: '', email: '', password: '' };
  claims: any[] = [];
  inventory: any[] = [];
  itemId: number | null = null;
  storageLocation = '';
  evidenceUrls: Record<number, string> = {};
  busy = false;
  notice = '';
  error = '';
  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}
  ngOnInit(): void {
    this.api.get('/auth/me').subscribe({ next: user => this.user = user });
    if (this.section === 'staff') this.loadItems();
    if (this.section === 'super-admin') {
      this.api.get('/super-admin/admins').subscribe({
        next: data => this.admins = data,
        error: () => this.error = 'Could not load administrator accounts.'
      });
    }
  }
  reloadAdmins(): void {
    this.api.get('/super-admin/admins').subscribe({
      next: admins => this.admins = admins,
      error: () => this.error = 'Unable to load administrator accounts.'
    });
  }
  createAdmin(): void {
    this.busy = true;
    this.error = '';
    this.api.post('/super-admin/admins', this.newAdmin).subscribe({
      next: () => {
        this.busy = false;
        this.newAdmin = { name: '', email: '', password: '' };
        this.notice = 'Administrator created.';
        this.reloadAdmins();
      },
      error: () => { this.busy = false; this.error = 'Unable to create administrator.'; }
    });
  }
  revokeAdmin(admin: any): void {
    if (!confirm('Revoke administrator privileges for ' + admin.email + '?')) return;
    this.busy = true;
    this.api.delete('/super-admin/admins/' + admin.id).subscribe({
      next: () => { this.busy = false; this.notice = 'Administrator role revoked.'; this.reloadAdmins(); },
      error: () => { this.busy = false; this.error = 'Unable to revoke administrator role.'; }
    });
  }
  intake(): void {
    if (!this.itemId || !this.storageLocation.trim()) return;
    this.busy = true;
    this.error = '';
    this.api.put('/staff/items/' + this.itemId + '/intake', {
      storageLocation: this.storageLocation.trim()
    }).subscribe({
      next: () => { this.busy = false; this.notice = 'Item received into custody.'; this.loadItems(); },
      error: () => { this.busy = false; this.error = 'Could not receive item. It may already be in custody.'; }
    });
  }
  viewEvidence(claimId: number): void {
    this.api.get('/claims/' + claimId + '/evidence').subscribe({
      next: (images: any[]) => {
        if (!images.length) { this.notice = 'No proof photo submitted.'; return; }
        this.api.getImage(images[0].id).subscribe({
          next: blob => {
            if (this.evidenceUrls[claimId]) URL.revokeObjectURL(this.evidenceUrls[claimId]);
            this.evidenceUrls[claimId] = URL.createObjectURL(blob);
          },
          error: () => this.error = 'Unable to open evidence.'
        });
      },
      error: () => this.error = 'Unable to load evidence.'
    });
  }
  loadItems(): void {
    this.api.get('/items').subscribe({
      next: (items: any[]) => this.inventory = items.filter(i => i.kind === 'FOUND'),
      error: () => this.error = 'Unable to load inventory.'
    });
  }
  selectItem(item: any): void {
    this.itemId = item.id;
    this.storageLocation = item.custodyLocation || '';
    this.loadClaims();
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
      next: () => { this.busy = false; this.notice = 'Handover recorded.'; this.loadClaims(); this.loadItems(); },
      error: (err: any) => { this.busy = false; this.error = err.error?.message || 'Handover failed.'; }
    });
  }
  logout(): void {
    sessionStorage.removeItem('cc_auth');
    this.router.navigateByUrl('/' + this.section + '/login');
  }
}
