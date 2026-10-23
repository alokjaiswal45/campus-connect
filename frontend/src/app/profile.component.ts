import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="account-page" [class.profile-fresh]="section === 'student'" [class.profile-forest]="section === 'teacher'" [class.profile-midnight]="section === 'staff'" [class.profile-obsidian]="section === 'admin'">
      <header class="account-header"><a [routerLink]="'/' + section + '/dashboard'">✦ campus connect</a><a [routerLink]="'/' + section + '/dashboard'">← Back to workspace</a></header>
      <div class="account-intro"><p class="eyebrow">YOUR ACCOUNT</p><h1>A space of your own.</h1><p>Your profile, account security and {{ section }} workspace.</p></div>
      <p *ngIf="error" class="role-login-error" role="alert">{{ error }}</p><p *ngIf="notice" class="teacher-notice" role="status">{{ notice }}</p>
      <p *ngIf="!profile && !error" role="status">Loading your profile…</p>
      <div class="account-layout" *ngIf="profile">
        <aside class="account-card identity-card">
          <div class="account-photo"><img *ngIf="photoUrl" [src]="photoUrl" alt="Your profile photo"><span *ngIf="!photoUrl">{{ profile.name?.[0] }}</span></div>
          <span class="account-role">{{ profile.role }}</span><h2>{{ profile.name }}</h2><p class="account-email">{{ profile.email }}</p>
          <p class="account-verification">{{ profile.emailVerified ? '✓ Email verified' : 'Email not verified' }} · {{ profile.accountActive ? 'Active account' : 'Inactive account' }}</p>
          <label class="account-photo-label">Change profile photo<input type="file" accept="image/jpeg,image/png" [disabled]="busy" (change)="uploadPhoto($event)"></label>
          <small>JPEG or PNG · up to 1 MB · maximum 2048 × 2048 pixels. Visible only in your own profile.</small>
          <button type="button" *ngIf="profile.hasPhoto" [disabled]="busy" (click)="removePhoto()">Remove photo</button>
          <p class="account-caption">Profile details are self-reported. Your profile photo does not replace physical college ID verification.</p>
        </aside>
        <div class="account-panels">
          <section class="account-card"><p class="eyebrow">PERSONAL DETAILS</p><h2>Your profile</h2>
            <form (ngSubmit)="save()">
              <label for="profile-name">Display name</label><input id="profile-name" name="name" [(ngModel)]="draft.name" required maxlength="100">
              <label for="profile-department">{{ section === 'staff' ? 'Department / service desk' : 'Department' }} (optional)</label><input id="profile-department" name="department" [(ngModel)]="draft.department" maxlength="120">
              <label for="profile-about">{{ section === 'teacher' ? 'Teaching interests' : section === 'staff' ? 'Service information' : section === 'admin' ? 'Administrative responsibilities' : 'About you' }} (optional)</label>
              <textarea id="profile-about" name="about" [(ngModel)]="draft.about" maxlength="500" rows="3"></textarea>
              <p class="account-caption">Your role and registered email are managed by the system and cannot be edited here.</p>
              <button class="primary-btn" type="submit" [disabled]="busy || !draft.name.trim()">{{ busy ? 'Saving…' : 'Save profile' }}</button>
            </form>
          </section>
          <section class="account-card security-card"><div><p class="eyebrow">ACCOUNT SECURITY</p><h2>Change your password</h2><p>Verify a six-digit code sent to your registered email, then choose a new password. You will sign in again afterward.</p></div>
            <a class="primary-btn" [routerLink]="'/' + section + '/forgot-password'" [queryParams]="{email: profile.email}">Change password with email OTP →</a>
          </section>
          <section class="account-card"><p class="eyebrow">YOUR WORKSPACE</p><h2>{{ workspaceTitle }}</h2><p>{{ workspaceDescription }}</p>
            <div class="account-shortcuts"><a *ngFor="let link of shortcuts" [routerLink]="'/' + section + '/dashboard'" [queryParams]="link.params">{{ link.label }} →</a></div>
          </section>
          <button class="account-signout" type="button" (click)="signOut()">Sign out of this browser</button>
        </div>
      </div>
    </main>
  `,
  styles: [`
    :host{display:block}.account-page{max-width:1160px;margin:auto;padding:32px 28px 70px;color:var(--ink,#192e3b)}
    .account-header{display:flex;justify-content:space-between;gap:20px;align-items:center}.account-header a{color:inherit;text-decoration:none;font-weight:650}.account-header a:first-child{font-size:23px}.account-header a:last-child{font-size:12px}
    .account-intro{margin:48px 0 30px}.account-intro h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(32px,5vw,48px);margin:10px 0}.account-intro p:last-child,.account-card p{color:var(--muted,#65737b);line-height:1.7}
    .account-layout{display:grid;grid-template-columns:310px minmax(0,1fr);gap:24px;align-items:start}.account-card{background:var(--surface,#fffefa);border:1px solid var(--line,#e4e5df);border-radius:9px;padding:28px;min-width:0}.account-card h2{font-family:Georgia,serif;font-size:25px;font-weight:400;margin:8px 0 18px}.identity-card{text-align:center;background:#e9e8dc}.account-photo{height:116px;width:116px;border-radius:50%;margin:4px auto 22px;background:#1b3641;color:#fff;overflow:hidden;display:grid;place-items:center;font-family:Georgia,serif;font-size:48px}.account-photo img{width:100%;height:100%;object-fit:cover}.account-role{letter-spacing:2px;font-size:10px;font-weight:700}.account-email{overflow-wrap:anywhere;font-size:13px}.account-verification{font-size:11px}.account-photo-label{margin-top:22px!important;font-weight:650}.account-photo-label input{font-size:11px;padding:10px 0;border:0;background:transparent}.identity-card small{display:block;font-size:11px;line-height:1.6;color:#65737b}.identity-card button{margin-top:14px}.account-panels{display:grid;gap:22px}.account-card label{display:block;font-size:12px;margin:18px 0 8px}.account-card input,.account-card textarea{width:100%;box-sizing:border-box}.account-caption{font-size:11px!important;margin-top:18px}.account-card .primary-btn{display:inline-block;text-decoration:none;margin-top:12px;font-size:12px}.account-shortcuts{display:flex;gap:12px;flex-wrap:wrap}.account-shortcuts a{background:#eeecdf;border-radius:5px;padding:14px;color:inherit;font-size:12px;font-weight:600;text-decoration:none}.account-signout{justify-self:start;background:transparent;color:#766035;border:0;padding:12px 0}.security-card{background:#eee8d7}.account-page button:focus-visible,.account-page a:focus-visible{outline:3px solid #a18546;outline-offset:4px}
    .profile-fresh,.profile-forest{--paper:#f5faf6;--ink:#0b3c2c;--muted:#587267;--line:#d6e6da;--surface:#fdfffb;background:var(--paper)}
    .profile-fresh .identity-card,.profile-forest .identity-card{background:#edf6e7}.profile-fresh .security-card,.profile-forest .security-card{background:#eef9df}.profile-fresh .primary-btn,.profile-forest .primary-btn{background:#155739;border-color:#155739;color:white}
    .profile-midnight,.profile-obsidian{--ink:#edf0f8;--muted:#acb9d4;--line:#344968;--surface:#112137;background:#091625;color:var(--ink);min-height:100dvh;max-width:none;padding-left:max(28px,calc((100% - 1100px)/2));padding-right:max(28px,calc((100% - 1100px)/2))}.profile-obsidian{--line:#41464d;--surface:#1a1e23;--muted:#b3bac9;background:#0e1113}.profile-midnight .identity-card,.profile-obsidian .identity-card{background:var(--surface)}.profile-midnight .security-card{background:#1e274b}.profile-obsidian .security-card{background:#302a20}.profile-midnight .account-card input,.profile-midnight .account-card textarea,.profile-obsidian .account-card input,.profile-obsidian .account-card textarea{background:#ffffff08;border-color:var(--line);color:var(--ink)}.profile-midnight .account-card label,.profile-obsidian .account-card label{color:#d4deee}.profile-midnight .account-role,.profile-obsidian .account-role{color:#d8c785}.profile-midnight .account-shortcuts a,.profile-obsidian .account-shortcuts a{background:#ffffff08;color:#d9e4f7}.profile-midnight .primary-btn{background:#8060ee;border-color:#a086ff;color:#fff}.profile-obsidian .primary-btn{background:#d9b76d;border-color:#efd18d;color:#181b1a}.profile-midnight .account-signout{color:#bda5ff}.profile-obsidian .account-signout{color:#e2c688}
    @media(max-width:720px){.account-page{padding:22px 16px 45px}.account-layout{grid-template-columns:1fr}.account-intro{margin-top:36px}.account-card{padding:22px}.account-header a:first-child{font-size:18px}.account-header a:last-child{font-size:11px}}
  `]
})
export class ProfileComponent implements OnInit, OnDestroy {
  section: string = this.route.snapshot.data['section'];
  profile: any = null;
  draft = { name: '', department: '', about: '' };
  photoUrl = ''; busy = false; error = ''; notice = '';
  private destroyed = false;
  private photoGeneration = 0;
  get workspaceTitle(): string { return ({student:'Learn and reconnect',teacher:'Share your knowledge',staff:'Care for campus belongings',admin:'Manage your campus'} as Record<string,string>)[this.section]; }
  get workspaceDescription(): string { return ({student:'Browse learning resources, report lost or found items, and track your ownership claims.',teacher:'Explore the academic library and publish notes or question papers.',staff:'Review ownership claims, confirm physical intake and manage secure storage.',admin:'Manage account access, college academics and oversight of campus reports.'} as Record<string,string>)[this.section]; }
  get shortcuts(): {label:string;params:Record<string,string>}[] {
    return ({student:[{label:'Study resources',params:{page:'resources'}},{label:'Lost & Found and my claims',params:{page:'lost'}}],teacher:[{label:'Academic library',params:{tab:'browse'}},{label:'Publish a resource',params:{tab:'upload'}}],staff:[{label:'Reports and claims',params:{tab:'operations'}},{label:'Physical storage',params:{tab:'storage'}}],admin:[{label:'Account directory',params:{section:'people'}},{label:'Academic management',params:{section:'academics'}}]} as Record<string,any[]>)[this.section] || [];
  }
  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}
  ngOnInit(): void {
    this.api.get('/profile').subscribe({next: profile => { this.apply(profile); if (profile.hasPhoto) this.loadPhoto(); },error: err => this.fail(err)});
  }
  private apply(profile: any): void { this.profile = profile; this.draft = {name:profile.name,department:profile.department || '',about:profile.about || ''}; }
  private fail(err: any): void { this.busy = false; this.error = err.error?.detail || err.error?.error || 'Unable to update your profile. Please try again.'; }
  save(): void {
    if(this.busy || !this.draft.name.trim()) return;
    this.busy = true; this.error = ''; this.notice = '';
    this.api.put('/profile', this.draft).subscribe({next: profile => { this.apply(profile); this.busy = false; this.notice = 'Profile saved.'; },error: err => this.fail(err)});
  }
  private loadPhoto(): void {
    const generation = ++this.photoGeneration;
    this.api.getProfilePhoto().subscribe({next: blob => {
      if (this.destroyed || generation !== this.photoGeneration) return;
      if(this.photoUrl) URL.revokeObjectURL(this.photoUrl); this.photoUrl = URL.createObjectURL(blob);
    },error: () => { if (!this.destroyed && generation === this.photoGeneration) this.error = 'Your profile photo could not be loaded. Try refreshing.'; }});
  }
  uploadPhoto(event: Event): void {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
    if(!file || this.busy) return;
    this.error = ''; this.notice = '';
    if(!['image/jpeg','image/png'].includes(file.type) || file.size > 1024*1024) { this.error = 'Choose a JPEG or PNG up to 1 MB.'; return; }
    this.busy = true;
    this.api.uploadImage('/profile/photo',file).subscribe({next: profile => { this.profile = profile; this.busy = false; this.notice = 'Profile photo updated.'; this.loadPhoto(); },error: err => this.fail(err)});
  }
  removePhoto(): void {
    if(this.busy) return;
    this.busy = true; this.error = ''; this.notice = '';
    this.api.delete('/profile/photo').subscribe({next: profile => { this.profile = profile; ++this.photoGeneration; if(this.photoUrl) URL.revokeObjectURL(this.photoUrl); this.photoUrl = ''; this.busy = false; this.notice = 'Profile photo removed.'; },error: err => this.fail(err)});
  }
  signOut(): void { sessionStorage.removeItem('cc_auth'); this.router.navigateByUrl('/' + this.section + '/login'); }
  ngOnDestroy(): void { this.destroyed = true; ++this.photoGeneration; if(this.photoUrl) URL.revokeObjectURL(this.photoUrl); }
}
