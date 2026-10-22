import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CampusIconComponent } from './campus-icon.component';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, CampusIconComponent],
  template: `
    <div class="role-portal" [class.teacher-portal]="section === 'teacher'">
      <aside class="portal-sidebar">
        <div class="brand"><span class="brand-icon"><cc-icon name="spark" /></span><div>campus<span>connect</span><small>YOUR COLLEGE, CONNECTED</small></div></div>
        <p class="nav-label">{{ label }} WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          <ng-container *ngIf="section === 'teacher'">
            <button type="button" [class.active]="teacherTab === 'browse' && teacherLibraryType === 'RESOURCE'" (click)="teacherTab = 'browse'; chooseTeacherType('RESOURCE')"><cc-icon name="book" />Study resources<span class="nav-count">{{ studyResourceCount }}</span></button>
            <button type="button" [class.active]="teacherTab === 'browse' && teacherLibraryType === 'PAPER'" (click)="teacherTab = 'browse'; chooseTeacherType('PAPER')"><cc-icon name="file" />Question papers</button>
            <button type="button" [class.active]="teacherTab === 'upload'" (click)="openTeacherUpload()"><cc-icon name="upload" />Publish a resource</button>
          </ng-container>
          <button type="button" *ngIf="section === 'staff'" [class.active]="staffTab === 'operations'" [disabled]="busy" (click)="staffTab = 'operations'; loadItems()"><cc-icon name="search" />Lost &amp; Found<span class="nav-count">{{ inventory.length }}</span></button>
          <button type="button" *ngIf="section === 'staff'" [class.active]="staffTab === 'storage'" [disabled]="busy" (click)="staffTab = 'storage'; loadItems()"><cc-icon name="folder" />Physical storage<span class="nav-count">{{ countInCustody() }}</span></button>
          <button type="button" (click)="openProfile()"><cc-icon name="shield" />My profile</button>
        </nav>
        <div class="portal-sidebar-bottom"><div class="workspace-note"><cc-icon name="campus" /><strong>A more connected campus.</strong><p>{{ section === 'teacher' ? 'Your knowledge. Their next breakthrough.' : 'Small acts of care. A big difference.' }}</p></div><div class="sidebar-account"><span class="avatar">{{ user?.name?.[0] || 'C' }}</span><div><strong>{{ user?.name || label }}</strong><small>{{ label }} account</small></div></div><button type="button" class="sidebar-logout" (click)="logout()"><cc-icon name="logout" />Sign out</button></div>
      </aside>
      <main class="portal-main">
      <header class="portal-topbar"><div class="breadcrumb">Workspace <span>/</span><b>{{ section === 'teacher' ? (teacherTab === 'upload' ? 'Resource studio' : 'Academic library') : (staffTab === 'storage' ? 'Physical storage' : 'Lost & Found') }}</b></div><div class="portal-topbar-right"><span class="status">● BMSCE campus</span><span class="avatar">{{ user?.name?.[0] || 'C' }}</span></div></header>
      <div class="portal-content">
      <section class="role-portal-welcome">
        <div class="welcome-copy"><p class="eyebrow">{{ section === 'teacher' ? 'THE FACULTY WORKSPACE' : 'THE CAMPUS CARE DESK' }}</p>
        <h1>{{ section === 'teacher' ? 'Good teaching starts' : 'Every belonging' }}<br><em>{{ section === 'teacher' ? 'with a little sharing.' : 'has a way home.' }}</em></h1>
        <p>{{ section === 'teacher' ? 'A thoughtful home for your notes, question papers and everything your students need to move forward.' : 'Receive, safeguard and reunite. Manage campus reports and verified handovers in one place.' }}</p>
        <button type="button" class="hero-publish" *ngIf="section === 'teacher'" (click)="openTeacherUpload()"><cc-icon name="upload" />Publish a resource<cc-icon name="arrow" /></button>
        </div>
        <div class="faculty-art" *ngIf="section === 'teacher'" aria-hidden="true"><div class="art-orbit"></div><div class="art-note art-note-back"><span>IDEAS WORTH SHARING</span><i></i><i></i><i></i></div><div class="art-note art-note-front"><cc-icon name="book" /><strong>Knowledge,<br>passed forward.</strong><span>THE CAMPUS COLLECTION</span></div><div class="art-seal"><cc-icon name="spark" /></div></div>
        <div class="care-art" *ngIf="section === 'staff'" aria-hidden="true"><cc-icon name="shield" /></div>
      </section>
      <section class="role-portal-grid">
        <article *ngIf="section === 'staff'" class="staff-workspace">
          <div class="portal-section-head"><span class="portal-icon"><cc-icon name="search" /></span><div><h2>{{ staffTab === 'storage' ? 'Physical storage dashboard' : 'Lost & Found operations' }}</h2><p>{{ staffTab === 'storage' ? 'Track secure locations, receiving staff and storage history. Open a case to review claims or record handover.' : 'Review every report, receive found property, verify claims, and record safe handovers.' }}</p></div></div>
          <p *ngIf="error" class="role-login-error">{{ error }}</p><p *ngIf="notice" class="teacher-notice">{{ notice }}</p>
          <div class="staff-dashboard-kpis">
            <div><strong>{{ inventory.length }}</strong><span>All reports</span></div>
            <div><strong>{{ countItems('LOST') }}</strong><span>Lost reports</span></div>
            <div><strong>{{ countItems('FOUND') }}</strong><span>Found reports</span></div>
            <div><strong>{{ countInCustody() }}</strong><span>In custody</span></div>
          </div>
          <ng-container *ngIf="staffTab === 'operations'">
          <div class="staff-toolbar">
            <nav class="staff-filter-tabs" aria-label="Report filter">
              <button type="button" [class.selected]="staffFilter === 'ALL'" (click)="staffFilter = 'ALL'">All reports</button>
              <button type="button" [class.selected]="staffFilter === 'LOST'" (click)="staffFilter = 'LOST'">Lost</button>
              <button type="button" [class.selected]="staffFilter === 'FOUND'" (click)="staffFilter = 'FOUND'">Found</button>
            </nav>
            <input aria-label="Search reported items" [(ngModel)]="staffSearch" placeholder="Search item, description, location">
            <button type="button" [disabled]="busy" (click)="loadItems()">↻ Refresh</button>
          </div>
          <div class="staff-inventory">
            <button type="button" *ngFor="let item of filteredInventory" class="inventory-entry" [class.selected]="item.id === itemId" [disabled]="busy" (click)="selectItem(item)">
              <div class="staff-report-thumb"><img *ngIf="staffPhotos[item.id]" [src]="staffPhotos[item.id]" [alt]="'Photo of ' + item.title" loading="lazy"><cc-icon *ngIf="!staffPhotos[item.id]" [name]="item.kind === 'LOST' ? 'search' : 'folder'" /></div>
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
            <div class="staff-case-overview"><div class="staff-case-photo"><img *ngIf="staffPhotos[selected.id]" [src]="staffPhotos[selected.id]" [alt]="'Uploaded photo of ' + selected.title"><cc-icon *ngIf="!staffPhotos[selected.id]" name="folder" /></div><div><h3>Report details</h3><p>{{ selected.description }}</p><p><strong>Category:</strong> {{ selected.category }}</p><p><strong>Reported by:</strong> {{ selected.postedBy }}</p><p><strong>Reported on:</strong> {{ selected.createdAt | date:'medium' }}</p></div></div>
            <p><strong>Reported location:</strong> {{ selected.location || 'Not specified' }}</p>
            <ng-container *ngIf="selected.kind === 'LOST'">
              <p class="staff-info-note">Review ownership claims below. Receive the item only when it is physically present; verify ownership before handover.</p>
              <label *ngIf="selected.status === 'OPEN' && !selected.custodyAcceptedAt && claims.length === 0"><input type="checkbox" [(ngModel)]="recoveryConfirmed"> I have verified that this lost item has been recovered.</label>
              <button type="button" *ngIf="selected.status === 'OPEN' && !selected.custodyAcceptedAt && claims.length === 0" [disabled]="busy || !recoveryConfirmed" (click)="resolveLostReport()">Mark lost report resolved</button>
            </ng-container>
            <ng-container>
              <div *ngIf="selected.status === 'OPEN' && !selected.custodyAcceptedAt" class="staff-intake-form">
                <h3>1. Receive item into custody</h3>
                <p class="staff-info-note">This item has no confirmed storage receipt yet. Typing a location does not save it; click Confirm physical intake once.</p>
                <p>Confirm the item is physically present and record its exact secure storage location.</p>
                <label>Storage location <input [(ngModel)]="storageLocation" maxlength="255" placeholder="e.g. Lost & Found desk · Locked cabinet A1"></label>
                <button type="button" [disabled]="busy || !storageLocation.trim()" (click)="intake()">Confirm physical intake</button>
              </div>
              <div *ngIf="selected.custodyAcceptedAt" class="staff-custody-confirmed">
                <strong>{{ selected.status === 'RESOLVED' ? '✓ Storage receipt · item resolved' : '✓ Physical intake confirmed' }}</strong>
                <dl class="custody-receipt"><div><dt>Item</dt><dd>#{{ selected.id }} · {{ selected.title }}</dd></div><div><dt>Storage location</dt><dd>{{ selected.custodyLocation }}</dd></div><div><dt>Received by</dt><dd>{{ selected.custodyAcceptedBy }}</dd></div><div><dt>Received on</dt><dd>{{ selected.custodyAcceptedAt | date:'medium' }}</dd></div></dl>
              </div>
              <div class="staff-case-feedback" *ngIf="error || notice || busy" [class.has-error]="!!error" [attr.role]="error ? 'alert' : 'status'" aria-live="polite">{{ error || (busy ? 'Saving your action…' : notice) }}</div>
              <h3>2. Verify ownership claims</h3>
              <p>Review the claimant's private description and evidence before approval.</p>
              <p class="staff-info-note" *ngIf="selected.status === 'OPEN' && !selected.custodyAcceptedAt">Approval is unavailable until the physical intake above is successfully saved.</p>
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
          </ng-container>
          <ng-container *ngIf="staffTab === 'storage'">
            <div class="staff-toolbar">
              <input aria-label="Search physical storage" [(ngModel)]="storageSearch" placeholder="Search item, locker or receiving staff">
              <button type="button" [disabled]="busy" (click)=…2652 tokens truncated…gIf="teacherTab === 'browse'"><div class="rail-title"><cc-icon name="grid" /><h3>At a glance</h3></div><div class="collection-total"><strong>{{ documents.length }}</strong><span>resources, ready to discover</span></div><dl><div><dt>Academic branches</dt><dd>{{ branches.length }}</dd></div><div><dt>Course subjects</dt><dd>{{ subjects.length }}</dd></div><div><dt>Study resources</dt><dd>{{ studyResourceCount }}</dd></div><div><dt>Question papers</dt><dd>{{ documents.length - studyResourceCount }}</dd></div></dl></section>
            <section class="resource-preview" *ngIf="teacherTab === 'upload'"><p class="eyebrow">YOUR NEXT RESOURCE</p><div class="preview-cover"><cc-icon [name]="newDoc.type === 'PAPER' ? 'file' : 'book'" /><span>{{ newDoc.type === 'PAPER' ? 'QUESTION PAPER' : 'STUDY RESOURCE' }}</span></div><h3>{{ newDoc.title || 'A fresh perspective starts here.' }}</h3><p>{{ pdf?.name || 'Add your PDF to complete this resource.' }}</p></section>
            <section class="teacher-rail-note"><span class="note-spark"><cc-icon name="spark" /></span><h3>A little sharing.<br>A lasting impact.</h3><p>One useful note can make a difficult concept click. Add something your students will thank you for.</p><button type="button" *ngIf="teacherTab === 'browse'" (click)="openTeacherUpload()">Share your knowledge<cc-icon name="arrow" /></button><p *ngIf="teacherTab === 'upload'" class="upload-checklist">01 · Choose the right subject<br>02 · Give it a clear title<br>03 · Add your PDF and publish</p></section>
          </aside>
          </div>
        </article>
      </section>
      <footer class="workspace-footer"><span>CAMPUS CONNECT</span><span>A little closer. A lot more connected.</span></footer>
      </div>
      </main>
    </div>
  `
})
export class RolePortalComponent implements OnInit {
  section = this.route.snapshot.data['section'] as string;
  label = this.section === 'staff' ? 'Staff' : 'Teacher';
  user: any;
  subjects: any[] = [];
  get studyResourceCount(): number { return this.documents.filter(d => d.type === 'RESOURCE').length; }
  teacherLibraryType: 'RESOURCE' | 'PAPER' = 'RESOURCE';
  teacherStep: 'branch' | 'semester' | 'subject' | 'folder' | 'year' | 'documents' = 'branch';
  teacherBranch: any = null;
  teacherSemester: number | null = null;
  teacherSubject: any = null;
  teacherModule: number | null = null;
  teacherExam = '';
  teacherYear = '';
  chooseTeacherType(type: 'RESOURCE' | 'PAPER'): void {
    this.teacherLibraryType = type; this.teacherStep = 'branch';
    this.teacherBranch = null; this.teacherSemester = null; this.teacherSubject = null;
    this.teacherModule = null; this.teacherExam = ''; this.teacherYear = '';
  }
  teacherBack(): void {
    const prev: Record<string, string> = { semester: 'branch', subject: 'semester', folder: 'subject', year: 'folder', documents: this.teacherLibraryType === 'RESOURCE' ? 'folder' : 'year' };
    this.teacherStep = (prev[this.teacherStep] || 'branch') as typeof this.teacherStep;
  }
  get teacherFolderSubjects(): any[] {
    return this.subjects.filter(s => String(s.branch?.id) === String(this.teacherBranch?.id) && Number(s.semester) === this.teacherSemester);
  }
  get teacherYears(): string[] {
    return [...new Set(this.documents.filter(d => d.type === 'PAPER' &&
      String(d.subject?.id) === String(this.teacherSubject?.id) &&
      String(d.examType || '').replace(/\s+/g, ' ').trim().toUpperCase() === this.teacherExam.toUpperCase() &&
      d.academicYear).map(d => String(d.academicYear)))].sort().reverse();
  }
  get teacherFolderDocuments(): any[] {
    return this.documents.filter(d => String(d.subject?.id) === String(this.teacherSubject?.id) &&
      d.type === this.teacherLibraryType &&
      (this.teacherLibraryType === 'RESOURCE' ? Number(d.moduleNumber) === this.teacherModule :
        String(d.examType || '').replace(/\s+/g, ' ').trim().toUpperCase() === this.teacherExam.toUpperCase() && String(d.academicYear) === this.teacherYear));
  }
  branches: any[] = [];
  resourceBranch = 'ALL';
  resourceSemester = 'ALL';
  get filteredTeacherSubjects(): any[] {
    return this.subjects.filter(s =>
      (this.resourceBranch === 'ALL' || String(s.branch?.id) === this.resourceBranch) &&
      (this.resourceSemester === 'ALL' || String(s.semester) === this.resourceSemester));
  }
  teacherTab: 'browse' | 'upload' = 'browse';
  openTeacherUpload(): void {
    this.teacherTab = 'upload';
    setTimeout(() => document.querySelector('.teacher-heading')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    }));
  }
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
  openProfile(): void { this.router.navigateByUrl('/' + this.section + '/profile'); }
  staffTab: 'operations' | 'storage' = 'operations';
  storageSearch = '';
  get filteredStoredItems(): any[] {
    const q = this.storageSearch.trim().toLowerCase();
    return this.storedItems.filter(item => !q || [item.id, item.title, item.custodyLocation,
      item.custodyAcceptedBy, item.status].some(value => String(value || '').toLowerCase().includes(q)));
  }
  inventory: any[] = [];
  private inventoryGeneration = 0;
  private claimsGeneration = 0;
  get storedItems(): any[] { return this.inventory.filter(item => !!item.custodyAcceptedAt); }
  private updateInventoryItem(item: any): void {
    const index = this.inventory.findIndex(existing => existing.id === item.id);
    this.inventory = index < 0 ? [...this.inventory, item]
      : this.inventory.map(existing => existing.id === item.id ? { ...existing, ...item } : existing);
  }
  private staffError(err: any, fallback: string): string {
    return err.error?.detail || err.error?.error || err.error?.message || fallback;
  }
  recoveryConfirmed = false;
  staffFilter: 'ALL' | 'LOST' | 'FOUND' = 'ALL';
  staffSearch = '';
  get filteredInventory(): any[] {
    const q = this.staffSearch.trim().toLowerCase();
    return this.inventory.filter(i => (this.staffFilter === 'ALL' || i.kind === this.staffFilter) &&
      (!q || [String(i.id), i.title, i.description, i.location, i.category, i.custodyLocation, i.custodyAcceptedBy].some(v => String(v || '').toLowerCase().includes(q))));
  }
  get selectedStaffItem(): any { return this.inventory.find(i => i.id === this.itemId) || null; }
  countItems(kind: string): number { return this.inventory.filter(i => i.kind === kind).length; }
  countInCustody(): number { return this.inventory.filter(i => i.custodyAcceptedAt && i.status === 'OPEN').length; }
  itemId: number | null = null;
  storageLocation = '';
  evidenceUrls: Record<number, string> = {};
  staffPhotos: Record<number, string> = {};
  private staffPhotoGeneration = 0;
  private loadStaffPhotos(items: any[]): void {
    const generation = ++this.staffPhotoGeneration;
    Object.values(this.staffPhotos).forEach(url => URL.revokeObjectURL(url));
    this.staffPhotos = {};
    items.forEach(item => {
      this.api.get('/items/' + item.id + '/images').subscribe({
        next: (images: any[]) => {
          if (generation !== this.staffPhotoGeneration || !images?.length) return;
          this.api.getImage(images[0].id).subscribe({
            next: blob => {
              if (generation !== this.staffPhotoGeneration) return;
              const url = URL.createObjectURL(blob);
              if (this.staffPhotos[item.id]) URL.revokeObjectURL(this.staffPhotos[item.id]);
              this.staffPhotos[item.id] = url;
            }
          });
        }
      });
    });
  }
  busy = false;
  notice = '';
  error = '';
  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}
  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'storage') this.staffTab = 'storage';
    if (tab === 'upload') this.teacherTab = 'upload';
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
    const item = this.selectedStaffItem;
    if (this.busy || !item) return;
    if (item.custodyAcceptedAt) { this.notice = 'Intake is already saved at ' + item.custodyLocation + '.'; return; }
    if (item.status !== 'OPEN' || !this.storageLocation.trim()) {
      this.error = 'Choose an open report and enter its storage location.'; return;
    }
    const itemId = item.id;
    this.busy = true; this.error = ''; this.notice = '';
    ++this.inventoryGeneration; // Ignore inventory reads started before this write.
    this.api.put('/staff/items/' + itemId + '/intake', { storageLocation: this.storageLocation.trim() }).subscribe({
      next: receipt => {
        this.updateInventoryItem(receipt);
        this.storageLocation = receipt.custodyLocation;
        this.busy = false;
        this.notice = 'Physical intake saved: ' + receipt.title + ' · ' + receipt.custodyLocation + '.';
        this.loadItems();
      },
      error: err => { this.busy = false; this.error = this.staffError(err, 'Unable to save intake. Refresh this case to check its current receipt.'); }
    });
  }
  resolveLostReport(): void {
    if (this.busy || !this.recoveryConfirmed || this.selectedStaffItem?.kind !== 'LOST'
        || this.selectedStaffItem?.status !== 'OPEN') return;
    this.busy = true;
    this.error = '';
    this.api.put('/items/' + this.itemId + '/close', {}).subscribe({
      next: () => {
        this.busy = false;
        this.recoveryConfirmed = false;
        this.notice = 'Lost report resolved after confirmed recovery.';
        this.loadItems();
      },
      error: (err: any) => { this.busy = false; this.error = err.error?.message || 'Unable to resolve report.'; }
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
    const generation = ++this.inventoryGeneration;
    this.api.get('/staff/items/inventory').subscribe({
      next: (items: any[]) => {
        if (generation !== this.inventoryGeneration) return;
        this.inventory = items;
        this.loadStaffPhotos(items);
        if (this.selectedStaffItem?.custodyAcceptedAt) this.storageLocation = this.selectedStaffItem.custodyLocation;
      },
      error: () => { if (generation === this.inventoryGeneration) this.error = 'Unable to refresh inventory. Your last saved receipt is still shown.'; }
    });
  }
  selectItem(item: any): void {
    if (this.busy) return;
    this.recoveryConfirmed = false; this.error = ''; this.notice = '';
    this.staffTab = 'operations';
    this.itemId = item.id;
    this.storageLocation = item.custodyLocation || '';
    this.claims = [];
    this.loadClaims();
  }
  loadClaims(): void {
    if (!this.itemId) return;
    const itemId = this.itemId;
    const generation = ++this.claimsGeneration;
    this.api.get('/staff/items/' + itemId + '/claims').subscribe({
      next: claims => { if (itemId === this.itemId && generation === this.claimsGeneration) this.claims = claims; },
      error: () => { if (itemId === this.itemId && generation === this.claimsGeneration) this.error = 'Unable to refresh claims. Try again.'; }
    });
  }
  review(claim: any, approve: boolean): void {
    if (this.busy || claim.status !== 'PENDING') return;
    if (approve && !this.selectedStaffItem?.custodyAcceptedAt) {
      this.error = 'Save the physical intake before approving this claim.'; return;
    }
    this.busy = true; this.error = ''; this.notice = '';
    ++this.claimsGeneration;
    this.api.put('/staff/claims/' + claim.id + '/review', { approve }).subscribe({
      next: reviewed => {
        this.claims = this.claims.map(existing => existing.id === reviewed.id ? { ...existing, ...reviewed } : existing);
        this.busy = false;
        this.notice = approve ? 'Claim approved. Verify the student ID and pickup reference before handover.' : 'Claim rejected.';
        this.loadClaims();
      },
      error: err => { this.busy = false; this.error = this.staffError(err, 'Review failed. Check custody, disputes and reviewer eligibility.'); }
    });
  }
  handover(claim: any): void {
    if (this.busy) return;
    if (!claim.collegeIdChecked || !claim.enteredReference?.trim()) {
      this.error = 'Check the college ID and enter the pickup reference.'; return;
    }
    this.busy = true; this.error = ''; this.notice = '';
    ++this.claimsGeneration; ++this.inventoryGeneration;
    this.api.put('/staff/claims/' + claim.id + '/handover', {
      pickupReference: claim.enteredReference.trim(), collegeIdChecked: claim.collegeIdChecked
    }).subscribe({
      next: handedOver => {
        this.claims = this.claims.map(existing => existing.id === handedOver.id ? { ...existing, ...handedOver } : existing);
        const item = this.inventory.find(existing => existing.id === handedOver.itemId);
        if (item) this.updateInventoryItem({ ...item, status: 'RESOLVED' });
        this.busy = false; this.notice = 'Verified handover recorded. The storage receipt remains in the register.';
        this.loadClaims(); this.loadItems();
      },
      error: err => { this.busy = false; this.error = this.staffError(err, 'Handover failed. Check the student ID and pickup reference.'); }
    });
  }
  logout(): void {
    sessionStorage.removeItem('cc_auth');
    this.router.navigateByUrl('/' + this.section + '/login');
  }
}
