import { ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Component, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';

import { createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { replicateGoogleDrive } from 'rxdb/plugins/replication-google-drive';

// Create a singleton instance
// const db = new AimavDB();
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
// Updated import to match new msgbox.ts which now exports a component instead of a service
import { MessageBoxComponent } from '../modules/msgbox';
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
const G_APP_CLIENT_ID = "819650177538-4qbhnjrmf22pamm6k0s7oq6u64i084is.apps.googleusercontent.com";

@Component({
    selector: 'app-root',
    standalone: true,
    // Import MsgBoxComponent (standalone) for displaying messages
    imports: [RouterOutlet, FormsModule, CommonModule, MatMenuModule, MatButtonModule, MessageBoxComponent],
    templateUrl: './app.html',
    styleUrl: './app.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
/**
 * Root component of the Aimav Web Application.
 * Serves as the entry point layout for the view layer.
 * Handles vault and service password generation, and auto-clears all
 * input fields 1 minute after the last password generation action.
 */
export class App implements OnDestroy {
    // Removed MessageService injection as msgbox now provides a component
    constructor(private cdr: ChangeDetectorRef) { }
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

    /** Whether the Apps overlay is visible. */
    protected showApps = signal(false);

    protected email = localStorage.getItem('gEmail') || 'None';

    // RxDB instance holder (initialized in ngOnInit)
    private db: any;

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


    async syncNow(event: Event) {
        await this.signInWithGoogle();

        // @ts-ignore
        // if (window.gAccessToken == null) {
        //     this.msgBox.showMsg("No Google Drive access token found, " +
        //         "click Sync Data to authenticate with Google Drive.");
        //     return;
        // }
        // const replicationState = await replicateGoogleDrive({
        //     replicationIdentifier: 'aimav-chatMessages',
        //     collection: this.db.chatMessages, // RxCollection
        //     googleDrive: {
        //         oauthClientId: G_APP_CLIENT_ID,
        //         // @ts-ignore
        //         authToken: window.gAccessToken, // USER_ACCESS_TOKEN
        //         folderPath: 'Aimav/chatMessages'
        //     },
        //     live: false, // Do full sync once when user clicks Sync Data
        //     pull: {
        //         batchSize: 60,
        //         modifier: doc => doc // (optional) modify invalid data
        //     },
        //     push: {
        //         batchSize: 60,
        //         modifier: doc => doc // (optional) modify before sending
        //     }
        // });

        // // Observe replication states
        // replicationState.error$.subscribe(err => {
        //     console.error('Replication error:', err);
        // });
        // replicationState.awaitInitialReplication().then(() => {
        //     console.log('Initial replication done');
        // });
    }


    /**
     * Load and display stored chat history from RxDB.
     * The collection `chatMessages` stores messages grouped by year.
     * This method queries all documents, iterates over each year's messages
     * and appends them to the chat log element.
     */
    public async showChatHistory(): Promise<void> {
        if (!this.db) {
            console.error('RxDB instance not initialized');
            return;
        }
        try {
            const year: number = new Date().getFullYear();
            const docs = await this.db.chatMessages.find({ year }).exec();
            let html = "Recent Messages: <br>";
            let count = 0;

            // Optionally clear previous entries except intro info
            // Append each year's messages
            for (const doc of docs) {
                for (const msg of doc.messages) {
                    html += `•\x20${msg.content}<br/>`;
                    count++;
                    if (count >= 100) break;
                }
                if (count >= 100) break;
            }
            if (count === 0) html += "(No messages yet)<br/>";
            this.msgBox.showMsg(html);
        }
        catch (e) {
            console.error('Failed to load chat history from RxDB', e);
        }
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
    // Reference to the message box component for showing messages
    @ViewChild(MessageBoxComponent) msgBox!: MessageBoxComponent;

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

    /**
     * Displays a message box with the current model name.
     * Uses the MessageService to show an informational toast.
     */
    /**
     * Displays a message box with the current model name.
     */
    /** Show a toast with the current model name. */
    public async showModelInfo(event: Event): Promise<void> {
        event.preventDefault();
        // Use the message box component to display the current model name
        if (this.msgBox) {
            this.msgBox.showMsg(`Current model: ${this.CUR_MODEL}`);
        } else {
            // Fallback in case the component reference is not available
            console.log(`Current model: ${this.CUR_MODEL}`);
        }
    }

    protected clearVaultPassword(): void {
        // Clear all input fields in the left column, including generated passwords.
        // Reuse existing clearAll method to reset signals.
        this.clearAll();
    }

    public async handleCredentialResponse(response: any): Promise<void> {
        // console.log(response);
        /*
        {
            "oauth_metadata": "xxx",
            "gis_params": "xxx",
            "iss": "https://accounts.google.com",
            "access_token": "ya29.xxx",
            "token_type": "Bearer",
            "expires_in": 3599,
            "scope": "email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid",
            "authuser": "0",
            "prompt": "consent"
        }
        */
        // @ts-ignore - window is not defined in this context
        window.gAccessToken = response.access_token;
        const accessToken = response.access_token;

        // fetch user info
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const user = await res.json();
        console.log(user.email, user.name);
        // @ts-ignore - localStorage is not defined in this context
        localStorage.gEmail = user.email;
        this.email = user.email;
        this.cdr.markForCheck(); // Tell Angular to re-check this component
    }

    gInitialized = false;

    /**
     * Placeholder for Google Sign‑In integration.
     * Currently logs a message; replace with real OAuth flow as needed.
     */
    public async signInWithGoogle(): Promise<void> {
        // https://developers.google.com/identity/gsi/web/guides/display-button#javascript        

        if (this.gInitialized == false) {
            // @ts-ignore - google is loaded globally from src/libs/gsi.js
            google.accounts.id.initialize({
                client_id: G_APP_CLIENT_ID,
                scope: "email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid"
            });
            this.gInitialized = true;
        }

        // @ts-ignore - google is loaded globally from src/libs/gsi.js
        // google.accounts.id.prompt(); // also display the One Tap dialog

        // @ts-ignore
        var [lock, unlock] = new_lock();
        const This = this;

        async function handleCredentialResponse(response: any) {
            try {
                await This.handleCredentialResponse(response);
            } finally {
                unlock();
            }
        }

        // @ts-ignore
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: G_APP_CLIENT_ID,
            scope: "email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid",
            callback: handleCredentialResponse
        });

        // prompt:
        // "consent" --> show 3 dialogs always -> clumpsy
        // "none" --> no dialogs -> no permissions
        // "select_account" -> choose acc only -> no permissions
        // null --> default
        // "" --> default? 3 dialogs once, 1 dialog after that
        tokenClient.requestAccessToken({ prompt: "" });
        await lock;
    }

    public async signOut() {
        if (this.gInitialized == false) {
            // @ts-ignore - google is loaded globally from src/libs/gsi.js
            google.accounts.id.initialize({
                client_id: G_APP_CLIENT_ID
            });
            this.gInitialized = true;
        }

        var email = localStorage.getItem('gEmail');
        // @ts-ignore
        var [lock, unlock] = new_lock();
        // @ts-ignore
        google.accounts.id.revoke(email, (response) => {
            console.log(response.successful, response.error);
            unlock();
        });
        await lock;
        localStorage.removeItem('gEmail');
        top?.location.reload();
    }

    // RxDB instance holder (initialized in ngOnInit)
    // (declaration moved to end of class)

    public async sendMessage(ev: Event) {
        ev.preventDefault();
        const message = this.chatInput();

        // Save the user's message to IndexedDB using RxDB
        // Store the message grouped by year. If a record for the current year exists,
        // push the new message into its `messages` array; otherwise create a new record.
        try {
            const currentYear = new Date().getFullYear();
            const newMsg = {
                // @ts-ignore – window.new_id is defined globally
                idstr: (window as any).new_id(),
                content: message,
                timestamp: Date.now()
            };

            // Attempt to fetch an existing year record using RxDB query
            const existingDoc = await this.db.chatMessages.findOne({ year: currentYear }).exec();

            if (existingDoc) {
                const msgs = existingDoc.get('messages') as any[];
                const updatedMsgs = Array.isArray(msgs) ? [...msgs, newMsg] : [newMsg];
                await existingDoc.update({ $set: { messages: updatedMsgs } });
            }
            else {
                // No record for this year yet – insert a new document
                // Generate a unique id for the document (e.g., using timestamp and year)
                // @ts-ignore
                const docId = window.new_id();
                await this.db.chatMessages.insert({
                    id: docId,
                    year: currentYear,
                    messages: [newMsg]
                });
            }
        }
        catch (e) {
            console.error('Failed to store chat message in IndexedDB via RxDB', e);
        }

        // Append the message to the chat log using Angular's ElementRef (Angular way, not direct DOM manipulation)
        if (this.chatLogDiv && this.chatLogDiv.nativeElement) {
            const entry = document.createElement('div');
            entry.innerHTML = `<b>You</b>: <span class="user-chat-message" style="background-color:yellow;"><b>${message}</b></span>`;
            this.chatLogDiv.nativeElement.appendChild(entry);
            this.chatLogDiv.nativeElement.scrollBy(0, Number.MAX_SAFE_INTEGER);
        }
        // Clear the input field
        this.chatInput.set("");

        this.chatLogDiv.nativeElement.querySelector("#intro-info")?.setAttribute("style", "display:none");

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

        if (!apiKey) {
            this.msgBox.showMsg("Please get AI key and save it on right column first.")
            return;
        }
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

    public async ngOnInit(): Promise<void> {
        log("Apps data:", this.apps);
        this.apps = this.apps.sort((a: any, b: any) => a.name.localeCompare(b.name));

        // Initialise RxDB and store the instance on the component for later use
        this.db = await createRxDatabase({
            name: 'aimav',
            storage: getRxStorageDexie(),
        });

        await this.db.addCollections({
            chatMessages: {
                schema: {
                    version: 0,
                    primaryKey: 'id', // FIELD
                    type: 'object',
                    properties: {
                        id: { type: 'string', maxLength: 100 }, // FIELD
                        year: { type: 'number' }, // FIELD
                        messages: { // FIELD
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    idstr: { type: 'string', maxLength: 100 }, // FIELD
                                    content: { type: 'string', maxLength: 1000 }, // FIELD
                                    timestamp: { type: "number" } // FIELD
                                },
                                required: ['idstr', 'content', 'timestamp'],
                            }
                        },
                    },
                    required: ['id', 'year', "messages"],
                }
            }
        });
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


