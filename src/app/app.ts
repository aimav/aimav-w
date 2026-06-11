import { ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Component, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { SelectBoxComponent } from '../modules/selectbox';

import * as mpModule from '@mediapipe/tasks-genai';

// RxDB imports removed – Dexie will be used instead
import { AppDexie } from './dexie-db';

// Create a singleton instance
// const db = new AimavDB();
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { NgToastModule, NgToastService, TOAST_POSITIONS } from 'ng-angular-popup';
// Updated import to match new msgbox.ts which now exports a component instead of a service
import { MessageBoxComponent } from '../modules/msgbox';
import { PromptBoxComponent } from '../modules/promptbox';
import { ConfirmBoxComponent } from '../modules/confirmbox';
// @ts-ignore: Importing JS module without type definitions
import appsData from '../data/apps.js';
// @ts-ignore: Importing JS module without type definitions
import extensionsData from '../data/extensions.js';
import { RouterOutlet } from '@angular/router';

// Import Showdown for markdown rendering
// Showdown import removed as not used
import { FormsModule } from '@angular/forms';
import { sha1 } from '../modules/common.js';

import IgSync from '../libs/igsync/igsync';
// FlexSearch for full‑text indexing of markdown files
import FlexSearch from 'flexsearch';

var log = console.log;
// Streaming guide: https://openrouter.ai/openrouter/free
const CURRENT_MODEL = "openrouter/free";
const G_APP_CLIENT_ID = "819650177538-4qbhnjrmf22pamm6k0s7oq6u64i084is.apps.googleusercontent.com";
const G_APP_API_KEY = "AIzaSyBbCJzvgQ7UTyhSLc6Ae4-XUP7Slvi3coo";
const DB_NAME = "AimavDB";

@Component({
    selector: 'app-root',
    standalone: true,
    // Import MsgBoxComponent (standalone) for displaying messages
    imports: [RouterOutlet, FormsModule, CommonModule, MatMenuModule, MatButtonModule, MessageBoxComponent, ConfirmBoxComponent, PromptBoxComponent, SelectBoxComponent, NgToastModule],
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
    TOAST_POSITIONS = TOAST_POSITIONS;
    @ViewChild('promptBox') promptBox!: PromptBoxComponent;
    // Alphabet array for navigation buttons
    alphabet: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    igSync: IgSync = new IgSync();

    /**
     * Navigate to home view.
     */
    navigateHome(): void {
        console.log('Home button clicked');
        this.selectedCategory = '';
        this.appsInCategory.set([]);

        // Hide the category app list and its heading
        const catList = document.getElementById('cat-app-list');
        const catHeading = document.getElementById('cat-app-list-heading');
        if (catList) catList.style.display = 'none';
        if (catHeading) catHeading.style.display = 'none';

        // Show pinned apps list and heading
        const pinnedList = document.getElementById('pinned-app-list');
        const pinnedHeading = document.getElementById('pinned-app-list-heading');
        if (pinnedList) pinnedList.style.display = 'flex';
        if (pinnedHeading) pinnedHeading.style.display = '';

        // Show all apps list and heading
        const allApps = document.getElementById('all-app-list');
        const allAppsHeading = document.getElementById('all-app-list-heading');
        if (allApps) allApps.style.display = 'flex';
        if (allAppsHeading) allAppsHeading.style.display = '';

        // Show all extensions list and heading
        const allExt = document.getElementById('all-ext-list');
        const allExtHeading = document.getElementById('all-ext-list-heading');
        if (allExt) allExt.style.display = 'flex';
        if (allExtHeading) allExtHeading.style.display = '';
    }

    /**
     * Handle alphabet button click.
     * @param letter The clicked letter.
     */
    async navigateLetter(letter: string): Promise<void> {
        console.log('Letter clicked:', letter);
        // Convert to lowercase for case‑insensitive match
        const lower = letter.toLowerCase();

        if (!this.db || !this.db.appCategories) {
            console.error('RxDB not initialized or appCategories collection missing');
            return;
        }
        // Query categories where categoryName starts with the selected letter
        const docs = await this.db.appCategories
            .where('categoryName')
            .startsWithIgnoreCase(lower)
            .limit(100)
            .toArray();
        const options: { [key: string]: string } = {};

        function uppercaseWords(str: string): string {
            return str.replace(/\b\w/g, (char) => char.toUpperCase()).trim()
                .replace(/[\s]{2,}/g, '\x20');
        }
        docs.forEach((doc: any) => {
            const name = uppercaseWords(doc.categoryName as string);
            options[name.toLowerCase()] = uppercaseWords(name);
        });

        if (Object.keys(options).length == 0) {
            // await this.msgBox.showMsg("No categories found");
            this.toast.info(`Letter ${letter.toUpperCase()}: No categories found`);
            return;
        }
        else
            if (this.selectBox) {
                this.toggleApps();
                const selectedCategory = await this.selectBox.showOptions("Select category:", options);
                // Store the selected category name for UI display (non‑null after the guard above)
                this.selectedCategory = uppercaseWords(selectedCategory as string);
                log(selectedCategory);

                if (!selectedCategory) {
                    this.toggleApps();
                    return;
                }
                // Show apps in the selected category
                // Find the category document where categoryName matches the selectedCategory
                try {
                    const catDoc = await this.db.appCategories
                        .where('categoryName')
                        .equals(selectedCategory)
                        .first();
                    if (catDoc && catDoc.apps) {
                        // Update the appsInCategory signal with the apps from the category
                        // Ensure apps are sorted for consistent display
                        this.appsInCategory.set(this.sortApps(catDoc.apps));
                        // Also update the filtered signal used by the UI
                        this.filteredCatApps.set(this.sortApps(catDoc.apps));
                    } else {
                        // Use info toast as warning alternative
                        this.toast.info(`No apps found for category ${selectedCategory}`);
                    }
                } catch (e) {
                    console.error('Error fetching apps for category', e);
                    // Use info toast as fallback for error messages
                    this.toast.info('Failed to load apps for selected category');
                }
                // Keep the apps overlay open to display the category apps
                this.toggleApps();
            }
            else {
                console.warn('SelectBoxComponent not available');
            }
    }

    /**
     * Handle Others button click.
     */
    navigateOther(): void {
        console.log('Others button clicked');
        // Implement navigation for other items.
    }

    // Removed MessageService injection as msgbox now provides a component
    @ViewChild(SelectBoxComponent) selectBox!: SelectBoxComponent;
    constructor(private cdr: ChangeDetectorRef, private toast: NgToastService) { }
    public CUR_MODEL = CURRENT_MODEL;
    protected readonly title = signal('aimav-w');
    // Currently selected category name (used in the UI header)
    public selectedCategory: string = '';

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
    public filteredApps = signal<any[]>(this.sortApps(this.apps));
    public filteredExtensions = signal<any[]>(this.extensions);
    // Initialize with empty list; will be populated after DB load
    public filteredPinned = signal<any[]>([]);
    // Signal holding apps for the selected category (typed to any[] to avoid "never" inference)
    public appsInCategory = signal<any[]>([]);
    // Filtered view of category apps (typed to any[])
    public filteredCatApps = signal<any[]>([]);

    async handleAppFilterKeyup(event: KeyboardEvent) {
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
                this.sortApps(this.apps.filter((app: any) =>
                    appinfo_contains_all(app, toks)
                ))
            );
            this.filteredExtensions.set(
                this.extensions.filter((ext: any) =>
                    appinfo_contains_all(ext, toks)
                )
            );
            const pinned = await this.getPinnedApps();
            this.filteredPinned.set(
                this.sortApps(pinned.filter((app: any) =>
                    appinfo_contains_all(app, toks)
                ))
            );
        }
    }

    async resetAppFilter() {
        this.filteredApps.set(
            this.sortApps(this.apps)
        );
        this.filteredExtensions.set(
            this.extensions
        );
        const pinned = await this.getPinnedApps();
        this.filteredPinned.set(
            this.sortApps(pinned)
        );
    }

    /**
     * Returns the list of pinned apps based on the IDs stored in localStorage.
     * The IDs are stored under the key 'pinnedApps' as a JSON array.
     */
    /**
     * Returns the list of pinned apps.
     * Previously this read IDs from localStorage and matched them against the static apps list.
     * It now loads the pinned apps directly from the Dexie `pinnedApps` object store.
     * Custom apps stored in localStorage under 'customApps' are still merged in.
     */
    public async getPinnedApps(): Promise<any[]> {
        // Load pinned apps from Dexie store
        let pins: any[] = [];
        if (this.db && this.db.pinnedApps) {
            try {
                pins = await this.db.pinnedApps.toArray();
            } catch (e) {
                console.error('Failed to load pinned apps from Dexie', e);
                pins = [];
            }
        }

        // Load custom apps from Dexie `customApps` table
        let customApps: any[] = [];
        if (this.db && this.db.customApps) {
            try {
                const stored = await this.db.customApps.toArray();
                customApps = stored.map((app: any) => ({
                    ...app,
                    integrated: false,
                    internal: false,
                    custom: true,
                }));
            } catch (e) {
                console.error('Failed to load custom apps from Dexie', e);
                customApps = [];
            }
        }
        return pins.concat(customApps);
    }

    /**
     * Sort a list of apps so that those with `internal=true` appear first,
     * followed by alphabetical order of the app name (case‑insensitive).
     */
    private sortApps(list: any[]): any[] {
        return list.slice().sort((a: any, b: any) => {
            const aInternal = !!a.internal;
            const bInternal = !!b.internal;
            if (aInternal !== bInternal) {
                return aInternal ? -1 : 1;
            }
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            return nameA.localeCompare(nameB);
        });
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
    public async setAIKey(event: Event): Promise<void> {
        // Prevent default form/button behaviour just in case
        event?.preventDefault?.();
        // Access the input element via the DOM. Since the element is not a component
        // property, we query it directly but still within Angular's zone.
        const input = (event.target as HTMLElement).ownerDocument.getElementById('input-ai-key') as HTMLInputElement | null;

        if (input) {
            const key = input.value.trim();
            if (key) {
                localStorage.setItem('aiKey', key);
                this.msgBox.showMsg("AI key set");
            } else {
                // If empty, remove the stored key
                if ((await this.showConfirm('Are you sure you want to remove the AI key?')) == 'yes')
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

    // Sync indexeddb to google drive
    async syncNow(event: Event) {
        await this.signInWithGoogle();

        // @ts-ignore
        if (window.gAccessToken == null) {
            this.msgBox.showMsg("No Google Drive access token found, " +
                "click Sync Data to authenticate with Google Drive.");
            return;
        }

        const igSync = this.igSync;
        this.toast.info("Initializing Google Drive...");
        // @ts-ignore
        await igSync.init(this, this.db, G_APP_CLIENT_ID, G_APP_API_KEY, window.gAccessToken);
        await igSync.sync(DB_NAME);
    }

    /**
     * Load and display stored chat history from RxDB.
     * The collection `chatMessages` stores messages grouped by year.
     * This method queries all documents, iterates over each year's messages
     * and appends them to the chat log element.
     */
    public async showChatHistory(): Promise<void> {
        if (!this.db) {
            console.error('Dexie DB not initialized');
            return;
        }
        try {
            const year: number = new Date().getFullYear();
            const docs = await this.db.chatMessages.where('year').equals(year).toArray();
            let html = "<u>Recent Messages:</u> <br>";
            let count = 0;
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
        } catch (e) {
            console.error('Failed to load chat history from Dexie', e);
        }
    }

    /**
     * Toggles the visibility of the Apps overlay.
     */
    protected toggleApps(): void {
        this.resetAppFilter();
        this.showApps.update(v => !v);
    }

    // Add custom app using PromptBoxComponent
    protected async addCustomApp(): Promise<void> {
        // Keep the apps overlay open to display the category apps
        // (toggleApps was called earlier to close, now reopen)
        this.toggleApps();
        // this.cdr.detectChanges();
        // await new Promise(resolve => setTimeout(resolve, 0));

        // Ask for app name
        const name = await this.promptBox.showPrompt('Enter custom app name:');

        if (!name) {
            this.toggleApps();
            return;
        }

        // Ask for URL
        const url = await this.promptBox.showPrompt('Enter custom app URL:');

        if (!url) {
            this.toggleApps();
            return;
        }
        // console.log('Custom app added:', name, url);

        // Store custom apps in Dexie `customApps` table and keep localStorage for backward compatibility
        // First, add to Dexie
        if (this.db && this.db.customApps) {
            try {
                // Generate a simple id if not provided
                const id = (window as any).new_id ? (window as any).new_id() : `${Date.now()}`;
                await this.db.customApps.add({ id, name, url, integrated: false, internal: false, custom: true });
            } catch (e) {
                console.error('Failed to add custom app to Dexie', e);
            }
        }
        // Legacy localStorage persistence removed – Dexie is now the sole source of truth for custom apps.
        this.toggleApps();
    }

    public commonFtsCache: any = null;
    public commonIndex: any = null;

    //
    async mountCommonIndex(): Promise<any> {
        this.commonFtsCache = new FlexSearch.IndexedDB("Cache");
        const commonIndex = new FlexSearch.Document({
            // Basic configuration – can be tuned later
            tokenize: "forward",
            // Encode function to normalize text to lower case and split into tokens
            encode: (text: string) => text.toLowerCase().split(/\s+/),
            document: {
                // The unique identifier for each document
                id: "path",
                // Fields to be indexed
                index: ["content", "folderId"]
            }
        });
        await commonIndex.mount(this.commonFtsCache);
        return commonIndex;
    }

    //
    /**
     * Indexes all markdown files within the provided directory handle using FlexSearch.
     *
     * @param dirHandle - A FileSystemDirectoryHandle obtained via the File System Access API.
     */
    async indexFts(dirHandle: any, folderId: string): Promise<void> {
        // Create a FlexSearch index named 'commonIndex'
        // Use FlexSearch Document for indexing with fields
        var commonIndex = await this.mountCommonIndex();

        /**
         * Recursively walk through a directory and collect markdown file handles.
         */
        const walk = async (handle: any, pathPrefix: string = "") => {
            for await (const entry of handle.values()) {
                const entryPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;

                if (entry.kind === "file" && entry.name.endsWith('.md')) {
                    try {
                        const file = await entry.getFile();
                        const text = await file.text();
                        // Add to FlexSearch index – using the file path as the document id
                        // Add document to the index: first argument is the id, second is the fields object
                        commonIndex.add(entryPath, { content: text, folderId: folderId });
                    } catch (e) {
                        console.error('Failed to read markdown file', entryPath, e);
                    }
                } else if (entry.kind === "directory") {
                    // Recurse into sub‑directory
                    await walk(entry, entryPath);
                }
            }
        };

        try {
            await walk(dirHandle, folderId);
            // Store the index on the component instance for later use (optional)
            (this as any).commonIndex = commonIndex;
            this.toast.success('Indexed markdown files for full‑text search');
        } catch (e) {
            console.error('Error while indexing files', e);
            this.toast.info('Failed to build search index');
        }
        commonIndex.commit();
    }

    async chooseData(): Promise<void> {
        // Inform the user about the action
        await this.msgBox.showMsg("Now choose a folder with data for AI to read, for example, " +
            "the folders used for the built-in Notebook app.<br>" +
            "This folder will be added to a list of data folders.");

        // Prompt the user to pick a directory using the File System Access API
        let dirHandle: any;

        try {
            // @ts-ignore – showDirectoryPicker may not be in TypeScript lib
            dirHandle = await (window as any).showDirectoryPicker();
        } catch (e) {
            console.error('Directory picker cancelled or not supported', e);
            this.toast.info('Directory selection cancelled');
            return;
        }
        if (!dirHandle) {
            this.toast.info('No directory selected');
            return;
        }
        // Previously used the directory name as the folder ID.
        // Now read the identifier from the marker file "aimav-folder.id" located inside the selected folder.
        let folderId: string;
        try {
            const idFileHandle = await dirHandle.getFileHandle('aimav-folder.id');
            const file = await idFileHandle.getFile();
            folderId = await file.text();
            folderId = folderId.trim();
        } catch (e) {
            // If the marker file cannot be read, fall back to using the directory name.
            console.warn('Failed to read aimav-folder.id, falling back to directory name', e);
            // @ts-ignore
            folderId = window.new_id();
        }

        // Check if the marker file already exists in the chosen folder
        let markerExists = false;

        try {
            await dirHandle.getFileHandle('aimav-folder.id');
            markerExists = true;
        } catch (_) {
            // file does not exist – that's fine
        }

        // Check if this folder is already recorded in Dexie
        let alreadySaved = false;

        if (this.db && this.db.dataFolders) {
            const existing = await this.db.dataFolders.where('id').equals(folderId).first();
            alreadySaved = !!existing;
        }

        // Only proceed if the marker file is missing and the folder is not yet saved
        if (!markerExists && !alreadySaved) {
            // Save the directory handle to Dexie
            try {
                await this.db.dataFolders.add({ id: folderId, handle: dirHandle });
            } catch (e) {
                console.error('Failed to save data folder handle', e);
                this.toast.info('Failed to save folder');
                return;
            }
            // Create the marker file with a new id
            try {
                const fileHandle = await dirHandle.getFileHandle('aimav-folder.id', { create: true });
                const writable = await fileHandle.createWritable();
                const newId = (window as any).new_id ? (window as any).new_id() : `${Date.now()}`;
                await writable.write(newId);
                await writable.close();
            } catch (e) {
                console.error('Failed to create marker file', e);
                this.toast.info('Folder saved but failed to create marker file');
                return;
            }
            this.toast.success('Data folder added successfully');
        } else {
            this.toast.info('Folder already added or marker file exists');
        }
        this.indexFts(dirHandle, folderId);
    }

    async removeFromCategory(app: any): Promise<void> {
        // Ensure a category is selected
        if (!this.selectedCategory || this.selectedCategory.trim() === "") {
            this.toast.info("No category selected");
            return;
        }
        // Stored as lowercase with single spaces in db
        var selectedCategory = this.selectedCategory.toLocaleLowerCase().trim()
            .replace(/[\s]{2,}/g, '\x20');

        if (!this.db || !this.db.appCategories) {
            console.error('RxDB not initialized or appCategories collection missing');
            this.toast.info('Database not ready');
            return;
        }

        // Find the category document matching the selected category name
        const catDoc = await this.db.appCategories
            .where('categoryName')
            .equals(selectedCategory)
            .first();

        if (!catDoc) {
            this.toast.info(`Category ${selectedCategory} not found`);
            return;
        }
        if (!catDoc.apps || catDoc.apps.length === 0) {
            this.toast.info(`No apps in category ${selectedCategory}`);
            return;
        }
        const index = catDoc.apps.findIndex((a: any) => a.url === app.url);
        if (index === -1) {
            this.toast.info('App not found in selected category');
            return;
        }
        const newApps = catDoc.apps.slice();
        newApps.splice(index, 1);
        await this.db.appCategories.put({ ...catDoc, apps: newApps });
        this.igSync.markChanged(DB_NAME, "appCategories", catDoc.id);

        this.toast.info(`Removed app from ${selectedCategory}`);
    }

    /**
     * Prompt the user to edit the currently selected category name.
     * Uses PromptBoxComponent to get the new name, defaulting to the current name.
     * Updates the category document in the appCategories collection, storing the
     * name in lowercase (as used throughout the database queries).
     */
    async editCategory(): Promise<void> {
        // Ensure a category is selected
        if (!this.selectedCategory || this.selectedCategory.trim() === "") {
            this.toast.info("No category selected");
            return;
        }
        this.toggleApps();

        // Prompt for new name, default to current displayed name
        const newName = await this.promptBox.showPrompt('Edit category name:', this.selectedCategory);

        if (!newName) {
            // User cancelled or entered empty string
            this.toggleApps();
            return;
        }

        // Normalise the name for storage (lowercase, single spaces)
        const normalized = newName.toLowerCase().trim().replace(/[\s]{2,}/g, '\x20');

        // Find the existing category document
        // Dexie does not support findOne; use where + equals + first() to fetch the document
        const catDoc = await this.db.appCategories
            .where('categoryName')
            .equals(this.selectedCategory.toLowerCase())
            .first();

        if (!catDoc) {
            this.toast.info(`Category ${this.selectedCategory} not found`);
            this.toggleApps();
            return;
        }

        // Update the categoryName field
        // Dexie collection documents do not have a .patch() method. Use the table's update method instead.
        await this.db.appCategories.update(catDoc.id, { categoryName: normalized });
        this.igSync.markChanged(DB_NAME, "appCategories", catDoc.id);

        // Update UI state
        this.selectedCategory = newName;
        this.toast.success('Category name updated');
        this.toggleApps();
    }

    async delCategory(): Promise<void> {
        // Ensure a category is selected
        if (!this.selectedCategory || this.selectedCategory.trim() === "") {
            this.toast.info("No category selected");
            return;
        }
        this.toggleApps();

        // Ask for confirm
        const confirm = await this.confirmBox.showConfirm('Sure to delete category: '
            + this.selectedCategory + "?");

        if (confirm != "yes") {
            // User cancelled or entered empty string
            this.toggleApps();
            return;
        }

        // Find the existing category document
        // Dexie does not support findOne; use where + equals + first()
        const catDoc = await this.db.appCategories
            .where('categoryName')
            .equals(this.selectedCategory.toLowerCase())
            .first();

        if (!catDoc) {
            this.toast.info(`Category ${this.selectedCategory} not found`);
            this.toggleApps();
            return;
        }

        // Delete the category document using Dexie's delete method
        await this.db.appCategories.delete(catDoc.id);
        this.igSync.markChanged(DB_NAME, "appCategories", catDoc.id, "deleted");

        // Update UI state
        this.selectedCategory = "";
        this.toast.success('Category deleted');
        this.toggleApps();
    }

    uppercaseWords(str: string): string {
        return str.replace(/\b\w/g, (char) => char.toUpperCase()).trim()
            .replace(/[\s]{2,}/g, '\x20');
    }

    protected async addToCategory(app: any): Promise<void> {
        this.toggleApps();
        // Ask user whether to add to an existing category or create a new one
        const useExisting = await this.confirmBox.showConfirm('Add to existing category?');

        let categoryName: string | null = null;

        if (useExisting === 'yes') {
            // Retrieve all category names from RxDB
            if (!this.db || !this.db.appCategories) {
                console.error('Dexie DB not initialized or appCategories table missing');
                this.toggleApps();
                return;
            }
            // Dexie does not have a .find() method; retrieve all category documents via toArray()
            const docs = await this.db.appCategories.toArray();
            const options: { [key: string]: string } = {};
            docs.forEach((doc: any) => {
                const name = (doc.categoryName as string).toLowerCase();
                options[name] = this.uppercaseWords(name);
            });
            if (Object.keys(options).length === 0) {
                this.toast.info('No existing categories found');
                this.toggleApps();
                return;
            }
            const selected = await this.selectBox.showOptions('Select category:', options);

            if (!selected) {
                this.toggleApps();
                return;
            }
            categoryName = this.uppercaseWords(selected.toString());
        }
        else {
            // Ask for new category name using PromptBoxComponent
            categoryName = await this.promptBox.showPrompt('Enter new category name:');

            if (!categoryName) {
                this.toggleApps();
                return;
            }
        }
        if (!this.db || !this.db.appCategories) {
            console.error('RxDB not initialized or appCategories collection missing');
            log("db:", this.db);
            log("appCategories:", this.db.appCategories);
            this.toggleApps();
            return;
        }
        categoryName = categoryName.toLowerCase().trim().replace(/[\s]{2,}/g, '\x20');

        // Find existing category document
        // Dexie does not support findOne; use where + equals + first()
        const existing = await this.db.appCategories
            .where('categoryName')
            .equals(categoryName)
            .first();
        const appInfo = { idstr: app.id, name: app.name, url: app.url, icon: app.icon };
        log(existing)
        log(appInfo)

        if (appInfo.icon == null)
            appInfo.icon = "https://www.google.com/s2/favicons?sz=256&domain_url=" + appInfo.url;

        if (existing) {
            // Update existing category – add app if not already present
            const already = existing.apps.find((a: any) => a.idstr === app.id);

            if (!already) {
                // Update the existing document by adding the new appInfo to the apps array.
                // Dexie does not provide a .patch() method; use the table's .update() instead.
                await this.db.appCategories.update(existing.id, {
                    apps: [...existing.apps, appInfo]
                });
                this.igSync.markChanged(DB_NAME, "appCategories", existing.id);

                // Optionally, update the search tokens as well.
                // await this.db.appCategories.update(existing.id, {
                //     tokens: this.tokenize(`${categoryName} ${app.name} ${app.url}`)
                // });
            }
        }
        else {
            // Create new category document
            const id = (window as any).new_id ? (window as any).new_id() : `${Date.now()}`;
            const tokens = this.tokenize(`${categoryName} ${app.name} ${app.url}`);
            // Dexie uses add for inserting new records into a table.
            await this.db.appCategories.add({
                id,
                categoryName,
                tokens,
                apps: [appInfo]
            });
            this.igSync.markChanged(DB_NAME, "appCategories", id);
        }
        this.toggleApps();
    }

    @ViewChild('chatLog', { static: false }) chatLogDiv!: ElementRef<HTMLDivElement>;
    @ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;
    @ViewChild('fixedMenuTrigger') fixedMenuTrigger!: MatMenuTrigger;
    // Reference to the message box component for showing messages
    @ViewChild(MessageBoxComponent) msgBox!: MessageBoxComponent;

    // Reference to the confirm box component for showing messages
    @ViewChild(ConfirmBoxComponent) confirmBox!: ConfirmBoxComponent;

    protected async showConfirm(msg: string): Promise<"yes" | "no"> {
        return await this.confirmBox.showConfirm(msg);
    }

    /** Holds the app currently right‑clicked for the context menu */
    public _contextApp: any = null;

    /** Open the app URL in a new browser tab */
    protected openApp(app: any): void {
        if (app && app.url) {
            window.open(app.url, '_blank');
        }
    }

    protected pinApp(app: any): void {
        // Persist pinned app using Dexie only. LocalStorage is no longer used for pinned apps.
        if (this.db && this.db.pinnedApps) {
            (async () => {
                try {
                    // Avoid duplicate entries based on the app's URL.
                    const existing = await this.db.pinnedApps
                        .where('url')
                        .equals(app.url)
                        .first();
                    if (!existing) {
                        await this.db.pinnedApps.add(app);
                        this.igSync.markChanged(DB_NAME, "pinnedApps", app.id);
                    }
                } catch (e) {
                    console.error('Error adding pinned app to Dexie', e);
                }
            })();
        }
        // Refresh UI after pinning.
        this.resetAppFilter();
    }

    // 
    protected async unpinApp(app: any): Promise<void> {
        // Remove the pinned app using Dexie. LocalStorage is no longer the source of truth.
        if (this.db && this.db.pinnedApps) {
            try {
                // Delete the specific app entry by its unique identifier (id or url).
                // Prefer id if present, otherwise fall back to url.
                const query = app.id ? this.db.pinnedApps.where('id').equals(app.id) : this.db.pinnedApps.where('url').equals(app.url);
                const existing = await query.first();
                if (existing) {
                    await query.delete();
                    this.igSync.markDeleted(DB_NAME, "pinnedApps", existing.id);
                }
            } catch (e) {
                console.error('Error removing pinned app from Dexie', e);
            }
        }
        // Refresh UI filters to reflect the change.
        this.resetAppFilter();
    }

    // Ensure proper spacing before the next member as per coding conventions
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

    tokenize(str: string) {
        const tokens = this.normalise(str).split(' ');
        return tokens.filter(t => t.length > 0);
    }

    public aiModel = null;

    //
    public async loadModel(event: Event): Promise<void> {
        event?.preventDefault?.();
        await this.msgBox.showMsg("Pick the model file downloaded");

        try {
            const [fileHandle] = await (window as any).showOpenFilePicker({
                types: [{
                    description: 'Gemma Model',
                    accept: { 'application/octet-stream': ['.task'] }
                }],
                excludeAcceptAllOption: true,
                multiple: false
            });
            this.toast.info("Loading file");
            const file = await fileHandle.getFile();
            const modelBuffer = await file.arrayBuffer();

            const {
                FilesetResolver,
                LlmInference
            } = mpModule;
            this.toast.info("Initializing MediaPipe");
            const genai = await FilesetResolver.forGenAiTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm'
            );

            this.toast.info("Creating LLM");
            const llm = await LlmInference.createFromOptions(genai, {
                baseOptions: {
                    modelAssetBuffer: new Uint8Array(modelBuffer)
                },
                maxTokens: 24 * 1000, // max all:32k, max out:8k
                // preferredBackend: 'GPU'
            });
            (this as any).aiModel = llm;
            this.toast.success('LLM loaded successfully');

            const input = (event.target as HTMLElement).ownerDocument.getElementById('input-ai-key') as HTMLInputElement | null;

            if (input) {
                input.value = fileHandle.name;
                this.modelName = fileHandle.name;
            }
        }
        catch (e) {
            console.error('Failed to load AI model', e);
            this.toast.info('Failed to load model');
        }
    }

    // 
    /**
     * Sends a prompt to the locally loaded LLM model (aiModel) and displays the response.
     * The model is created elsewhere via LlmInference.createFromOptions and stored in `aiModel`.
     */
    public async askLocalModel(message: string): Promise<void> {
        if (this.aiModel == null) {
            this.msgBox.showMsg("AI Model not loaded.");
            return;
        }

        // @ts-ignore - showdown is loaded globally from src/libs/showdown.min.js
        const converter = new (window as any).showdown.Converter({
            tables: true
        });
        var manuallyScrolled = false;
        this.chatLogDiv.nativeElement.addEventListener('wheel', (ev: Event) => {
            manuallyScrolled = true;
        });

        // Show a temporary "Asking model..." message in the chat log
        const askingDiv = document.createElement('div');
        askingDiv.textContent = 'Asking model...';
        this.chatLogDiv.nativeElement.appendChild(askingDiv);

        try {
            // Stream response chunks to console before processing
            let streamedText = '';
            // Create a temporary streaming block in the chat log
            const streamingDiv = document.createElement('div');
            streamingDiv.className = 'streaming';
            this.chatLogDiv.nativeElement.appendChild(streamingDiv);

            // Gemma 3 tags, gemma 4 is different (eg. <|turn>, <turn|>...)
            var textPrompt =
                `<bos><start_of_turn>user\n` +
                `${message.trim()}\n` +
                `<end_of_turn>\n` +
                `<start_of_turn>model\n`;

            await (this.aiModel as any).generateResponse(textPrompt, (chunk: any, done: boolean) => {
                if (chunk.trim().length == 0) return;
                // console.log('Stream chunk:', chunk);
                streamedText += chunk;

                // Convert streamed markdown to HTML and display in the streaming block
                try {
                    // @ts-ignore - showdown is loaded globally from src/libs/showdown.min.js
                    const html = converter.makeHtml(streamedText);
                    streamingDiv.innerHTML = `<strong>AI</strong> <small>(${this.modelName})</small>: ${html}`;

                    if (!manuallyScrolled)
                        this.chatLogDiv.nativeElement.scrollBy(0, Number.MAX_SAFE_INTEGER);
                } catch (e) {
                    console.error('Error converting markdown to HTML:', e);
                }
            });
            streamingDiv.remove();

            // Convert AI response markdown to HTML using Showdown
            try {
                // @ts-ignore - showdown is loaded globally from src/libs/showdown.min.js                    
                const aiMessage = streamedText;
                var html = converter.makeHtml(aiMessage);
                html += `<div><small>(Answered by ${this.modelName})</small></div>`;
                const aiDiv = document.createElement('div');
                aiDiv.innerHTML = `<strong>AI</strong> <small>(${this.modelName})</small>: ${html}`;
                this.chatLogDiv.nativeElement.appendChild(aiDiv);
                this.chatLogDiv.nativeElement.scrollBy(0, Number.MAX_SAFE_INTEGER);
            } catch (e) {
                console.error('Error converting markdown to HTML:', e);
            }
            // Remove the "Asking model..." placeholder after receiving response
            if (askingDiv.parentNode) {
                askingDiv.parentNode.removeChild(askingDiv);
            }
        } catch (err) {
            console.error('Error calling model:', err);
            // Ensure placeholder is removed even on error
            if (askingDiv.parentNode) {
                askingDiv.parentNode.removeChild(askingDiv);
            }
        }
    } // askLocalModel

    public modelName: string = "";

    //
    public async askOpenRouter(message: string): Promise<void> {
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

    //
    public async sendMessage(ev: Event) {
        ev.preventDefault();
        const message = this.chatInput();

        // Save the user's message to IndexedDB using RxDB
        // Store the message grouped by year. If a record for the current year exists,
        // push the new message into its `messages` array; otherwise create a new record.
        try {
            const currentYear = new Date().getFullYear();
            // Prepare the new message object and compute token array from its content
            const tokenArray = this.normalise(message).split(' ');
            const newMsg = {
                // @ts-ignore – window.new_id is defined globally
                idstr: (window as any).new_id(),
                content: message,
                timestamp: Date.now()
            };

            // Attempt to fetch an existing year record using RxDB query
            // Dexie does not support findOne; use where().equals().first() to fetch the record for the current year
            const existingDoc = await this.db.chatMessages.where('year').equals(currentYear).first();

            if (existingDoc) {
                // Dexie returns plain objects; access fields directly
                const msgs = (existingDoc as any).messages as any[];
                const updatedMsgs = Array.isArray(msgs) ? [...msgs, newMsg] : [newMsg];
                // Update tokens field by appending tokens from the new message
                const existingTokens = (existingDoc as any).tokens as any[] || [];
                const updatedTokens = Array.isArray(existingTokens) ? [...existingTokens, ...tokenArray] : [...tokenArray];
                // Use Dexie's modify to update the existing record
                await this.db.chatMessages.where('year').equals(currentYear).modify({
                    messages: updatedMsgs,
                    tokens: updatedTokens
                });
                this.igSync.markChanged(DB_NAME, "chatMessages", existingDoc.id);
            }
            else {
                // No record for this year yet – insert a new document
                // Generate a unique id for the document (e.g., using timestamp and year)
                // @ts-ignore
                const docId = window.new_id();
                // Dexie uses add/put for inserting new records. Use add to create a new document.
                await this.db.chatMessages.add({
                    id: docId,
                    year: currentYear,
                    messages: [newMsg],
                    tokens: tokenArray
                });
                this.igSync.markChanged(DB_NAME, "chatMessages", docId);
            }
        }
        catch (e) {
            console.error('Failed to store chat message in IndexedDB via RxDB', e);
        }

        // Append the message to the chat log using Angular's ElementRef (Angular way, not direct DOM manipulation)
        if (this.chatLogDiv && this.chatLogDiv.nativeElement) {
            const entry = document.createElement('div');
            entry.innerHTML = `<h1 style="border-left:1px solid silver;">&nbsp;</h1><b>You</b>: <span class="user-chat-message" style="background-color:yellow;"><b>${message}</b></span>`;
            this.chatLogDiv.nativeElement.appendChild(entry);
            this.chatLogDiv.nativeElement.scrollBy(0, Number.MAX_SAFE_INTEGER);
        }
        // Clear the input field
        this.chatInput.set("");
        this.chatLogDiv.nativeElement.querySelector("#intro-info")?.setAttribute("style", "display:none");
        // Use FlexSearch cache to find items matching the message
        try {
            // Perform a search on the common FlexSearch cache using the user's message
            // FlexSearch.IndexedDB does not have a typed `search` method in the current typings,
            // so we cast to `any` to bypass the TypeScript error while still invoking the runtime method.
            // Use the FlexSearch Document index for searching instead of the IndexedDB cache,
            // which does not provide a .search method. The index was stored on the component
            // instance as `commonIndex` during indexing.
            this.commonIndex = await this.mountCommonIndex();
            const ftsResults = await (this as any).commonIndex.search(message, {
                suggest: true
            });

            if (ftsResults && ftsResults.length) {
                // Show a toast with the number of matches found
                this.toast.info(`FlexSearch found ${ftsResults.length} matching item(s)`);
                // Optionally, you could log the result IDs for debugging
                let filePath = ftsResults[0].result[0];
                console.log('FlexSearch results:', filePath);
            } else {
                this.toast.info('FlexSearch found no matching items');
            }
        } catch (e) {
            console.error('Error searching FlexSearch cache', e);
            this.toast.info('Error performing search');
        }
        // await this.askOpenRouter(message);
        await this.askLocalModel(message);
    }

    public async ngOnInit(): Promise<void> {
        await Notification.requestPermission();
        // Show a toast notification on app initialization at bottom right
        // Show a toast notification on app initialization
        // Using NgToastService to show a simple success toast on init
        // The service's success method accepts a string message.
        // this.toast.success('App initialized');
        log("Apps data:", this.apps);
        // Sort apps: internal apps first, then alphabetically by name
        this.apps = this.sortApps(this.apps);

        // Initialise Dexie database instance
        this.db = new AppDexie();
        // @ts-ignore
        log("This device id:", localStorage.deviceId);
        this.msgBox.showMsg("You should click Sync Data now to get data modified on other devices");
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



































