import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
var log = console.log;


@Component({
    selector: 'app-confirm-box',
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
        <div style="display: flex; justify-content:flext-start; margin-top: 1rem;">
          <button (click)="answer('yes')" style="width:100px; height:40px;">Yes</button>
          &nbsp; &nbsp;
          <button (click)="answer('no')" style="width:100px; height:40px;">No</button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmBoxComponent {
    private cdr = inject(ChangeDetectorRef);
    private sanitizer = inject(DomSanitizer);
    show = false;
    message: SafeHtml = '';
    private resolvePromise: ((value: "yes" | "no") => void) | null = null;

    showConfirm(msg: string): Promise<"yes" | "no"> {

        log("showConfirm");
        this.message = this.sanitizer.bypassSecurityTrustHtml(msg);
        this.show = true;
        this.cdr.detectChanges();
        return new Promise(resolve => {
            this.resolvePromise = resolve;
        });
    }

    answer(response: "yes" | "no") {
        this.show = false;
        if (this.resolvePromise) {
            this.resolvePromise(response);
            this.resolvePromise = null;
        }
    }
}