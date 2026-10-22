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
              <div class="staff-report-thumb"><img *ngIf="staffPhotos[item.id]" [src]="staffPhotos[item.id]" [alt]="'Photo of ' + item.title" loading="lazy"><span *ngIf="!staffPhotos[item.id]">{{ item.kind === 'LOST' ? '🔎' : '📦' }}</span></div>
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
            <div class="staff-case-overview"><div class="staff-case-photo"><img *ngIf="staffPhotos[selected.id]" [src]="staffPhotos[selected.id]" [alt]="'Uploaded photo of ' + selected.title"><span *ngIf="!staffPhotos[selected.id]">📦</span></div><div><h3>Report details</h3><p>{{ selected.description }}</p><p><strong>Category:</strong> {{ selected.category }}</p><p><strong>Reported by:</strong> {{ selected.postedBy }}</p><p><strong>Reported on:</strong> {{ selected.createdAt | date:'medium' }}</p></div></div>
            <p><strong>Reported location:</strong> {{ selected.location || 'Not specified' }}</p>
            <ng-container *ngIf="selected.kind === 'LOST'">
              <p class="staff-info-note">Review this lost report and confirm recovery before closing it. Found property must go through intake and verified handover.</p>
              <label *ngIf="selected.status === 'OPEN'"><input type="checkbox" [(ngModel)]="recoveryConfirmed"> I have verified that this lost item has been recovered.</label>
              <button type="button" *ngIf="selected.status === 'OPEN'" [disabled]="busy || !recoveryConfirmed" (click)="resolveLostReport()">Mark lost report resolved</button>
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
          <section *ngIf="teacherTab === 'browse'" class="teacher-hierarchy">
            <div class="portal-section-head"><span class="portal-icon">▤</span><div><h2>{{ teacherLibraryType === 'RESOURCE' ? 'Study Resources' : 'Question Papers' }}</h2><p>Browse the same academic folders as students: branch, semester, subject and PDF.</p></div></div>
            <nav class="teacher-type-switch"><button type="button" [class.selected]="teacherLibraryType === 'RESOURCE'" (click)="chooseTeacherType('RESOURCE')">▤ Study resources</button><button type="button" [class.selected]="teacherLibraryType === 'PAPER'" (click)="chooseTeacherType('PAPER')">▧ Question papers</button></nav>
            <div class="teacher-breadcrumbs"><button type="button" (click)="teacherStep = 'branch'">Branches</button><ng-container *ngIf="teacherBranch"> / <button type="button" (click)="teacherStep = 'semester'">{{ teacherBranch.name }}</button></ng-container><ng-container *ngIf="teacherSemester"> / <button type="button" (click)="teacherStep = 'subject'">Semester {{ teacherSemester }}</button></ng-container><ng-container *ngIf="teacherSubject"> / <button type="button" (click)="teacherStep = 'folder'">{{ teacherSubject.name }}</button></ng-container><ng-container *ngIf="teacherStep === 'documents'"> / PDFs</ng-container></div>
            <div *ngIf="teacherStep !== 'branch'" class="teacher-back-row"><button type="button" (click)="teacherBack()">← Back</button></div>
            <ng-container *ngIf="teacherStep === 'branch'"><h3>Select your branch</h3><p>Choose your academic department.</p><div class="teacher-folder-grid"><button type="button" *ngFor="let b of branches" class="teacher-folder" (click)="teacherBranch = b; teacherStep = 'semester'"><span class="teacher-folder-icon">🏫</span><small>{{ b.code }}</small><strong>{{ b.name }}</strong><em>Open branch →</em></button></div><p *ngIf="!branches.length" class="teacher-library-empty">No branches available.</p></ng-container>
            <ng-container *ngIf="teacherStep === 'semester'"><h3>{{ teacherBranch?.name }}</h3><p>Select your semester.</p><div class="teacher-folder-grid"><button type="button" *ngFor="let sem of [1,2,3,4,5,6,7,8]" class="teacher-folder" (click)="teacherSemester = sem; teacherStep = 'subject'"><span class="teacher-folder-icon">📚</span><strong>Semester {{ sem }}</strong><em>View subjects →</em></button></div></ng-container>
            <ng-container *ngIf="teacherStep === 'subject'"><h3>Semester {{ teacherSemester }}</h3><p>Select a subject.</p><div class="teacher-folder-grid"><button type="button" *ngFor="let s of teacherFolderSubjects" class="teacher-folder" (click)="teacherSubject = s; teacherStep = 'folder'"><span class="teacher-folder-icon">📘</span><small>{{ s.code }}</small><strong>{{ s.name }}</strong><em>Open subject →</em></button></div><p *ngIf="!teacherFolderSubjects.length" class="teacher-library-empty">No subjects have been added for this semester.</p></ng-container>
            <ng-container *ngIf="teacherStep === 'folder'"><h3>{{ teacherSubject?.name }}</h3><p>{{ teacherLibraryType === 'RESOURCE' ? 'Select a module to view study PDFs.' : 'Select an examination.' }}</p><div class="teacher-folder-grid"><button type="button" *ngFor="let n of (teacherLibraryType === 'RESOURCE' ? [1,2,3,4,5] : [])" class="teacher-folder" (click)="teacherModule = n; teacherStep = 'documents'"><span class="teacher-folder-icon">📁</span><strong>Module {{ n }}</strong><em>View PDFs →</em></button><button type="button" *ngFor="let exam of (teacherLibraryType === 'PAPER' ? ['CIE 1','CIE 2','CIE 3','SEE','SUPPLEMENTARY'] : [])" class="teacher-folder" (click)="teacherExam = exam; teacherStep = 'year'"><span class="teacher-folder-icon">📁</span><strong>{{ exam }}</strong><em>View years →</em></button></div></ng-container>
            <ng-container *ngIf="teacherStep === 'year'"><h3>{{ teacherExam }}</h3><p>Select the academic year.</p><div class="teacher-folder-grid"><button type="button" *ngFor="let year of teacherYears" class="teacher-folder" (click)="teacherYear = year; teacherStep = 'documents'"><span class="teacher-folder-icon">📅</span><strong>{{ year }}</strong><em>View PDFs →</em></button></div><p *ngIf="!teacherYears.length" class="teacher-library-empty">No papers uploaded for this exam yet.</p></ng-container>
            <ng-container *ngIf="teacherStep === 'documents'"><h3>{{ teacherLibraryType === 'RESOURCE' ? 'Module ' + teacherModule : teacherExam + ' · ' + teacherYear }}</h3><p>{{ teacherFolderDocuments.length }} PDFs available</p><div class="teacher-resource-list"><article *ngFor="let doc of teacherFolderDocuments" class="teacher-resource-card"><div class="teacher-resource-symbol">PDF</div><div class="teacher-resource-details"><strong>{{ doc.title }}</strong><small>{{ doc.subject?.branch?.code }} · Semester {{ doc.subject?.semester }} · {{ doc.subject?.name }}</small></div><button type="button" (click)="openDocument(doc)">View PDF ↗</button></article></div><div *ngIf="!teacherFolderDocuments.length" class="teacher-library-empty">No PDFs uploaded yet. Use Upload Resource to add one.</div></ng-container>
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
  recoveryConfirmed = false;
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
    this.api.get('/staff/items/inventory').subscribe({
      next: (items: any[]) => { this.inventory = items; this.loadStaffPhotos(items); },
      error: () => this.error = 'Unable to load inventory.'
    });
  }
  selectItem(item: any): void {
    this.recoveryConfirmed = false;
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
