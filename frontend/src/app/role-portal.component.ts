import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountLinkComponent } from './account-link.component';
import { CampusIconComponent } from './campus-icon.component';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, CampusIconComponent, AccountLinkComponent],
  templateUrl: './role-portal.component.html'
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
