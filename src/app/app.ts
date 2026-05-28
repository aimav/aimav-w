import { Component, OnDestroy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { sha1 } from '../modules/common.js';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, FormsModule],
    templateUrl: './app.html',
    styleUrl: './app.css',
})
/**
 * Root component of the Aimav Web Application.
 * Serves as the entry point layout for the view layer.
 * Handles vault and service password generation, and auto-clears all
 * input fields 1 minute after the last password generation action.
 */
export class App implements OnDestroy {
    protected readonly title = signal('aimav-w');

    /** Current value of the username input box. */
    protected username = signal('');

    /** Current value of the shape input box. */
    protected shape = signal('');

    /** Current value of the sound input box. */
    protected sound = signal('');

    /** SHA-1 hash shown in the vault password input box. */
    protected vaultPassword = signal('');

    /** Current value of the domain input box. */
    protected domain = signal('');

    /** SHA-1 hash shown in the service password input box. */
    protected servicePassword = signal('');

    /** Current value of the chat textarea. */
    protected chatInput = signal('');

    /** Whether the chat log panel is visible. */
    protected showChat = signal(false);

    /** Whether the Apps overlay is visible. */
    protected showApps = signal(false);

    /** Handle for the auto-clear timer so it can be cancelled or reset. */
    private clearTimerId: ReturnType<typeof setTimeout> | null = null;

    /**
     * Normalises a raw string by lowercasing, trimming, and
     * collapsing all internal whitespace sequences to a single space.
     * @param value - The raw input string.
     * @returns The normalised string.
     */
    private normalise(value: string): string {
        return value.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    /**
     * Clears all input boxes and computed password fields.
     */
    private clearAll(): void {
        this.username.set('');
        this.shape.set('');
        this.sound.set('');
        this.vaultPassword.set('');
        this.domain.set('');
        this.servicePassword.set('');
    }

    /**
     * Resets the 1-minute auto-clear countdown.
     * Cancels any existing timer and starts a fresh 60-second timer
     * that calls clearAll() when it fires.
     */
    private resetClearTimer(): void {

        if (this.clearTimerId !== null) {
            clearTimeout(this.clearTimerId);
        }

        this.clearTimerId = setTimeout(() => {
            this.clearAll();
            this.clearTimerId = null;
        }, 60_000);
    }

    /**
     * Handles the 'Get Vault Password' button click.
     * Normalises username, shape, and sound inputs, joins them with single spaces
     * in the order: username shape sound, computes the SHA-1 hash, writes the
     * result to vaultPassword, then clears shape and sound inputs.
     * Resets the 1-minute auto-clear timer.
     */
    protected async getVaultPassword(): Promise<void> {
        const normUsername = this.normalise(this.username());
        const normShape = this.normalise(this.shape());
        const normSound = this.normalise(this.sound());
        const joined = `${normUsername}\x20${normShape}\x20${normSound}`;
        const hash = await sha1(joined);
        this.vaultPassword.set(hash);
        this.shape.set('');
        this.sound.set('');
        this.resetClearTimer();
    }

    /**
     * Handles the 'Get Service Password' button click.
     * Normalises the domain input (lowercase, trim, collapse spaces), then
     * concatenates it with the current vault password separated by a single space.
     * Computes the SHA-1 hash of the result, writes it to servicePassword,
     * then clears the domain input.
     * Resets the 1-minute auto-clear timer.
     */
    protected async getServicePassword(): Promise<void> {
        const normDomain = this.normalise(this.domain());
        const joined = `${normDomain}\x20${this.vaultPassword()}`;
        const hash = await sha1(joined);
        this.servicePassword.set(hash);
        this.domain.set('');
        this.resetClearTimer();
    }

    /**
     * Toggles the visibility of the chat log panel.
     */
    protected toggleChat(): void {
        this.showChat.update(v => !v);
    }

    /**
     * Toggles the visibility of the Apps overlay.
     */
    protected toggleApps(): void {
        this.showApps.update(v => !v);
    }

    /**
     * Angular lifecycle hook — cancels the pending clear timer on component
     * destruction to prevent callbacks firing on a destroyed component.
     */
    public ngOnDestroy(): void {

        if (this.clearTimerId !== null) {
            clearTimeout(this.clearTimerId);
        }
    }
}

