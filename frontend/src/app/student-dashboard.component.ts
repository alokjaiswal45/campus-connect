import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CampusIconComponent } from './campus-icon.component';

@Component({
  selector: 'cc-student-dashboard', standalone: true,
  imports: [CommonModule, FormsModule, CampusIconComponent],
  template: `
    <section class="fresh-overview" aria-label="Student overview">
      <div class="fresh-intro-grid">
        <div class="fresh-intro"><h1>Your campus, connected.</h1><p>Study resources, past papers and a safer, more helpful campus community — all in one place.</p>
          <form class="fresh-search" (ngSubmit)="searchResources()"><cc-icon name="search" /><input aria-label="Search notes, papers and resources" name="dashboardSearch" [(ngModel)]="query" placeholder="Search notes, papers and resources…"><button type="submit" aria-label="Search resources"><cc-icon name="sliders" /></button></form>
        </div>
        <div class="fresh-summary" aria-label="Campus totals">
          <div><span class="fresh-stat-icon lime"><cc-icon name="file" /></span><strong>{{ docs.length }}</strong><small>Resources</small></div>
          <div><span class="fresh-stat-icon sky"><cc-icon name="book" /></span><strong>{{ subjects.length }}</strong><small>Subjects</small></div>
          <div><span class="fresh-stat-icon sand"><cc-icon name="tag" /></span><strong>{{ foundItems.length }}</strong><small>Found items</small></div>
        </div>
      </div>
      <div class="fresh-feature-grid">
        <article class="fresh-feature fresh-resources"><div class="fresh-feature-title"><cc-icon name="file" /><h2>Study Resources</h2></div><p>Find and access class notes, reports,<br>lab manuals and more.</p><img class="fresh-feature-art books" src="assets/fresh-campus/books.webp" alt="" fetchpriority="high"><button type="button" (click)="navigate.emit('resources')">Browse resources <cc-icon name="arrow" /></button><button class="fresh-circle-action" type="button" aria-label="Open study resources" (click)="navigate.emit('resources')"><cc-icon name="arrow" /></button></article>
        <article class="fresh-feature fresh-papers"><div class="fresh-feature-title"><cc-icon name="file" /><h2>Question Papers</h2></div><p>Access previous years’ papers<br>and prepare better.</p><img class="fresh-feature-art papers" src="assets/fresh-campus/papers.webp" alt=""><button type="button" (click)="navigate.emit('papers')">Explore papers <cc-icon name="arrow" /></button><button class="fresh-circle-action" type="button" aria-label="Open question papers" (click)="navigate.emit('papers')"><cc-icon name="arrow" /></button></article>
        <article class="fresh-feature fresh-community"><div class="fresh-feature-title"><cc-icon name="tag" /><h2>Lost &amp; Found</h2></div><p>Report lost items or help return<br>found property.</p><img class="fresh-feature-art bag" src="assets/fresh-campus/bag.webp" alt=""><button type="button" (click)="navigate.emit('lost')">View items <cc-icon name="arrow" /></button><button class="fresh-circle-action" type="button" aria-label="Open lost and found" (click)="navigate.emit('lost')"><cc-icon name="arrow" /></button></article>
      </div>
      <div class="fresh-lower-grid">
        <section class="fresh-panel fresh-recent"><header><h2><cc-icon name="file" />Recent Resources</h2><button type="button" (click)="navigate.emit('resources')">View all <cc-icon name="arrow" /></button></header>
          <article *ngFor="let doc of recentDocs" class="fresh-resource-row"><span class="fresh-document-symbol"><cc-icon name="file" /></span><div class="fresh-resource-info"><h3>{{ doc.title }}</h3><p>{{ doc.subject?.branch?.code || 'Campus' }} <span>·</span> {{ doc.subject?.name || 'Study material' }}<span *ngIf="doc.createdAt"> · {{ doc.createdAt | date:'d MMM y' }}</span></p></div><span class="fresh-resource-type" [class.paper]="doc.type === 'PAPER'">{{ doc.type === 'PAPER' ? 'Question Paper' : 'Notes' }}</span><button type="button" class="fresh-download" [attr.aria-label]="'View PDF: ' + doc.title" (click)="openDocument.emit(doc.id)"><cc-icon name="download" /></button></article>
          <p class="fresh-empty" *ngIf="!recentDocs.length">Resources shared by your teachers will appear here.</p>
        </section>
        <section class="fresh-panel fresh-found"><header><h2><cc-icon name="tag" />Lost &amp; Found</h2><button type="button" (click)="navigate.emit('lost')">View all <cc-icon name="arrow" /></button></header><div class="fresh-found-grid">
          <article *ngFor="let item of recentFoundItems" class="fresh-found-item"><div class="fresh-item-photo"><img *ngIf="photoUrls[item.id]; else noPhoto" [src]="photoUrls[item.id]" [alt]="item.title" loading="lazy"><ng-template #noPhoto><cc-icon name="tag" /></ng-template></div><div class="fresh-item-info"><h3>{{ item.title }}</h3><p>Found near {{ item.location || 'campus' }}</p><small *ngIf="item.createdAt">{{ item.createdAt | date:'d MMM y' }}</small><button type="button" (click)="viewItem.emit(item)">View details <cc-icon name="arrow" /></button></div></article>
        </div><p class="fresh-empty" *ngIf="!recentFoundItems.length">No open found-item reports. You can still report a lost or found item.</p></section>
      </div>
    </section>
  `
})
export class StudentDashboardComponent {
  @Input() docs: any[] = [];
  @Input() subjects: any[] = [];
  @Input() items: any[] = [];
  @Input() photoUrls: Record<number,string> = {};
  @Output() navigate = new EventEmitter<string>();
  @Output() search = new EventEmitter<string>();
  @Output() openDocument = new EventEmitter<number>();
  @Output() viewItem = new EventEmitter<any>();
  query = '';
  private newest(items: any[]): any[] { return [...items].sort((a,b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || Number(b.id) - Number(a.id)); }
  get recentDocs(): any[] { return this.newest(this.docs).slice(0,3); }
  get foundItems(): any[] { return this.items.filter(item => item.kind === 'FOUND' && item.status === 'OPEN'); }
  get recentFoundItems(): any[] { return this.newest(this.foundItems).slice(0,2); }
  searchResources(): void { this.search.emit(this.query.trim()); }
}
