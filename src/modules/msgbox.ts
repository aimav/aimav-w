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
        <p [innerHTML]="message" style="overflow:auto; max-width:50vw; max-height:calc(100vh - 200px);"></p>
        <button (click)="okClicked()" style="width:100px; height:40px;">OK</button>
      </div>
    </div>
  `
})
export class MessageBoxComponent {
    private cdr = inject(ChangeDetectorRef);
    private sanitizer = inject(DomSanitizer);
    show = false;
    message: SafeHtml = '';

    // Show a message box and return a Promise that resolves when the user clicks OK.
    // This makes the component awaitable.
    showMsg(msg: string): Promise<void> {
        log("show");
        this.message = this.sanitizer.bypassSecurityTrustHtml(msg);
        this.show = true;
        this.cdr.detectChanges();
        // Return a promise that resolves on OK click
        return new Promise<void>((resolve) => {
            // Store resolver to be called from the OK button handler
            this._resolve = resolve;
        });
    }

    // Internal resolver for the current dialog instance
    private _resolve?: () => void;

    // Called when OK button is clicked
    okClicked() {
        this.show = false;
        this.cdr.detectChanges();
        if (this._resolve) {
            this._resolve();
            this._resolve = undefined;
        }
    }
}