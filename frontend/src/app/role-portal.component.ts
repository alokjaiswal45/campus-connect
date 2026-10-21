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
        <p *ngIf="section === 'teacher'">Bring learning materials together. Upload course notes, modules and exam papers.</p>
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
        <article *ngIf="section === 'teacher'" class="teacher-workspace">
          <div class="portal-section-head"><span class="portal-icon">▤</span><div><h2>Academic resource studio</h2><p>Publish course notes and exam papers for students.</p></div></div>
          <div class="portal-kpis"><div><strong>{{ subjects.length }}</strong><span>Subjects available</span></div><div><strong>{{ documents.length }}</strong><span>Documents in library</span></div></div>
          <form (ngSubmit)="uploadDocument()" class="portal-form">
            <label>Course subject <select name="subject" [(ngModel)]="newDoc.subjectId" required><option value="">Choose a subject</option><option *ngFor="let s of subjects" [value]="s.id">{{ s.branch?.code }} · Semester {{ s.semester }} · {{ s.name }}</option></select></label>
            <label>Document title <input name="title" [(ngModel)]="newDoc.title" maxlength="255" placeholder="e.g. Module 2 · Data Structures" required></label>
            <label>Material type <select name="type" [(ngModel)]="newDoc.type"><option value="RESOURCE">Lecture notes / study resource</option><option value="PAPER">Question paper</option></select></label>
            <label *ngIf="newDoc.type === 'RESOURCE'">Module <select name="module" [(ngModel)]="newDoc.moduleNumber"><option value="">Choose module</option><option *ngFor="let m of [1,2,3,4,5]" [value]="m">Module {{ m }}</option></select></label>
            <ng-container *ngIf="newDoc.type === 'PAPER'"><label>Exam <select name="exam" [(ngModel)]="newDoc.examType"><option value="">Choose exam</option><option *ngFor="let e of ['CIE 1','CIE 2','CIE 3','SEE','SUPPLEMENTARY']" [value]="e">{{ e }}</option></select></label><label>Exam year <input name="year" [(ngModel)]="newDoc.academicYear" maxlength="4" placeholder="2026"></label></ng-container>
            <label>PDF (maximum 20 MB) <input type="file" accept=".pdf,application/pdf" (change)="choosePdf($event)"></label>
            <button type="submit" [disabled]="busy || !pdf || !newDoc.subjectId || !newDoc.title.trim() || (newDoc.type === 'RESOURCE' ? !newDoc.moduleNumber : !newDoc.examType || !newDoc.academicYear)">{{ busy ? 'Publishing…' : 'Publish resource ↗' }}</button>
          </form>
        </article>
      </section>
    </main>
  `
})
export class RolePortalComponent implements OnInit {
  section = this.route.snapshot.data['section'] as string;
  label = this.section === 'staff' ? 'Staff' : 'Teacher';
  user: any;
  subjects: any[] = [];
  documents: any[] = [];
  pdf: File | null = null;
  newDoc = { subjectId: '', title: '', type: 'RESOURCE', moduleNumber: '', examType: '', academicYear: '' };
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
    if (this.section === 'teacher') {
      this.api.get('/subjects').subscribe({ next: subjects => this.subjects = subjects, error: () => this.error = 'Could not load subjects.' });
      this.api.get('/documents').subscribe({ next: documents => this.documents = documents });
    }
  }
  choosePdf(event: Event): void {
    this.pdf = (event.target as HTMLInputElement).files?.[0] || null;
  }
  uploadDocument(): void {
    if (!this.pdf || !this.newDoc.subjectId || !this.newDoc.title.trim()) return;
    if (this.pdf.size > 20 * 1024 * 1024 || this.pdf.type !== 'application/pdf') { this.error = 'Choose a PDF under 20 MB.'; return; }
    const form = new FormData();
    form.append('subjectId', this.newDoc.subjectId);
    form.append('title', this.newDoc.title.trim());
    form.append('type', this.newDoc.type);
    form.append('file', this.pdf);
    if (this.newDoc.type === 'RESOURCE') form.append('moduleNumber', this.newDoc.moduleNumber);
    else { form.append('examType', this.newDoc.examType); form.append('academicYear', this.newDoc.academicYear); }
    this.busy = true; this.error = ''; this.notice = '';
    this.api.uploadDocument(form).subscribe({
      next: () => { this.busy = false; this.pdf = null; this.newDoc = { subjectId: '', title: '', type: 'RESOURCE', moduleNumber: '', examType: '', academicYear: '' }; this.notice = 'Resource published successfully.'; this.api.get('/documents').subscribe(d => this.documents = d); },
      error: (err: any) => { this.busy = false; this.error = err.error?.message || 'Upload failed.'; }
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
    this.api.get('/staff/items/inventory').subscribe({
      next: (items: any[]) => this.inventory = items,
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
