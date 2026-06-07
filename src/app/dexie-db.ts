import Dexie, { Table } from 'dexie';

/**
 * Dexie database mirroring the original RxDB schemas.
 * Tables:
 *  - chatMessages: stores messages grouped by year
 *  - notes: generic notes collection
 *  - pinnedApps: list of pinned applications
 *  - appCategories: categories containing apps
 */
export interface ChatMessage {
    id: string;
    tokens: string[];
    year: number;
    messages: { idstr: string; content: string; timestamp: number }[];
}

export interface Note {
    id: string;
    tokens: string[];
    year: number;
    notes: { idstr: string; title: string; content: string; timestamp: number }[];
}

export interface PinnedApp {
    id: string;
    tokens: string[];
    name: string;
    url: string;
    icon: string;
    description: string;
    tags: string[];
    integrated: boolean;
    internal: boolean;
    custom: boolean;
}

export interface AppCategory {
    id: string;
    tokens: string[];
    categoryName: string;
    apps: { idstr: string; name: string; url: string; icon?: string }[];
}

export class AppDexie extends Dexie {
    chatMessages!: Table<ChatMessage, string>;
    notes!: Table<Note, string>;
    pinnedApps!: Table<PinnedApp, string>;
    appCategories!: Table<AppCategory, string>;

    constructor() {
        super('AimavDB');
        this.version(1).stores({
            chatMessages: 'id, year, *tokens',
            notes: 'id, year, *tokens',
            pinnedApps: 'id, name, url, *tokens',
            appCategories: 'id, categoryName, *tokens'
        });
    }
}
