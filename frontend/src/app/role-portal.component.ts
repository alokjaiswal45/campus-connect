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
        <article *ngIf="section === 'staff'" class="staff-workspace">
          <div class="portal-section-head"><span class="portal-icon">◇</span><div><h2>Lost &amp; Found operations</h2><p>Review every report, receive found property, verify claims, and record safe handovers.</p></div></div>
          <p *ngIf="error" class="role-login-error">{{ error }}</p><p *ngIf="notice" class="teacher-notice">{{ notice }}</p>
          <div class="staff-dashboard-kpis">
            <div><strong>{{ inventory.length }}</strong><span>All reports</span></div>
            <div><strong>{{ countItems('LOST') }}</strong><span>Lost reports</span></div>
            <div><strong>{{ countItems('FOUND') }}</strong><span>Found reports</span></div>
            <div><strong>{{ countInCustody() }}</strong><span>In custody</span></div>
          </div>
          <div class="staff-toolbar">
            <nav class="staff-filter-tabs" aria-label="Report filter">
              <button type="button" [class.selected]="staffFilter === 'ALL'" (click)="staffFilter = 'ALL'">All reports</button>
              <button type="button" [class.selected]="staffFilter === 'LOST'" (click)="staffFilter = 'LOST'">Lost</button>
              <button type="button" [class.selected]="staffFilter === 'FOUND'" (click)="staffFilter = 'FOUND'">Found</button>
            </nav>
            <input aria-label="Search reported items" [(ngModel)]="staffSearch" placeholder="Search item, description, location">
            <button type="button" (click)="loadItems()">↻ Refresh</button>
          </div>
          <div class="staff-inventory">
            <button type="button" *ngFor="let item of filteredInventory" class="inventory-entry" [class.selected]="item.id === itemId" (click)="selectItem(item)">
              <span class="staff-item-kind" [class.is-lost]="item.kind === 'LOST'">{{ item.kind }}</span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.description }}</small>
              <span class="staff-item-meta">{{ item.location || 'Location not specified' }} · {{ item.status }}</span>
              <span class="staff-custody-tag" *ngIf="item.custodyAcceptedAt">✓ In custody: {{ item.custodyLocation }}</span>
            </button>
          </div>
          <p *ngIf="filteredInventory.length === 0" class="teacher-library-empty">No reports match this filter.</p>
          <section *ngIf="selectedStaffItem as selected" class="staff-case-panel">
            <div class="portal-section-head"><span class="portal-icon">⌘</span><div><h2>{{ selected.title }} <small>#{{ selected.id }}</small></h2><p>{{ selected.kind }} report · {{ selected.status }} · Reported by {{ selected.postedBy }}</p></div></div>
            <p>{{ selected.description }}</p>
            <p><strong>Reported location:</strong> {{ selected.location || 'Not specified' }}</p>
            <ng-container *ngIf="selected.kind === 'LOST'">
              <p class="staff-info-note">This is a LOST report. You can review it, but physical intake and claimant handover apply only to FOUND items.</p>
            </ng-container>
            <ng-container *ngIf="selected.kind === 'FOUND'">
              <div *ngIf="selected.status === 'OPEN' && !selected.custodyAcceptedAt" class="staff-intake-form">
                <h3>1. Receive item into custody</h3>
                <p>Confirm the item is physically present and record its exact secure storage location.</p>
                <label>Storage location <input [(ngModel)]="storageLocation" maxlength="255" placeholder="e.g. Lost & Found desk · Locked cabinet A1"></label>
                <button type="button" [disabled]="busy || !storageLocation.trim()" (click)="intake()">Confirm physical intake</button>
              </div>
              <div *ngIf="selected.custodyAcceptedAt" class="staff-custody-confirmed">
                <strong>✓ Item in custody</strong>
                <span>Stored at {{ selected.custodyLocation }} · Received by {{ selected.custodyAcceptedBy }}</span>
              </div>
              <h3>2. Verify ownership claims</h3>
              <p>Review the claimant's private description and evidence before approval. An item must be in custody before approval.</p>
              <button type="button" (click)="loadClaims()" [disabled]="busy">↻ Refresh claims</button>
              <p *ngIf="claims.length === 0" class="staff-info-note">No claims submitted for this item.</p>
              <div *ngFor="let claim of claims" class="staff-claim">
                <div class="staff-claim-head"><strong>Claim #{{ claim.id }}</strong><span>{{ claim.status }}</span></div>
                <p><strong>Claimant:</strong> {{ claim.claimantEmail }}</p>
                <p><strong>Ownership details:</strong> {{ claim.ownershipAnswer }}</p>
                <button type="button" (click)="viewEvidence(claim.id)">View private evidence</button>
                <img *ngIf="evidenceUrls[claim.id]" [src]="evidenceUrls[claim.id]" alt="Private ownership evidence" class="staff-evidence">
                <div *ngIf="claim.status === 'PENDING'" class="staff-review-actions">
                  <button type="button" (click)="review(claim, true)" [disabled]="busy || !selected.custodyAcceptedAt">Approve verified claim</button>
                  <button type="button" (click)="review(claim, false)" [disabled]="busy">Reject claim</button>
                </div>
                <div *ngIf="claim.status === 'APPROVED'" class="staff-handover">
                  <h3>3. Authenticate claimant and hand over</h3>
                  <p>Match the claimant to their physical college ID and verify the pickup reference provided by the claimant. Do not release the item until both checks pass.</p>
                  <label>Pickup reference supplied by claimant <input [(ngModel)]="claim.enteredReference" autocomplete="off" placeholder="Enter reference presented by student"></label>
                  <label class="staff-id-check"><input type="checkbox" [(ngModel)]="claim.collegeIdChecked"> I physically checked the claimant's college ID and identity</label>
                  <button type="button" (click)="handover(claim)" [disabled]="busy || !claim.collegeIdChecked || !claim.enteredReference?.trim()">Confirm authenticated handover</button>
                </div>
              </div>
            </ng-container>
          </section>
        </article>
        <article *ngIf="section === 'teacher'" class="teacher-workspace">
          <nav class="teacher-tabs" aria-label="Teacher academic workspace">
            <button type="button" [class.selected]="teacherTab === 'browse'" (click)="teacherTab = 'browse'">▤ Browse resources</button>
            <button type="button" [class.selected]="teacherTab === 'upload'" (click)="teacherTab = 'upload'">＋ Upload resource</button>
          </nav>
          <p *ngIf="error" class="role-login-error">{{ error }}</p><p *ngIf="notice" class="teacher-notice">{{ notice }}</p>
          <section *ngIf="teacherTab === 'browse'" class="teacher-library">
            <div class="portal-section-head"><span class="portal-icon">▤</span><div><h2>Academic library</h2><p>Find and open course notes and question papers already available to students.</p></div></div>
            <div class="portal-kpis"><div><strong>{{ subjects.length }}</strong><span>Subjects available</span></div><div><strong>{{ documents.length }}</strong><span>Published PDFs</span></div></div>
            <div class="teacher-library-filters">
              <label>Search <input [(ngModel)]="resourceSearch" placeholder="Search title, subject or branch"></label>
              <label>Category <select [(ngModel)]="resourceType"><option value="ALL">All materials</option><option value="RESOURCE">Study resources</option><option value="PAPER">Question papers</option></select></label>
              <label>Branch <select [(ngModel)]="resourceBranch" (ngModelChange)="resourceSubject = 'ALL'"><option value="ALL">All branches</option><option *ngFor="let b of branches" [value]="b.id">{{ b.code }} · {{ b.name }}</option></select></label>
              <label>Semester <select [(ngModel)]="resourceSemester" (ngModelChange)="resourceSubject = 'ALL'"><option value="ALL">All semesters</option><option *ngFor="let sem of [1,2,3,4,5,6,7,8]" [value]="sem">Semester {{ sem }}</option></select></label>
              <label>Subject <select [(ngModel)]="resourceSubject"><option value="ALL">All subjects</option><option *ngFor="let s of filteredTeacherSubjects" [value]="s.id">{{ s.branch?.code }} · Sem {{ s.semester }} · {{ s.name }}</option></select></label>
              <button type="button" (click)="loadTeacherLibrary()">↻ Refresh library</button>
            </div>
            <div class="teacher-resource-list"><article *ngFor="let doc of filteredDocuments" class="teacher-resource-card"><div class="teacher-resource-symbol">▤</div><div class="teacher-resource-details"><strong>{{ doc.title }}</strong><small>{{ doc.subject?.branch?.code }} · Semester {{ doc.subject?.semester }} · {{ doc.subject?.name }}</small><span>{{ doc.type === 'PAPER' ? 'Question paper · ' + (doc.examType || '') + ' ' + (doc.academicYear || '') : 'Study resource · Module ' + (doc.moduleNumber || '—') }}</span></div><button type="button" (click)="openDocument(doc)">View PDF ↗</button></article></div>
            <div *ngIf="filteredDocuments.length === 0" class="teacher-library-empty">No matching resources yet. Change your filters or publish the first document.</div>
          </section>
          <section *ngIf="teacherTab === 'upload'">
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
          </section>
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
  branches: any[] = [];
  resourceBranch = 'ALL';
  resourceSemester = 'ALL';
  get filteredTeacherSubjects(): any[] {
    return this.subjects.filter(s =>
      (this.resourceBranch === 'ALL' || String(s.branch?.id) === this.resourceBranch) &&
      (this.resourceSemester === 'ALL' || String(s.semester) === this.resourceSemester));
  }
  teacherTab: 'browse' | 'upload' = 'browse';
  resourceSearch = '';
  resourceType: 'ALL' | 'RESOURCE' | 'PAPER' = 'ALL';
  resourceSubject = 'ALL';
  get filteredDocuments(): any[] {
    const q = this.resourceSearch.trim().toLowerCase();
    return this.documents.filter(doc =>
      (this.resourceType === 'ALL' || doc.type === this.resourceType) &&
      (this.resourceBranch === 'ALL' || String(doc.subject?.branch?.id) === this.resourceBranch) &&
      (this.resourceSemester === 'ALL' || String(doc.subject?.semester) === this.resourceSemester) &&
      (this.resourceSubject === 'ALL' || String(doc.subject?.id) === this.resourceSubject) &&
      (!q || [doc.title, doc.subject?.name, doc.subject?.code, doc.subject?.branch?.name, doc.subject?.branch?.code]
        .some(v => String(v || '').toLowerCase().includes(q)))
    );
  }
  loadTeacherLibrary(): void {
    this.api.get('/branches').subscribe({ next: branches => this.branches = branches, error: () => this.error = 'Could not load branches.' });
    this.api.get('/subjects').subscribe({ next: subjects => this.subjects = subjects, error: () => this.error = 'Could not load subjects.' });
    this.api.get('/documents').subscribe({ next: documents => this.documents = documents, error: () => this.error = 'Could not load documents.' });
  }
  openDocument(doc: any): void {
    this.error = '';
    this.api.getPdf(doc.id).subscribe({
      next: blob => { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); },
      error: () => this.error = 'Unable to open this PDF.'
    });
  }
  documents: any[] = [];
  pdf: File | null = null;
  newDoc = { subjectId: '', title: '', type: 'RESOURCE', moduleNumber: '', examType: '', academicYear: '' };
  claims: any[] = [];
  inventory: any[] = [];
  staffFilter: 'ALL' | 'LOST' | 'FOUND' = 'ALL';
  staffSearch = '';
  get filteredInventory(): any[] {
    const q = this.staffSearch.trim().toLowerCase();
    return this.inventory.filter(i => (this.staffFilter === 'ALL' || i.kind === this.staffFilter) &&
      (!q || [i.title, i.description, i.location, i.category].some(v => String(v || '').toLowerCase().includes(q))));
  }
  get selectedStaffItem(): any { return this.inventory.find(i => i.id === this.itemId) || null; }
  countItems(kind: string): number { return this.inventory.filter(i => i.kind === kind).length; }
  countInCustody(): number { return this.inventory.filter(i => i.custodyAcceptedAt && i.status === 'OPEN').length; }
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
    if (this.section === 'teacher') this.loadTeacherLibrary();
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
      next: () => { this.busy = false; this.pdf = null; this.newDoc = { subjectId: '', title: '', type: 'RESOURCE', moduleNumber: '', examType: '', academicYear: '' }; this.notice = 'Resource published successfully.'; this.teacherTab = 'browse'; this.loadTeacherLibrary(); },
      error: (err: any) => { this.busy = false; this.error = err.error?.message || 'Upload failed.'; }
    });
  }
  intake(): void {
    if (!this.itemId || this.selectedStaffItem?.kind !== 'FOUND' || !this.storageLocation.trim()) return;
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
    this.claims = [];
    if (item.kind === 'FOUND') this.loadClaims();
  }
  loadClaims(): void {
    if (!this.itemId || this.selectedStaffItem?.kind !== 'FOUND') return;
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
