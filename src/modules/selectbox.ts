import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseBoxComponent } from './base-box';
var log = console.log;

/**
 * SelectBoxComponent
 * -------------------
 * A modal dialog that presents a list of options to the user.
 *
 * Usage:
 *   const choice = await this.selectBox.showOptions({ a: 'Alpha', b: 'Beta' });
 *   // `choice` will be the key of the selected option or `null` if cancelled.
 *
 * It mirrors the PromptBoxComponent but replaces the text input with a set of
 * full‑width buttons generated from the supplied `options` object.
 */
@Component({
    selector: 'app-select-box',
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
        <!-- Options rendered as full‑width buttons -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
            <button *ngFor="let key of optionKeys"
                    (click)="select(key)"
                    style="width: 100%; height: 20px; text-align:left;">
                {{ options[key] }}
            </button>
        </div>
        <div style="display: flex; justify-content: flex-start; margin-top: 1rem;">
          <button (click)="answer(false)" style="width:100px; height:40px;">Cancel</button>
        </div>
      </div>
    </div>
    `
})
export class SelectBoxComponent extends BaseBoxComponent {
    /**
     * The map of option keys to display values. Populated when `showOptions` is called.
     */
    options: { [key: string]: string } = {};

    /** List of keys for *ngFor iteration (preserves insertion order). */
    optionKeys: string[] = [];

    private resolvePromise: ((value: string | null) => void) | null = null;

    /**
     * Show the selection dialog.
     * @param options An object where each key is the return value and the value is the label.
     * @returns A promise that resolves to the selected key or `null` if cancelled.
     */
    showOptions(msg: string, options: { [key: string]: string }): Promise<string | null> {
        log('showOptions');
        this.options = options;
        this.optionKeys = Object.keys(options);
        // Re‑use the `message` property from BaseBoxComponent for a title/description.
        this.message = this.sanitizer.bypassSecurityTrustHtml(msg);
        this.show = true;
        this.cdr.detectChanges();
        return new Promise(resolve => {
            this.resolvePromise = resolve;
        });
    }

    /** Called when an option button is clicked. */
    // Made public to allow template binding.
    select(key: string) {
        this.answer(true, key);
    }

    /**
     * Close the dialog and resolve the stored promise.
     * @param confirmed If true, resolve with the selected key; otherwise resolve with null.
     * @param selectedKey The key that was chosen (only used when confirmed is true).
     */
    answer(confirmed: boolean, selectedKey: string | null = null) {
        this.show = false;
        if (this.resolvePromise) {
            this.resolvePromise(confirmed ? selectedKey : null);
            this.resolvePromise = null;
        }
    }
}
