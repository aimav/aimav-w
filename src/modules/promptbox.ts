import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseBoxComponent } from './base-box';
var log = console.log;

@Component({
    selector: 'app-prompt-box',
    standalone: true,
    imports: [CommonModule, FormsModule],
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
        <input type="text" [(ngModel)]="inputValue" (keydown.enter)="answer(true)" style="width: 100%; padding: 0.5rem; margin-top: 1rem;">
        <div style="display: flex; justify-content: flex-start; margin-top: 1rem;">
          <button (click)="answer(true)" style="width:100px; height:40px;">OK</button>
          &nbsp; &nbsp;
          <button (click)="answer(false)" style="width:100px; height:40px;">Cancel</button>
        </div>
      </div>
    </div>
  `
})
export class PromptBoxComponent extends BaseBoxComponent {
    inputValue: string = '';
    private resolvePromise: ((value: string | null) => void) | null = null;

    showPrompt(msg: string, defaultValue: string = ''): Promise<string | null> {
        log("showPrompt");
        this.message = this.sanitizer.bypassSecurityTrustHtml(msg);
        this.inputValue = defaultValue;
        this.show = true;
        this.cdr.detectChanges();
        return new Promise(resolve => {
            this.resolvePromise = resolve;
        });
    }

    answer(confirmed: boolean) {
        this.show = false;
        if (this.resolvePromise) {
            this.resolvePromise(confirmed ? this.inputValue : null);
            this.resolvePromise = null;
        }
    }
}
