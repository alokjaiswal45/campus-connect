
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { destination } from './portal-routing';
import { ApiService } from './api.service';

type LibraryStep =
  | 'branch'
  | 'semester'
  | 'subject'
  | 'folder'
  | 'year'
  | 'documents';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

  page = 'dashboard';

  user: any = null;

  email = '';
  password = '';
  name = '';

  registerMode = false;
  otpMode = false;
  otp = '';

  error = '';
  notice = '';
  loading = false;

  branches: any[] = [];
  subjects: any[] = [];
  docs: any[] = [];
  items: any[] = [];
  lostFilter: 'ALL' | 'LOST' | 'FOUND' | 'UNRESOLVED' = 'ALL';
  selectedItem: any = null;
  claimAnswer = '';
  reportPhoto: File | null = null;
  evidencePhoto: File | null = null;
  itemPhotoUrls: string[] = [];
  private revokeItemPhotos(): void {
    this.itemPhotoUrls.forEach(url => URL.revokeObjectURL(url));
    this.itemPhotoUrls = [];
  }
  chooseReportPhoto(event: Event): void {
    this.reportPhoto = (event.target as HTMLInputElement).files?.[0] || null;
  }
  chooseEvidencePhoto(event: Event): void {
    this.evidencePhoto = (event.target as HTMLInputElement).files?.[0] || null;
  }
  private uploadPhoto(path: string, file: File, message: string): void {
    this.api.uploadImage(path, file).subscribe({
      next: () => this.notice = message,
      error: () => this.error = 'Report saved, but image upload failed. Use JPEG or PNG under 5 MB.'
    });
  }
  private loadItemPhotos(id: number): void {
    this.revokeItemPhotos();
    this.api.get('/items/' + id + '/images').subscribe({
      next: (photos: any[]) => photos.forEach(photo => this.api.getImage(photo.id).subscribe({
        next: blob => {
          if (this.selectedItem?.id === id) this.itemPhotoUrls.push(URL.createObjectURL(blob));
        }
      }))
    });
  }

  myClaims: any[] = [];
  myDisputes: any[] = [];
  disputeReasons: Record<number, string> = {};
  adminDisputes: any[] = [];
  disputeResolutions: Record<number, string> = {};
  openDispute(claim: any): void {
    const reason = (this.disputeReasons[claim.id] || '').trim();
    if (reason.length < 10) { this.error = 'Provide at least 10 characters.'; return; }
    this.api.post('/claims/' + claim.id + '/disputes', { reason }).subscribe({
      next: () => { this.notice = 'Dispute submitted for independent review.'; this.loadMyDisputes(); },
      error: () => this.error = 'Unable to open dispute.'
    });
  }
  loadMyDisputes(): void {
    this.api.get('/disputes/mine').subscribe({
      next: data => this.myDisputes = data,
      error: () => this.error = 'Unable to load disputes.'
    });
  }
  loadAdminDisputes(): void {
    this.api.get('/admin/disputes').subscribe({
      next: data => this.adminDisputes = data,
      error: () => this.error = 'Unable to load admin disputes.'
    });
  }
  resolveDispute(dispute: any, upholdClaim: boolean): void {
    const resolution = (this.disputeResolutions[dispute.id] || '').trim();
    if (resolution.length < 10) { this.error = 'Provide a resolution of at least 10 characters.'; return; }
    this.api.put('/admin/disputes/' + dispute.id + '/resolve', { resolution, upholdClaim }).subscribe({
      next: () => { this.notice = 'Dispute decision recorded.'; this.loadAdminDisputes(); },
      error: () => this.error = 'Unable to resolve dispute.'
    });
  }

  get visibleItems(): any[] {
    return this.items.filter(i => this.lostFilter === 'ALL' ||
      (this.lostFilter === 'UNRESOLVED' ? i.status === 'OPEN' : i.kind === this.lostFilter))
      .slice().reverse();
  }

  openItem(item: any): void {
    this.selectedItem = item;
    this.claimAnswer = '';
    this.loadItemPhotos(item.id);
  }
  closeItem(): void { this.selectedItem = null; this.revokeItemPhotos(); }

  submitClaim(): void {
    if (!this.selectedItem || this.claimAnswer.trim().length < 10) {
      this.error = 'Describe at least 10 characters of private ownership evidence.';
      return;
    }
    this.error = '';
    this.api.post('/items/' + this.selectedItem.id + '/claims', {
      ownershipAnswer: this.claimAnswer.trim()
    }).subscribe({
      next: (claim: any) => {
        this.notice = 'Claim submitted privately for staff review.';
        if (this.evidencePhoto) {
          this.uploadPhoto('/claims/' + claim.id + '/evidence', this.evidencePhoto,
            'Claim and private evidence image submitted.');
        }
        this.evidencePhoto = null;
        this.closeItem();
        this.claimAnswer = '';
        this.loadMyClaims();
        this.loadMyDisputes();
      },
      error: (err: any) => this.error = this.errorMessage(err, 'Unable to submit claim.')
    });
  }

  loadMyClaims(): void {
    if (!this.user) return;
    this.api.get('/claims/mine').subscribe({
      next: (claims: any[]) => this.myClaims = claims,
      error: () => this.error = 'Unable to load your claim history.'
    });
  }


  // Existing filters
  branchId = '';
  semester = '';
  subjectId = '';
  docType = '';
  examType = '';
  search = '';

  // Academic library navigation
  libraryStep: LibraryStep = 'branch';

  selectedLibraryBranch: any = null;
  selectedLibrarySemester: number | null = null;
  selectedLibrarySubject: any = null;

  selectedLibraryModule: number | null = null;
  selectedLibraryExam = '';
  selectedLibraryYear = '';

  // Admin forms
  newStaff = { name: '', email: '', password: '', role: 'TEACHER' };
  campusUsers: any[] = [];
  adminSection: 'overview' | 'people' | 'academics' | 'lostfound' = 'overview';
  peopleTab: 'STUDENT' | 'TEACHER' | 'STAFF' = 'STUDENT';
  peopleSearch = '';
  employeeFormOpen = false;
  employeeSaving = false;
  employeeTerminatingId: number | null = null;
  get filteredCampusUsers(): any[] {
    const query = this.peopleSearch.trim().toLowerCase();
    return this.campusUsers.filter(u => u.role === this.peopleTab &&
      (!query || [u.name, u.email, u.role].some((v: string) => String(v || '').toLowerCase().includes(query))));
  }
  countPeople(role: string): number { return this.campusUsers.filter(u => u.role === role).length; }
  selectAdminSection(section: 'overview' | 'people' | 'academics' | 'lostfound'): void {
    this.adminSection = section;
    if (section === 'people') this.loadCampusUsers();
    if (section === 'lostfound') { this.loadAdminStats(); this.loadAdminDisputes(); }
  }

  adminStats: Record<string, number> = {};
  loadAdminStats(): void {
    this.api.get('/admin/analytics').subscribe({
      next: stats => this.adminStats = stats,
      error: () => this.error = 'Unable to load campus analytics.'
    });
  }
  createStaff(): void {
    if (this.employeeSaving) return;
    this.error = '';
    this.employeeSaving = true;
    this.api.post('/admin/users/staff', this.newStaff).subscribe({
      next: () => {
        this.employeeSaving = false;
        this.notice = 'Employee account created.';
        this.employeeFormOpen = false;
        this.peopleTab = this.newStaff.role as 'TEACHER' | 'STAFF';
        this.newStaff = { name: '', email: '', password: '', role: 'TEACHER' };
        this.loadCampusUsers();
      },
      error: (err: any) => { this.employeeSaving = false; this.error = this.errorMessage(err, 'Unable to create employee account.'); }
    });
  }
  terminateEmployee(account: any): void {
    if (!confirm('Deactivate access for ' + account.email + '? Existing records will be preserved.')) return;
    this.employeeTerminatingId = account.id;
    this.api.put('/admin/users/' + account.id + '/terminate', {}).subscribe({
      next: () => { this.employeeTerminatingId = null; this.notice = 'Employee access deactivated.'; this.loadCampusUsers(); },
      error: (err: any) => { this.employeeTerminatingId = null; this.error = this.errorMessage(err, 'Unable to deactivate employee.'); }
    });
  }
  loadCampusUsers(): void {
    this.api.get('/admin/users').subscribe({
      next: users => this.campusUsers = users,
      error: () => this.error = 'Unable to load campus users.'
    });
  }

  newBranch = {
    code: '',
    name: ''
  };

  newSubject = {
    branchId: '',
    semester: 1,
    code: '',
    name: ''
  };

  newDoc: any = {
    subjectId: '',
    title: '',
    type: 'RESOURCE',
    moduleNumber: '',
    examType: '',
    academicYear: ''
  };

  file: File | null = null;

  // Lost and Found
  newItem: any = {
    title: '',
    description: '',
    location: '',
    category: 'Other',
    kind: 'LOST'
  };

  constructor(
    public api: ApiService,
    private http: HttpClient,
    private router: Router
  ) {}

  // ==========================================
  // INITIALIZATION
  // ==========================================

  ngOnInit(): void {

    const savedAuth = sessionStorage.getItem('cc_auth');

    if (!savedAuth) {
      this.page = 'login';
      return;
    }

    this.api.get('/auth/me').subscribe({
      next: (user: any) => {
        if (this.router.url.startsWith('/student/') && user.role !== 'STUDENT') {
          this.router.navigateByUrl(destination(user.role));
          return;
        }
        this.user = user;
        this.email = user.email || '';
        this.page = user.role === 'ADMIN' ? 'admin' : 'dashboard';
        this.refresh();
        this.loadMyClaims();
        if (this.isAdmin) { this.loadCampusUsers(); this.loadAdminStats(); this.loadAdminDisputes(); }
      },

      error: () => {
        this.logout();
      }
    });
  }

  get isAdmin(): boolean {
    return this.user?.role === 'ADMIN';
  }

  // ==========================================
  // ERROR HANDLING
  // ==========================================

  private errorMessage(err: any, fallback: string): string {

    const body = err?.error;

    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (typeof body?.error === 'string' && body.error.trim()) {
      return body.error;
    }

    if (typeof body?.message === 'string' && body.message.trim()) {
      return body.message;
    }

    return fallback;
  }

  // ==========================================
  // COLLEGE EMAIL VALIDATION
  // ==========================================

  isCollegeEmail(email: string): boolean {

    return /^[a-z0-9._%+-]+@bmsce\.ac\.in$/i.test(
      email.trim()
    );
  }

  // ==========================================
  // LOGIN
  // ==========================================

  login(): void {

    this.error = '';
    this.notice = '';

    const normalizedEmail = this.email.trim().toLowerCase();

    if (!this.isCollegeEmail(normalizedEmail)) {
      this.error =
        'Only @bmsce.ac.in college email addresses are allowed.';
      return;
    }

    if (!this.password) {
      this.error = 'Please enter your password.';
      return;
    }

    this.loading = true;

    const auth = btoa(
      normalizedEmail + ':' + this.password
    );

    sessionStorage.setItem('cc_auth', auth);

    this.api.get('/auth/me').subscribe({

      next: (user: any) => {
        if (this.router.url.startsWith('/student/') && user.role !== 'STUDENT') {
          sessionStorage.removeItem('cc_auth');
          this.loading = false;
          this.password = '';
          this.error = 'Only student accounts can sign in here. Use the Teacher, Staff or Admin portal for your role.';
          return;
        }
        this.user = user;
        this.email = normalizedEmail;
        this.password = '';

        this.page = 'dashboard';
        this.registerMode = false;
        this.otpMode = false;
        this.otp = '';

        this.loading = false;
        this.notice = 'Welcome, ' + user.name;

        this.refresh();
      },

      error: (err: any) => {

        sessionStorage.removeItem('cc_auth');

        this.user = null;
        this.loading = false;

        this.error = err.status === 0
          ? 'Cannot connect to the backend at localhost:8080.'
          : err.status === 401
            ? 'Incorrect credentials or email not verified. Use Verify email if you have not completed OTP verification.'
            : this.errorMessage(
                err,
                'Unable to sign in. Please try again.'
              );
      }
    });
  }

  // ==========================================
  // REGISTRATION
  // ==========================================

  register(): void {

    this.error = '';
    this.notice = '';

    const normalizedEmail = this.email.trim().toLowerCase();

    if (!this.name.trim()) {
      this.error = 'Please enter your full name.';
      return;
    }

    if (!this.isCollegeEmail(normalizedEmail)) {
      this.error =
        'Registration requires a valid @bmsce.ac.in email address.';
      return;
    }

    if (this.password.length < 8) {
      this.error =
        'Password must contain at least 8 characters.';
      return;
    }

    this.loading = true;

    this.api.post('/auth/register', {
      name: this.name.trim(),
      email: normalizedEmail,
      password: this.password
    }).subscribe({

      next: () => {

        this.loading = false;
        this.email = normalizedEmail;
        this.password = '';

        this.registerMode = false;
        this.otpMode = true;
        this.otp = '';

        this.notice =
          'Account created. Request a verification code to activate your account.';

        this.sendOtp();
      },

      error: (err: any) => {

        this.loading = false;

        this.error = this.errorMessage(
          err,
          'Registration failed.'
        );
      }
    });
  }

  // ==========================================
  // SEND EMAIL OTP
  // ==========================================

  sendOtp(): void {

    this.error = '';
    this.notice = '';

    const normalizedEmail = this.email.trim().toLowerCase();

    if (!this.isCollegeEmail(normalizedEmail)) {
      this.error =
        'Enter your valid @bmsce.ac.in college email.';
      return;
    }

    this.loading = true;

    this.api.post('/auth/send-otp', {
      email: normalizedEmail
    }).subscribe({

      next: () => {

        this.loading = false;
        this.otpMode = true;
        this.page = 'login';

        this.notice =
          'Verification code requested. Check your college email inbox and spam folder.';
      },

      error: (err: any) => {

        this.loading = false;

        this.error = this.errorMessage(
          err,
          'Could not send OTP. Check your email configuration and try again.'
        );
      }
    });
  }

  // ==========================================
  // VERIFY EMAIL OTP
  // ==========================================

  verifyOtp(): void {

    this.error = '';
    this.notice = '';

    const normalizedEmail = this.email.trim().toLowerCase();
    const enteredOtp = this.otp.trim();

    if (!this.isCollegeEmail(normalizedEmail)) {
      this.error = 'Enter your valid BMSCE college email.';
      return;
    }

    if (!/^\d{6}$/.test(enteredOtp)) {
      this.error = 'Enter the six-digit verification code.';
      return;
    }

    this.loading = true;

    this.api.post('/auth/verify-otp', {
      email: normalizedEmail,
      otp: enteredOtp
    }).subscribe({

      next: () => {

        this.loading = false;

        this.otpMode = false;
        this.registerMode = false;
        this.otp = '';

        this.notice =
          'Email verified successfully. You can now sign in.';
      },

      error: (err: any) => {

        this.loading = false;

        this.error = this.errorMessage(
          err,
          'Invalid or expired OTP. Please try again.'
        );
      }
    });
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  logout(): void {

    sessionStorage.removeItem('cc_auth');

    this.user = null;

    this.branches = [];
    this.subjects = [];
    this.docs = [];
    this.items = [];

    this.password = '';
    this.otp = '';
    this.otpMode = false;
    this.registerMode = false;

    this.error = '';
    this.notice = '';

    this.page = 'login';

    this.resetLibrary();
  }

  // ==========================================
  // EXISTING FILTER HELPERS
  // ==========================================

  get filteredDocs(): any[] {

    return this.docs.filter((doc: any) => {

      const subject = doc.subject;

      if (!subject) {
        return false;
      }

      return (
        (!this.branchId ||
          String(subject.branch?.id) === String(this.branchId)) &&

        (!this.semester ||
          String(subject.semester) === String(this.semester)) &&

        (!this.subjectId ||
          String(subject.id) === String(this.subjectId)) &&

        (!this.docType ||
          doc.type === this.docType) &&

        (!this.examType ||
          this.normalizeExamType(doc.examType) ===
          this.normalizeExamType(this.examType)) &&

        (!this.search ||
          `${doc.title || ''} ${subject.name || ''} ${subject.code || ''}`
            .toLowerCase()
            .includes(this.search.toLowerCase()))
      );
    });
  }

  get visibleDocuments(): any[] {

    const type = this.page === 'resources'
      ? 'RESOURCE'
      : 'PAPER';

    return this.filteredDocs.filter(
      (doc: any) => doc.type === type
    );
  }

  get filteredSubjects(): any[] {

    return this.subjects.filter((subject: any) => {

      return (
        (!this.branchId ||
          String(subject.branch?.id) === String(this.branchId)) &&

        (!this.semester ||
          String(subject.semester) === String(this.semester))
      );
    });
  }

  // ==========================================
  // LIBRARY SUBJECTS
  // ==========================================

  get librarySubjects(): any[] {

    if (
      !this.selectedLibraryBranch ||
      this.selectedLibrarySemester === null
    ) {
      return [];
    }

    return this.subjects.filter((subject: any) => {

      return (
        String(subject.branch?.id) ===
          String(this.selectedLibraryBranch.id) &&

        Number(subject.semester) ===
          Number(this.selectedLibrarySemester)
      );
    });
  }

  // ==========================================
  // QUESTION PAPER YEARS
  // ==========================================

  get libraryYears(): string[] {

    if (
      !this.selectedLibrarySubject ||
      !this.selectedLibraryExam
    ) {
      return [];
    }

    const years = this.docs
      .filter((doc: any) => {

        return (
          doc.type === 'PAPER' &&

          String(doc.subject?.id) ===
            String(this.selectedLibrarySubject.id) &&

          this.normalizeExamType(doc.examType) ===
            this.normalizeExamType(this.selectedLibraryExam) &&

          !!doc.academicYear
        );
      })
      .map((doc: any) => String(doc.academicYear).trim());

    return [...new Set(years)].sort(
      (a: string, b: string) => b.localeCompare(a)
    );
  }

  // ==========================================
  // DOCUMENTS IN SELECTED FOLDER
  // ==========================================

  get libraryDocuments(): any[] {

    if (!this.selectedLibrarySubject) {
      return [];
    }

    return this.docs.filter((doc: any) => {

      if (
        String(doc.subject?.id) !==
        String(this.selectedLibrarySubject.id)
      ) {
        return false;
      }

      if (this.page === 'resources') {

        return (
          doc.type === 'RESOURCE' &&
          this.selectedLibraryModule !== null &&
          Number(doc.moduleNumber) ===
            Number(this.selectedLibraryModule)
        );
      }

      if (this.page === 'papers') {

        return (
          doc.type === 'PAPER' &&

          this.normalizeExamType(doc.examType) ===
            this.normalizeExamType(this.selectedLibraryExam) &&

          String(doc.academicYear || '').trim() ===
            String(this.selectedLibraryYear).trim()
        );
      }

      return false;
    });
  }

  // ==========================================
  // EXAM TYPE NORMALIZATION
  // ==========================================

  normalizeExamType(value: any): string {

    const exam = String(value || '')
      .trim()
      .toUpperCase();

    if (exam === 'SUPPLEMENTARY EXAM') {
      return 'SUPPLEMENTARY';
    }

    return exam;
  }

  // ==========================================
  // LIBRARY NAVIGATION
  // ==========================================

  resetLibrary(): void {

    this.libraryStep = 'branch';

    this.selectedLibraryBranch = null;
    this.selectedLibrarySemester = null;
    this.selectedLibrarySubject = null;

    this.selectedLibraryModule = null;

    this.selectedLibraryExam = '';
    this.selectedLibraryYear = '';
  }

  selectLibraryBranch(branch: any): void {

    this.selectedLibraryBranch = branch;

    this.selectedLibrarySemester = null;
    this.selectedLibrarySubject = null;
    this.selectedLibraryModule = null;

    this.selectedLibraryExam = '';
    this.selectedLibraryYear = '';

    this.libraryStep = 'semester';
  }

  selectLibrarySemester(semester: number): void {

    this.selectedLibrarySemester = semester;

    this.selectedLibrarySubject = null;
    this.selectedLibraryModule = null;

    this.selectedLibraryExam = '';
    this.selectedLibraryYear = '';

    this.libraryStep = 'subject';
  }

  selectLibrarySubject(subject: any): void {

    this.selectedLibrarySubject = subject;

    this.selectedLibraryModule = null;
    this.selectedLibraryExam = '';
    this.selectedLibraryYear = '';

    this.libraryStep = 'folder';
  }

  selectLibraryModule(moduleNumber: number): void {

    this.selectedLibraryModule = moduleNumber;
    this.libraryStep = 'documents';
  }

  selectLibraryExam(exam: string): void {

    this.selectedLibraryExam = this.normalizeExamType(exam);

    this.selectedLibraryYear = '';
    this.libraryStep = 'year';
  }

  selectLibraryYear(year: string): void {

    this.selectedLibraryYear = String(year);
    this.libraryStep = 'documents';
  }

  libraryBack(): void {

    switch (this.libraryStep) {

      case 'semester':
        this.libraryStep = 'branch';
        break;

      case 'subject':
        this.libraryStep = 'semester';
        break;

      case 'folder':
        this.libraryStep = 'subject';
        break;

      case 'year':
        this.libraryStep = 'folder';
        break;

      case 'documents':

        this.libraryStep =
          this.page === 'resources'
            ? 'folder'
            : 'year';

        break;

      default:
        this.libraryStep = 'branch';
    }
  }

  // ==========================================
  // LOAD BACKEND DATA
  // ==========================================

  refresh(): void {

    if (!this.user) {
      return;
    }

    this.api.get('/branches').subscribe({

      next: (response: any) => {
        this.branches = Array.isArray(response)
          ? response
          : [];
      },

      error: () => {
        this.error =
          'Unable to load branches. Check backend connection.';
      }
    });

    this.api.get('/subjects').subscribe({

      next: (response: any) => {
        this.subjects = Array.isArray(response)
          ? response
          : [];
      },

      error: () => {
        this.error = 'Unable to load subjects.';
      }
    });

    this.api.get('/documents').subscribe({

      next: (response: any) => {
        this.docs = Array.isArray(response)
          ? response
          : [];
      },

      error: () => {
        this.error = 'Unable to load documents.';
      }
    });

    this.api.get('/items').subscribe({

      next: (response: any) => {
        this.items = Array.isArray(response)
          ? response
          : [];
      },

      error: () => {
        this.error =
          'Unable to load Lost & Found items.';
      }
    });
  }

  // ==========================================
  // ADMIN: ADD BRANCH
  // ==========================================

  addBranch(): void {

    this.error = '';

    if (!this.isAdmin) {
      this.error = 'Administrator access required.';
      return;
    }

    this.api.post('/branches', this.newBranch).subscribe({

      next: () => {

        this.newBranch = {
          code: '',
          name: ''
        };

        this.notice = 'Branch created successfully.';
        this.refresh();
      },

      error: (err: any) => {

        this.error = this.errorMessage(
          err,
          'Could not add branch.'
        );
      }
    });
  }

  // ==========================================
  // ADMIN: ADD SUBJECT
  // ==========================================

  addSubject(): void {

    this.error = '';

    if (!this.isAdmin) {
      this.error = 'Administrator access required.';
      return;
    }

    this.api.post('/subjects', this.newSubject).subscribe({

      next: () => {

        this.newSubject = {
          branchId: '',
          semester: 1,
          code: '',
          name: ''
        };

        this.notice = 'Subject created successfully.';
        this.refresh();
      },

      error: (err: any) => {

        this.error = this.errorMessage(
          err,
          'Could not add subject.'
        );
      }
    });
  }

  // ==========================================
  // SELECT PDF FILE
  // ==========================================

  onFile(event: Event): void {

    const input = event.target as HTMLInputElement;

    this.file = input.files?.[0] || null;

    if (!this.file) {
      return;
    }

    if (!this.file.name.toLowerCase().endsWith('.pdf')) {

      this.error = 'Only PDF files are allowed.';
      this.file = null;
      input.value = '';

      return;
    }

    if (this.file.size > 20 * 1024 * 1024) {

      this.error = 'PDF must be 20 MB or smaller.';
      this.file = null;
      input.value = '';

      return;
    }

    this.error = '';
  }

  // ==========================================
  // ADMIN: UPLOAD PDF
  // ==========================================

  upload(): void {

    this.error = '';
    this.notice = '';

    if (!this.isAdmin) {
      this.error = 'Administrator access required.';
      return;
    }

    if (!this.newDoc.subjectId) {
      this.error = 'Please select a subject.';
      return;
    }

    if (!String(this.newDoc.title || '').trim()) {
      this.error = 'Please enter a document title.';
      return;
    }

    if (!this.file) {
      this.error = 'Please select a PDF file.';
      return;
    }

    if (!this.file.name.toLowerCase().endsWith('.pdf')) {
      this.error = 'Only PDF files are allowed.';
      return;
    }

    if (this.file.size > 20 * 1024 * 1024) {
      this.error = 'PDF must be 20 MB or smaller.';
      return;
    }

    if (this.newDoc.type === 'RESOURCE') {

      const moduleNumber = Number(this.newDoc.moduleNumber);

      if (
        !Number.isInteger(moduleNumber) ||
        moduleNumber < 1 ||
        moduleNumber > 5
      ) {
        this.error = 'Please select Module 1 to Module 5.';
        return;
      }

    } else if (this.newDoc.type === 'PAPER') {

      if (!this.newDoc.examType) {
        this.error = 'Please select an exam type.';
        return;
      }

      if (
        !/^\d{4}$/.test(
          String(this.newDoc.academicYear || '').trim()
        )
      ) {
        this.error =
          'Please enter a four-digit exam year, for example 2025.';
        return;
      }

    } else {

      this.error = 'Invalid document category.';
      return;
    }

    const formData = new FormData();

    formData.append(
      'subjectId',
      String(this.newDoc.subjectId)
    );

    formData.append(
      'title',
      String(this.newDoc.title).trim()
    );

    formData.append(
      'type',
      String(this.newDoc.type)
    );

    if (this.newDoc.type === 'RESOURCE') {

      formData.append(
        'moduleNumber',
        String(this.newDoc.moduleNumber)
      );

    } else {

      formData.append(
        'examType',
        this.normalizeExamType(this.newDoc.examType)
      );

      formData.append(
        'academicYear',
        String(this.newDoc.academicYear).trim()
      );
    }

    formData.append('file', this.file);

    this.loading = true;

    const savedAuth = sessionStorage.getItem('cc_auth');

    const headers = savedAuth
      ? new HttpHeaders({
          Authorization: 'Basic ' + savedAuth
        })
      : new HttpHeaders();

    this.http.post(
      this.api.base + '/documents',
      formData,
      { headers }
    ).subscribe({

      next: () => {

        this.loading = false;

        this.notice = 'PDF uploaded successfully.';

        this.newDoc = {
          subjectId: '',
          title: '',
          type: 'RESOURCE',
          moduleNumber: '',
          examType: '',
          academicYear: ''
        };

        this.file = null;
        this.refresh();
      },

      error: (err: any) => {

        this.loading = false;

        this.error = this.errorMessage(
          err,
          'PDF upload failed.'
        );
      }
    });
  }

  // ==========================================
  // LOST AND FOUND: ADD ITEM
  // ==========================================

  addItem(): void {

    this.error = '';

    if (!this.user) {
      this.error = 'Please sign in first.';
      return;
    }

    this.api.post('/items', this.newItem).subscribe({

      next: (item: any) => {

        this.notice = 'Item posted successfully.';
        if (this.reportPhoto) {
          this.uploadPhoto('/items/' + item.id + '/images', this.reportPhoto,
            'Item and photograph posted successfully.');
          this.reportPhoto = null;
        }

        this.newItem = {
          title: '',
          description: '',
          location: '',
          category: 'Other',
          kind: 'LOST'
        };

        this.refresh();
      },

      error: (err: any) => {

        this.error = this.errorMessage(
          err,
          'Could not post item.'
        );
      }
    });
  }

  // ==========================================
  // LOST AND FOUND: RESOLVE
  // ==========================================

  resolve(id: number): void {

    this.error = '';

    this.api.put(
      '/items/' + id + '/close',
      {}
    ).subscribe({

      next: () => {

        this.notice = 'Item marked as resolved.';
        this.refresh();
      },

      error: (err: any) => {

        this.error = this.errorMessage(
          err,
          'Could not close item.'
        );
      }
    });
  }

  // ==========================================
  // ADMIN: DELETE DOCUMENT
  // ==========================================

  removeDoc(id: number): void {

    if (!this.isAdmin) {
      this.error = 'Administrator access required.';
      return;
    }

    if (!confirm('Delete this PDF?')) {
      return;
    }

    this.api.delete(
      '/documents/' + id
    ).subscribe({

      next: () => {

        this.notice = 'Document deleted successfully.';
        this.refresh();
      },

      error: (err: any) => {

        this.error = this.errorMessage(
          err,
          'Could not delete document.'
        );
      }
    });
  }

  // ==========================================
  // OPEN PDF WITH AUTHENTICATION
  // ==========================================

  openDoc(id: number): void {

    this.error = '';

    const savedAuth = sessionStorage.getItem('cc_auth');

    if (!savedAuth) {
      this.error = 'Please sign in to view PDFs.';
      return;
    }

    const headers = new HttpHeaders({
      Authorization: 'Basic ' + savedAuth
    });

    this.http.get(
      this.api.fileUrl(id),
      {
        headers,
        responseType: 'blob'
      }
    ).subscribe({

      next: (blob: Blob) => {

        const url = URL.createObjectURL(blob);

        const openedWindow = window.open(
          url,
          '_blank'
        );

        if (!openedWindow) {
          this.error =
            'Popup blocked. Please allow popups for Campus Connect.';
        }

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 60000);
      },

      error: () => {

        this.error =
          'Unable to open PDF. Please check your login.';
      }
    });
  }

  // ==========================================
  // MAIN NAVIGATION
  // ==========================================

  nav(page: string): void {

    this.error = '';
    this.notice = '';

    if (!this.user && page !== 'login') {

      this.page = 'login';

      this.error =
        'Please sign in with your BMSCE college email to continue.';

      return;
    }

    if (page === 'admin' && !this.isAdmin) {

      this.page = 'dashboard';

      this.error =
        'Only administrators can access this section.';

      return;
    }

    if (page === 'resources' || page === 'papers') {
      this.resetLibrary();
    }

    this.page = page;
  }
}
