import { Component, Input } from '@angular/core';

@Component({
  selector: 'cc-campus-scene', standalone: true,
  template: `
    <div class="campus-plate" aria-hidden="true">
      <div class="plate-heading"><span>CAMPUS CONNECT</span><span>BMSCE · BENGALURU</span></div>
      <svg viewBox="0 0 440 290" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="currentColor" opacity=".12"><path d="M0 45h440M0 95h440M0 145h440M0 195h440M0 245h440M45 0v290M95 0v290M145 0v290M195 0v290M245 0v290M295 0v290M345 0v290M395 0v290"/></g>
        <circle cx="222" cy="137" r="119" stroke="currentColor" opacity=".22"/>
        <circle cx="222" cy="137" r="94" stroke="currentColor" opacity=".12" stroke-dasharray="3 7"/>
        <g stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">
          <path d="M62 234h317M77 227h287M91 220h260M105 213h231M115 123h211v90H115z"/>
          <path d="M102 123h236l-22-14H125zM134 109V87h173v22M126 87h189l-94-40z"/>
          <path d="M151 213v-57a20 20 0 0 1 40 0v57M201 213v-57a20 20 0 0 1 40 0v57M251 213v-57a20 20 0 0 1 40 0v57"/>
          <path d="M143 132v81m56-81v81m46-81v81m54-81v81M115 132h211M222 47V22m0 0 21 8-21 7"/>
          <circle cx="221" cy="73" r="6"/>
          <path d="M69 213v-60m-9 21 9 9 10-20M369 213v-60m-10 11 10 13 10-10M54 213h30m271 0h28"/>
          <ellipse cx="69" cy="145" rx="20" ry="31"/><ellipse cx="369" cy="145" rx="20" ry="31"/>
        </g>
        <g fill="currentColor" font-family="monospace" font-size="7" letter-spacing="2"><text x="24" y="270">LEARN / SHARE / BELONG</text><text x="364" y="270">BMSCE</text></g>
        <g stroke="currentColor" opacity=".45"><path d="M20 22h14m-7-7v14M408 22h14m-7-7v14M20 248h14m-7-7v14M408 248h14m-7-7v14"/></g>
      </svg>
      <div class="plate-footer"><span>{{ caption }}</span><span class="plate-dot"></span></div>
    </div>
  `,
  styles: [`:host{display:block;width:100%;color:#d4bb82}.campus-plate{position:relative;padding:22px 25px;border:1px solid #d4bb8230;border-radius:140px 140px 9px 9px;background:linear-gradient(145deg,#ffffff05,transparent);overflow:hidden}.plate-heading,.plate-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;font:8px/1.7 'Segoe UI',sans-serif;letter-spacing:2px}.plate-heading{padding:10px 20px 0;opacity:.65;font-size:6px}.campus-plate svg{display:block;width:100%;margin:12px 0}.plate-footer{border-top:1px solid #d4bb8230;padding-top:14px;font-size:7px}.plate-dot{width:5px;height:5px;background:currentColor;border-radius:50%}@media(max-width:600px){.campus-plate{padding:18px}.plate-heading{font-size:5px;letter-spacing:1px}}`]
})
export class CampusSceneComponent { @Input() caption = 'A PLACE FOR EVERY CONNECTION'; }
