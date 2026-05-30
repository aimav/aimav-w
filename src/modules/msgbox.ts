import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
var log = console.log;


@Component({
    selector: 'app-message-box',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="show" style="
      position: fixed; inset: 0;
      background: #0006;
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        background: white; padding: 2rem; border-radius: 8px;
        text-align: left; min-width: 33vw;
      ">
        <p [innerHTML]="message"></p>
        <button (click)="show = false" style="width:100px; height:40px;">OK</button>
      </div>
    </div>
  `
})
export class MessageBoxComponent {
    private cdr = inject(ChangeDetectorRef);
    private sanitizer = inject(DomSanitizer);
    show = false;
    message: SafeHtml = '';

    showMsg(msg: string) {
        log("show");
        this.message = this.sanitizer.bypassSecurityTrustHtml(msg);
        this.show = true;
        this.cdr.detectChanges();
    }
}