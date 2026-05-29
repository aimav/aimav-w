import { Component, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
// @ts-ignore: Importing JS module without type definitions
import appsData from '../data/apps.js';
// @ts-ignore: Importing JS module without type definitions
import extensionsData from '../data/extensions.js';
import { RouterOutlet } from '@angular/router';

// Import Showdown for markdown rendering
// Showdown import removed as not used
import { FormsModule } from '@angular/forms';
import { sha1 } from '../modules/common.js';

var log = console.log;
// Streaming guide: https://openrouter.ai/openrouter/free
const CURRENT_MODEL = "openrouter/free";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, FormsModule, CommonModule, MatMenuModule, MatButtonModule],
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
    public CUR_MODEL = CURRENT_MODEL;
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

    // List of apps for the overlay
    public apps = appsData;
    // List of extensions for the overlay
    public extensions = extensionsData;
    // Filtered lists used for display based on the filter input
    public filteredApps = signal(this.apps);
    public filteredExtensions = signal(this.extensions);
    public filteredPinned = signal(this.getPinnedApps());

    handleAppFilterKeyup(event: KeyboardEvent) {
        // Prevent default form/button behaviour just in case
        event?.preventDefault?.();
        const filterInput = (event.target as HTMLInputElement | null);

        function appinfo_contains_all(app: any, toks: any[]) {
            // name, description, id, url, tags
            var s = (app.name || "") + " " + (app.description || "") + " " + (app.id || "")
                + " " + (app.url || "") + " " + (app.tags ? app.tags.join(" ") : "");
            s = s.toLowerCase();

            for (var t of toks) {
                if (!s.includes(t))
                    return false;
            }
            return true;
        }

        if (filterInput) {
            var filterText = filterInput.value.trim().toLowerCase();
            filterText = filterText.replace(/\s+/g, '\x20');
            var toks = filterText.split("\x20");

            this.filteredApps.set(
                this.apps.filter((app: any) =>
                    appinfo_contains_all(app, toks)
                )
            );
            this.filteredExtensions.set(
                this.extensions.filter((ext: any) =>
                    appinfo_contains_all(ext, toks)
                )
            );
            this.filteredPinned.set(
                this.getPinnedApps().filter((app: any) =>
                    appinfo_contains_all(app, toks)
                )
            );
        }
    }

    resetAppFilter() {
        this.filteredApps.set(
            this.apps
        );
        this.filteredExtensions.set(
            this.extensions
        );
        this.filteredPinned.set(
            this.getPinnedApps()
        );
    }

    /**
     * Returns the list of pinned apps based on the IDs stored in localStorage.
     * The IDs are stored under the key 'pinnedApps' as a JSON array.
     */
    public getPinnedApps(): any[] {
        const stored = localStorage.getItem('pinnedApps');
        let ids: any[] = [];
        if (stored) {
            try {
                ids = JSON.parse(stored);
                if (!Array.isArray(ids)) ids = [];
            } catch {
                ids = [];
            }
        }
        // Match stored ids with app objects (assumes each app has a unique 'id' property)
        return this.apps.filter((app: any) => ids.includes(app.id));
    }

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
     * Handles the 'Set AI Key' button click.
     * Retrieves the value from the input element with id "input-ai-key"
     * and stores it in the browser's localStorage under the key "aiKey".
     * Uses Angular's ViewChild to access the element in an Angular‑friendly way.
     */
    public setAIKey(event: Event): void {
        // Prevent default form/button behaviour just in case
        event?.preventDefault?.();
        // Access the input element via the DOM. Since the element is not a component
        // property, we query it directly but still within Angular's zone.
        const input = (event.target as HTMLElement).ownerDocument.getElementById('input-ai-key') as HTMLInputElement | null;
        if (input) {
            const key = input.value.trim();
            if (key) {
                localStorage.setItem('aiKey', key);
                alert("AI key set");
            } else {
                // If empty, remove the stored key
                if (confirm('Are you sure you want to remove the AI key?'))
                    localStorage.removeItem('aiKey');
            }
        }
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
        this.resetAppFilter();
        this.showApps.update(v => !v);
    }

    @ViewChild('chatLog', { static: false }) chatLogDiv!: ElementRef<HTMLDivElement>;
    @ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;
    @ViewChild('fixedMenuTrigger') fixedMenuTrigger!: MatMenuTrigger;

    /** Holds the app currently right‑clicked for the context menu */
    public _contextApp: any = null;

    /** Open the app URL in a new browser tab */
    protected openApp(app: any): void {
        if (app && app.url) {
            window.open(app.url, '_blank');
        }
    }

    protected pinApp(app: any): void {
        // Retrieve existing pinned apps from localStorage or initialize empty array
        const stored = localStorage.getItem('pinnedApps');
        let pinned: any[] = [];
        if (stored) {
            try {
                pinned = JSON.parse(stored);
                if (!Array.isArray(pinned)) pinned = [];
            } catch {
                pinned = [];
            }
        }
        // Ensure the app has an identifier (use id property if present, otherwise the whole object)
        const appId = app?.id ?? app;
        // Add if not already present
        if (!pinned.includes(appId)) {
            pinned.push(appId);
        }
        // Save back to localStorage
        localStorage.setItem('pinnedApps', JSON.stringify(pinned));
        this.resetAppFilter();
    }

    protected unpinApp(app: any): void {
        // Retrieve existing pinned apps from localStorage or initialize empty array
        const stored = localStorage.getItem('pinnedApps');
        let pinned: any[] = [];
        if (stored) {
            try {
                pinned = JSON.parse(stored);
                if (!Array.isArray(pinned)) pinned = [];
            } catch {
                pinned = [];
            }
        }
        // Determine the identifier used for the app (same logic as pinApp)
        const appId = app?.id ?? app;
        // Remove the appId if present
        const index = pinned.indexOf(appId);
        if (index !== -1) {
            pinned.splice(index, 1);
        }
        // Save the updated list back to localStorage
        localStorage.setItem('pinnedApps', JSON.stringify(pinned));
        this.resetAppFilter();
    }

    menuPosition = { x: '0px', y: '0px' };

    /** Handle right‑click on an app tile to show the context menu */
    protected openContextMenu(event: MouseEvent, app: any): void {
        event.preventDefault();
        this._contextApp = app;
        // Set menu data for the trigger (used by the hidden fixed trigger)
        if (this.menuTrigger) {
            this.menuTrigger.menuData = { app };
        }
        // Open the hidden fixed trigger's menu and position it at the click location
        if (this.fixedMenuTrigger) {
            this.menuPosition = { x: event.clientX + 'px', y: event.clientY + 'px' };
            this.fixedMenuTrigger.openMenu();

            // const overlay = (this.fixedMenuTrigger as any).overlayRef;
            // if (overlay && typeof overlay.updatePosition === 'function') {
            //     overlay.updatePosition({
            //         originX: 'start', originY: 'top',
            //         overlayX: 'start', overlayY: 'top',
            //         offsetX: event.clientX,
            //         offsetY: event.clientY,
            //     });
            // }
        }
    }

    protected clearVaultPassword(): void {
        // Clear all input fields in the left column, including generated passwords.
        // Reuse existing clearAll method to reset signals.
        this.clearAll();
    }

    public async sendMessage(ev: Event) {
        ev.preventDefault();
        const message = this.chatInput();
        // Append the message to the chat log using Angular's ElementRef (Angular way, not direct DOM manipulation)
        if (this.chatLogDiv && this.chatLogDiv.nativeElement) {
            const entry = document.createElement('div');
            entry.innerHTML = `<b>You</b>: <span class="user-chat-message" style="background-color:yellow;"><b>${message}</b></span>`;
            this.chatLogDiv.nativeElement.appendChild(entry);
            this.chatLogDiv.nativeElement.scrollBy(0, Number.MAX_SAFE_INTEGER);
        }
        // Clear the input field
        this.chatInput.set("");

        // Send the message to OpenRouter if an API key is stored
        const apiKey = localStorage.getItem('aiKey');
        var modelName = null;
        // @ts-ignore - showdown is loaded globally from src/libs/showdown.min.js
        const converter = new (window as any).showdown.Converter({
            tables: true
        });
        var manuallyScrolled = false;

        this.chatLogDiv.nativeElement.addEventListener('wheel', (ev: Event) => {
            manuallyScrolled = true;
        });

        if (apiKey) {
            // Show a temporary "Asking model..." message in the chat log
            const askingDiv = document.createElement('div');
            askingDiv.textContent = 'Asking model...';
            this.chatLogDiv.nativeElement.appendChild(askingDiv);
            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'text/event-stream',
                    },
                    body: JSON.stringify({
                        model: CURRENT_MODEL,
                        messages: [{ role: 'user', content: message }],
                        stream: true
                    }),
                });

                // Stream response chunks to console before processing
                const reader = response.body?.getReader();
                const decoder = new TextDecoder('utf-8');
                let streamedText = '';
                // Create a temporary streaming block in the chat log
                const streamingDiv = document.createElement('div');
                streamingDiv.className = 'streaming';
                this.chatLogDiv.nativeElement.appendChild(streamingDiv);

                if (reader) {
                    while (true) {
                        const v = await reader.read();
                        const { done, value } = v;
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        if (chunk.trim().length == 0) continue;
                        if (!chunk.startsWith("data:")) continue;
                        // console.log('Stream chunk:', chunk);

                        let parts = chunk.split("\n");

                        for (let p of parts) {
                            p = p.slice(5).trim();
                            if (p == "[DONE]") break;
                            if (p.trim().length == 0) continue;
                            let obj;

                            try {
                                obj = JSON.parse(p);
                                streamedText += obj.choices[0].delta.content;
                            }
                            catch {
                                // streamedText += `\n[A-CHUNK]\n`;
                                streamedText += `...\x20`;
                            }
                            if (modelName == null && obj.model != null)
                                modelName = obj.model;
                        }

                        // Convert streamed markdown to HTML and display in the streaming block
                        try {
                            // @ts-ignore - showdown is loaded globally from src/libs/showdown.min.js
                            const html = converter.makeHtml(streamedText);
                            streamingDiv.innerHTML = `<strong>AI</strong> <small>(${modelName})</small>: ${html}`;

                            if (!manuallyScrolled)
                                this.chatLogDiv.nativeElement.scrollBy(0, Number.MAX_SAFE_INTEGER);

                            if (modelName == null) {
                                log("Null response from openrouter");
                                this.chatInput.set(message.trim());
                            }
                        } catch (e) {
                            console.error('Error converting markdown to HTML:', e);
                        }
                    }
                    streamingDiv.remove();
                }

                // Convert AI response markdown to HTML using Showdown
                try {
                    // @ts-ignore - showdown is loaded globally from src/libs/showdown.min.js                    
                    const aiMessage = streamedText;
                    var html = converter.makeHtml(aiMessage);
                    html += `<div><small>(Answered by ${modelName})</small></div>`;
                    const aiDiv = document.createElement('div');
                    aiDiv.innerHTML = `<strong>AI</strong> <small>(${modelName})</small>: ${html}`;
                    this.chatLogDiv.nativeElement.appendChild(aiDiv);
                    this.chatLogDiv.nativeElement.scrollBy(0, Number.MAX_SAFE_INTEGER);

                    if (modelName == null) {
                        log("Null response from openrouter");
                        this.chatInput.set(message.trim());
                    }
                } catch (e) {
                    console.error('Error converting markdown to HTML:', e);
                }
                // Remove the "Asking model..." placeholder after receiving response
                if (askingDiv.parentNode) {
                    askingDiv.parentNode.removeChild(askingDiv);
                }
            } catch (err) {
                console.error('Error calling OpenRouter:', err);
                // Ensure placeholder is removed even on error
                if (askingDiv.parentNode) {
                    askingDiv.parentNode.removeChild(askingDiv);
                }
            }
        }
    }

    public ngOnInit(): void {
        log("Apps data:", this.apps);
        this.apps = this.apps.sort((a: any, b: any) => a.name.localeCompare(b.name));
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

