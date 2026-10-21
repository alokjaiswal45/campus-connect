import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
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
          <p>Item custody, claim review and pickup verification are being implemented.</p>
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
  logout(): void {
    sessionStorage.removeItem('cc_auth');
    this.router.navigateByUrl('/' + this.section + '/login');
  }
}
