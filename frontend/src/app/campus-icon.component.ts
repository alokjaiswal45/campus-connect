import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-icon',
  standalone: true,
  imports: [CommonModule],
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><ng-container [ngSwitch]="name">
    <g *ngSwitchCase="'connect'"><path d="M20 6a9 9 0 1 0 0 12M18 8a6 6 0 1 0 0 8M16 10a3 3 0 1 0 0 4"/></g>
    <g *ngSwitchCase="'home'"><path d="m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7"/></g>
    <g *ngSwitchCase="'tag'"><path d="M3 12 13 2h7l2 2v7L12 21a2 2 0 0 1-3 0l-6-6a2 2 0 0 1 0-3Z"/><circle cx="17" cy="7" r="1"/></g>
    <g *ngSwitchCase="'download'"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/></g>
    <g *ngSwitchCase="'sliders'"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></g>
    <g *ngSwitchCase="'grid'"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></g>
    <g *ngSwitchCase="'book'"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15M6 8h3M15 8h3M6 12h3M15 12h3"/></g>
    <g *ngSwitchCase="'file'"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></g>
    <g *ngSwitchCase="'upload'"><path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></g>
    <g *ngSwitchCase="'folder'"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 9h18"/></g>
    <g *ngSwitchCase="'campus'"><path d="m2 8 10-5 10 5-10 5Zm4 3v7m6-5v8m6-10v7M3 21h18"/></g>
    <g *ngSwitchCase="'search'"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></g>
    <g *ngSwitchCase="'arrow'"><path d="M5 12h14m-6-6 6 6-6 6"/></g>
    <g *ngSwitchCase="'logout'"><path d="M9 5H5v14h4m5-14 7 7-7 7M9 12h12"/></g>
    <g *ngSwitchCase="'shield'"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6"/></g>
    <g *ngSwitchCase="'calendar'"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3m-10 4h3"/></g>
    <g *ngSwitchDefault><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/></g>
  </ng-container></svg>`
})
export class CampusIconComponent { @Input() name = 'spark'; }
