import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from './api.service';

@Component({
  selector: 'cc-account-link',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a class="account-link" [class.on-dark]="dark" [class.fresh-account]="tone === 'fresh'" [routerLink]="'/' + section + '/profile'"
       [attr.aria-label]="'Open profile for ' + (account?.name || user?.name || section)">
      <span class="avatar"><img *ngIf="photoUrl" [src]="photoUrl" alt=""><span *ngIf="!photoUrl">{{ (account?.name || user?.name || section)?.[0]?.toUpperCase() }}</span></span>
      <span class="account-link-name"><strong>{{ account?.name || user?.name || section }}</strong><small>{{ account?.role || user?.role || section }}</small></span>
    </a>
  `,
  styles: [`
    :host{display:inline-block;min-width:0}.account-link{display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit;border-radius:8px;padding:4px;max-width:240px}.account-link:hover{background:#54726b10}.account-link:focus-visible{outline:2px solid #bc6d48;outline-offset:4px}.avatar{overflow:hidden}.avatar img{width:100%;height:100%;object-fit:cover}.account-link-name{min-width:0;text-align:left}.account-link-name strong{font-size:11px;font-weight:650;display:block;overflow-wrap:anywhere}.account-link-name small{display:block;font-size:8px;letter-spacing:1px;color:var(--muted,#68767c);margin-top:4px}.on-dark{color:#fff}.on-dark small{color:#95a9b0}.on-dark .avatar{background:#ffffff14;color:#d8e6df}.on-dark:hover{background:#ffffff0a}
    .fresh-account{gap:14px;max-width:240px;padding:0}.fresh-account .avatar{height:49px;width:49px;background:#dce9dd;color:#123e2b}.fresh-account .account-link-name strong{font-size:13px;color:#101c2c;white-space:nowrap}.fresh-account .account-link-name small{display:none}
    @media(max-width:520px){.account-link{max-width:145px;gap:7px}.account-link-name strong{font-size:10px}.account-link .avatar{display:grid!important;width:30px;height:30px}}
  `]
})
export class AccountLinkComponent implements OnInit, OnDestroy {
  @Input() section = 'student';
  @Input() user: any;
  @Input() dark = false;
  @Input() tone = 'default';
  account: any; photoUrl = ''; private destroyed = false;
  constructor(private api: ApiService) {}
  ngOnInit(): void {
    this.api.get('/profile').subscribe({next: account => {
      if(this.destroyed) return;
      this.account = account;
      if(account.hasPhoto) this.api.getProfilePhoto().subscribe({next: blob => {
        if(!this.destroyed) this.photoUrl = URL.createObjectURL(blob);
      },error: () => { /* Keep initials if the photo is unavailable. */ }});
    },error: () => { /* Account navigation remains available using the signed-in identity. */ }});
  }
  ngOnDestroy(): void { this.destroyed = true; if(this.photoUrl) URL.revokeObjectURL(this.photoUrl); }
}
