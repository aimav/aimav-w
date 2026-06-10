// Shorthands
var log = console.log;

// indexeddb-gdrive sync lib
class IgSync {
    private _app: any;
    private _db: any;
    private _clientId: string = "";
    private _apiKey: string = "";
    private _accessToken: string = "";

    /**
     * MANUALLY CHECKED.
     * Create a new folder in Google Drive.
     *
     * @param path - The absolute path in Google Drive where the folder should be created (e.g. "/MyApp/Data"). Must start with '/'.
     * @param name - The name of the new folder.
     * @returns A promise that resolves with the created folder metadata.
     */
    async createFolder(path: string, name: string): Promise<any> {
        // Ensure the Google API client is loaded.
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }
        // Initialise the client with the stored credentials.
        try {
            await (window as any).gapi.client.init({
                apiKey: this._apiKey,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
        }
        catch (err) {
            log(JSON.stringify(err));
        }
        await (window as any).gapi.client.setToken({
            access_token: this._accessToken
        });
        // Helper to find a folder ID by path.
        const findFolderId = async (folderPath: string): Promise<string> => {
            const parts = folderPath.split('/').filter(p => p.length > 0);
            let parentId = 'root';

            for (const part of parts) {
                const response = await (window as any).gapi.client.drive.files.list({
                    q: `'${parentId}' in parents and name = '${part}' and trashed = false`,
                    fields: 'files(id, name)',
                    spaces: 'drive',
                });
                const files = response.result.files;

                if (!files || files.length === 0) {
                    // Folder does not exist – create it.
                    const createRes = await (window as any).gapi.client.drive.files.create({
                        resource: {
                            name: part,
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [parentId],
                        },
                        fields: 'id',
                    });
                    parentId = createRes.result.id;
                } else {
                    parentId = files[0].id;
                }
            }
            return parentId;
        };
        const parentId = await findFolderId(path);

        // Check if exists in parent folder
        const response = await (window as any).gapi.client.drive.files.list({
            q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
        const files = response.result.files;

        if (!files || files.length === 0) { }
        else {
            log("Folder exists:", response.result.files[0]);
            return response.result.files[0];
        }

        // Create the final folder.
        const result = await (window as any).gapi.client.drive.files.create({
            resource: {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            },
            fields: 'id, name',
        });
        log("New folder:", result.result);
        return result.result;
    }

    /**
     * MANUALLY CHECKED.
     * Retrieve information about a folder given its absolute path.
     *
     * @param path - The absolute path to the folder (e.g. "/MyApp/Data"). Must start with '/'.
     * @returns A promise that resolves with the folder metadata.
     */
    async getFolderInfo(path: string): Promise<any> {
        // Ensure the Google API client is loaded.
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }

        // Initialise the client with stored credentials.
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({
            access_token: this._accessToken
        });

        // Reuse the folder‑finding logic from createFolder to resolve the path to an ID.
        const findFolderId = async (folderPath: string): Promise<string> => {
            const parts = folderPath.split('/').filter(p => p.length > 0);
            let parentId = 'root';
            for (const part of parts) {
                const response = await (window as any).gapi.client.drive.files.list({
                    q: `'${parentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id, name)',
                    spaces: 'drive',
                });
                const files = response.result.files;
                if (!files || files.length === 0) {
                    throw new Error(`Folder "${part}" not found in path ${folderPath}`);
                }
                parentId = files[0].id;
            }
            return parentId;
        };

        const folderId = await findFolderId(path);
        const response = await (window as any).gapi.client.drive.files.get({
            fileId: folderId,
            fields: 'id, name, mimeType, modifiedTime, size, parents',
        });
        return response.result;
    }

    /**
     * Retrieve a folder and its items given the folder's absolute path.
     *
     * @param path - The absolute path to the folder (e.g. "/MyApp/Data"). Must start with '/'.
     * @returns A promise that resolves with the folder metadata and its children.
     */
    async getFolderWithItems(path: string): Promise<any> {
        // Ensure the Google API client is loaded.
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }

        // Initialise the client with stored credentials.
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({
            access_token: this._accessToken
        });

        // Resolve the path to a folder ID using the same logic as getFolderInfo.
        const findFolderId = async (folderPath: string): Promise<string> => {
            const parts = folderPath.split('/').filter(p => p.length > 0);
            let parentId = 'root';
            for (const part of parts) {
                const response = await (window as any).gapi.client.drive.files.list({
                    q: `'${parentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id, name)',
                    spaces: 'drive',
                });
                const files = response.result.files;
                if (!files || files.length === 0) {
                    throw new Error(`Folder "${part}" not found in path ${folderPath}`);
                }
                parentId = files[0].id;
            }
            return parentId;
        };

        const folderId = await findFolderId(path);

        // Get folder metadata.
        const folderRes = await (window as any).gapi.client.drive.files.get({
            fileId: folderId,
            fields: 'id, name, mimeType, modifiedTime, size, parents',
        });

        // List child items.
        const childrenRes = await (window as any).gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
            spaces: 'drive',
        });

        const items = childrenRes.result.files || [];
        return { ...folderRes.result, items };
    }

    /**
     * Update the name of an existing folder given its absolute path.
     *
     * @param path - The absolute path to the folder (e.g. "/MyApp/Data"). Must start with '/'.
     * @param newName - The new name for the folder.
     * @returns A promise that resolves with the updated folder metadata.
     */
    async updateFolderName(path: string, newName: string): Promise<any> {
        // Ensure the Google API client is loaded.
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }

        // Initialise the client with stored credentials.
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({
            access_token: this._accessToken
        });

        // Resolve the path to a folder ID.
        const findFolderId = async (folderPath: string): Promise<string> => {
            const parts = folderPath.split('/').filter(p => p.length > 0);
            let parentId = 'root';
            for (const part of parts) {
                const response = await (window as any).gapi.client.drive.files.list({
                    q: `'${parentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id, name)',
                    spaces: 'drive',
                });
                const files = response.result.files;
                if (!files || files.length === 0) {
                    throw new Error(`Folder "${part}" not found in path ${folderPath}`);
                }
                parentId = files[0].id;
            }
            return parentId;
        };

        const folderId = await findFolderId(path);

        // Update the folder's name using the Drive API.
        const response = await (window as any).gapi.client.drive.files.update({
            fileId: folderId,
            resource: { name: newName },
            fields: 'id, name',
        });
        return response.result;
    }

    /**
     * Delete a folder given its absolute path.
     *
     * @param path - The absolute path to the folder (e.g. "/MyApp/Data"). Must start with '/'.
     * @returns A promise that resolves with a success indicator and the deleted folder ID.
     */
    async deleteFolder(path: string): Promise<any> {
        // Ensure the Google API client is loaded.
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }

        // Initialise the client with stored credentials.
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({
            access_token: this._accessToken
        });

        // Resolve the path to a folder ID.
        const findFolderId = async (folderPath: string): Promise<string> => {
            const parts = folderPath.split('/').filter(p => p.length > 0);
            let parentId = 'root';
            for (const part of parts) {
                const response = await (window as any).gapi.client.drive.files.list({
                    q: `'${parentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id, name)',
                    spaces: 'drive',
                });
                const files = response.result.files;
                if (!files || files.length === 0) {
                    throw new Error(`Folder "${part}" not found in path ${folderPath}`);
                }
                parentId = files[0].id;
            }
            return parentId;
        };

        const folderId = await findFolderId(path);

        // Delete the folder using the Drive API.
        await (window as any).gapi.client.drive.files.delete({
            fileId: folderId,
        });
        return { success: true, id: folderId };
    }

    /**
     * MANUALLY CHECKED.
     * Initialize the IgSync instance with the OAuth client ID and an access token.
     *
     * @param clientId - The OAuth client ID obtained from Google Cloud Console.
     * @param accessToken - The OAuth access token used for authenticated API calls.
     */
    // Initialize the IgSync instance with the OAuth client ID and an access token.
    // Additionally, ensure the required folder structure exists on Google Drive.
    async init(app: any, db: any, clientId: string, apiKey: string, accessToken: string): Promise<void> {
        this._app = app;
        this._db = db;
        // Store the client ID and access token for later use when loading the Google API client.
        this._clientId = clientId;
        this._apiKey = apiKey;
        this._accessToken = accessToken;

        // Create the top‑level "Aimav" folder if it does not exist.
        // The createFolder method is idempotent – it will return the existing folder if present.
        await this.createFolder('/', 'Aimav');

        if (localStorage['deviceId'] == null) {
            // @ts-ignore
            localStorage['deviceId'] = new_id();
        }

        // Ensure a device configuration file exists in Google Drive under
        // "/Aimav/Devices/${deviceId}.json". The file should contain a JSON
        // object with an empty `objectsToLoad` array. This file is used by the
        // sync logic to know which objects need to be loaded for the device.
        const deviceId = localStorage['deviceId'] as string;
        // Resolve the folder ID for the Devices directory.
        const devicesFolderInfo = await this.getFolderInfo('/Aimav');
        const folderId = devicesFolderInfo.id;
        const fileName = `device-${deviceId}.json`;
        try {
            // Attempt to read the file – if it exists we are done.
            await this.readFile(folderId, fileName);
        } catch (e) {
            // File does not exist; create it with the default content.
            await this.createFile(folderId, fileName);
            const defaultContent = JSON.stringify({ objectsToLoad: [] }, null, 4);
            await this.writeFile(folderId, fileName, defaultContent);
        }
    }

    // Mark a changed object
    // Stores entries in localStorage.changedObjects as an object for O(1) existence checks.
    // The object keys are a composite string "${dbName}|${storeName}|${id}" and the value is true.
    markChanged(dbName: string, storeName: string, id: string, op: string = "modified") {
        // Retrieve existing map or initialise a new one.
        let changedMap: Record<string, string> = {};
        try {
            const raw = localStorage['changedObjects'];
            if (raw) {
                changedMap = JSON.parse(raw);
            }
        } catch (e) {
            // If parsing fails, start with an empty map.
            changedMap = {};
        }

        const key = `${dbName}/${storeName}/${id}`;
        log(`Data item ${op}:`, key);

        if (!changedMap[key]) {
            changedMap[key] = op;
            localStorage['changedObjects'] = JSON.stringify(changedMap);
        }
    }

    //
    markDeleted(dbName: string, storeName: string, id: string) {
        this.markChanged(dbName, storeName, id, "deleted");
    }

    //  
    // Synchronize data from the cloud for a specific device.
    // Reads the device configuration file from Google Drive and logs each entry
    // in the `objectsToLoad` array.
    async syncFromCloud(deviceId: string) {
        // ---------------------------------------------------------------------
        // Initial sync: ensure each Dexie table is populated if empty.
        // ---------------------------------------------------------------------
        // List of Dexie stores defined in AppDexie (src/app/dexie-db.ts).
        const dexieStores = [
            'chatMessages',
            'notes',
            'pinnedApps',
            'appCategories',
            'customApps',
        ];

        // For each store, check if the table is empty. If it is, download all
        // JSON files from the corresponding Google Drive folder and insert
        // them into the Dexie table.
        for (const store of dexieStores) {
            // Resolve table reference – Dexie tables can be accessed via the
            // `table` method or as a property on the DB instance.
            let table = this._db.table ? this._db.table(store) : this._db[store];

            if (!table) {
                console.warn('Dexie table not found for store', store);
                continue;
            }
            const count = await table.count();
            if (count > 0) continue; // Table already has data.

            // Ensure the folder exists on Google Drive.
            const folderPath = `/Aimav/AimavDB/${store}`; // Using store as folder under Aimav.
            await this.createFolder('/Aimav/AimavDB', store);
            const folderInfo = await this.getFolderWithItems(folderPath);
            const items = folderInfo.items || [];

            for (const item of items) {
                try {
                    const content = await this.readFile(folderInfo.id, item.name);
                    const data = JSON.parse(content);
                    await table.put(data);
                } catch (e) {
                    console.error('Failed to load item into', store, e);
                }
            }
        }

        // Resolve the folder information for the top-level Aimav folder.
        const folderInfo = await this.getFolderInfo('/Aimav');
        const folderId = folderInfo.id;
        const fileName = `device-${deviceId}.json`;

        // Read the file content as a string.
        const fileContent = await this.readFile(folderId, fileName);
        let jsonObj: any;
        try {
            jsonObj = JSON.parse(fileContent);
        } catch (e) {
            console.error('Failed to parse JSON from', fileName, e);
            return;
        }

        const objects = jsonObj.objectsToLoad;
        log("objects to load:", objects.length);
        var okCount = 0;
        var n = objects.length;
        var i = 0;

        if (Array.isArray(objects)) {
            for (const obj of objects) {
                console.log('Object to load:', obj);
                this._app.toast.info(`Progress ${i + 1} / ${n}`);
                i++;
                // Handle synchronization based on operation type.
                const { db, store, id, op } = obj;
                // Resolve Dexie table reference.
                let table = this._db.table ? this._db.table(store) : this._db[store];

                if (!table) {
                    console.warn('Dexie table not found for store', store);
                    // Dynamically create a Dexie table for the missing store.
                    // Use a simple schema with primary key 'id' for the new table.
                    const schema: any = {};
                    schema[store] = 'id';
                    // Add a new version or extend the existing one.
                    // Dexie allows defining stores on the same version; we use version(1) for simplicity.
                    // If version 1 already exists, this call will merge the new store.
                    this._db.version(1).stores(schema);
                    // Retrieve the newly created table reference.
                    const newTable = this._db.table ? this._db.table(store) : this._db[store];
                    if (!newTable) {
                        console.error('Failed to create Dexie table for store', store);
                        continue;
                    }
                    // Replace the missing table with the newly created one for further processing.
                    table = newTable;
                }
                if (op === 'deleted') {
                    // Delete the record from IndexedDB.
                    try {
                        await table.delete(id);
                        okCount++;
                    } catch (e) {
                        console.error('Failed to delete item from Dexie', e);
                        okCount++;
                    }
                } else if (op === 'modified') {
                    // Ensure the folder exists on Google Drive.
                    const folderPath = `/Aimav/${db}/${store}`;
                    // Create folder if missing.
                    await this.createFolder(`/Aimav/${db}`, store);
                    const folderInfo = await this.getFolderInfo(folderPath);
                    const fileName = `${id}.json`;

                    try {
                        const fileContent = await this.readFile(folderInfo.id, fileName);
                        const data = JSON.parse(fileContent);
                        // Save or update the record in Dexie.
                        await table.put(data);
                        okCount++;
                    } catch (e: any) {
                        console.error('Failed to load or save modified item', e);
                        if (e.toString().includes("not valid JSON")) okCount++;
                    }
                } else {
                    console.warn('Unsupported operation in syncFromCloud', op);
                }
            }
        } else {
            console.warn('objectsToLoad is not an array in', fileName);
        }
        log(`Sync from cloud: ${okCount} / ${objects.length} items`);

        if (okCount == objects.length) {
            // After successful sync, clear the objectsToLoad array in the device config file on Google Drive.
            jsonObj.objectsToLoad = [];
            const clearedContent = JSON.stringify(jsonObj, null, 4);
            await this.writeFile(folderId, fileName, clearedContent);
        }
    }

    //
    async updateGdriveItem(item: any) {
        log("Item to upload/del:", item);
        // item shape: { db: string, store: string, id: string, op: string, content?: any }
        // Determine the folder path under the top‑level Aimav folder.
        const folderPath = `/Aimav/${item.db}/${item.store}`;
        // Resolve folder ID.
        await this.createFolder(`/Aimav/${item.db}`, item.store);
        const folderInfo = await this.getFolderInfo(folderPath);
        const folderId = folderInfo.id;
        const fileName = `${item.id}.json`;

        // If the operation is a modification and content is not provided, load it from IndexedDB.
        if (item.op === "modified") {
            let contentData = item.content;

            if (contentData === undefined) {
                // Load the record from the Dexie database. The db instance is stored in this._db.
                try {
                    // Dexie tables can be accessed via this._db.table(name) or directly as a property.
                    const table = this._db.table ? this._db.table(item.store) : this._db[item.store];

                    if (!table) {
                        throw new Error(`Table ${item.store} not found in DB`);
                    }
                    const record = await table.get(item.id);
                    contentData = record;
                } catch (e) {
                    console.error('Failed to load item from DB for updateGdriveItem', e);
                    return "error";
                }
            }
            const content = typeof contentData === "string" ? contentData : JSON.stringify(contentData, null, 4);
            await this.writeFile(folderId, fileName, content);
            return "ok";
        }
        else if (item.op === "deleted") {
            // Delete the file from Google Drive.
            try {
                await this.deleteFile(folderId, fileName);
                return "ok";
            } catch {
                log("Id not found on G drive:", item);
                return "ok";
            }
        }
        else {
            console.warn("Unsupported operation for updateGdriveItem", item.op);
        }
        return "error";
    }

    // 
    async syncToCloud(deviceId: string) {
        // Resolve the top‑level Aimav folder.
        const folderInfo = await this.getFolderInfo('/Aimav');
        const folderId = folderInfo.id;

        // List all JSON files in the Aimav folder.
        const listRes = await (window as any).gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
        var files: any[] = listRes.result.files || [];
        files = files.filter(x => x.name.endsWith(".json"));
        log("Device files:", files);

        // Load changed objects map from localStorage.
        let changedMap: Record<string, string> = {};

        try {
            const raw = localStorage['changedObjects'];
            if (raw) changedMap = JSON.parse(raw);
            log("changedMap:", changedMap);
        }
        catch (e) {
            console.warn('Failed to parse changedObjects', e);
            this._app.toast.info("Failed to parse changedObjects");
            return;
        }

        // Prepare entries to add: {id, op}
        const changedEntries = Object.entries(changedMap).map(([key, op]) => {
            const parts = key.split('/');
            const db = parts[0];
            const store = parts[1];
            const id = parts[2];
            return { db, store, id, op };
        });
        var okCount = 0;

        for (let entry of changedEntries) {
            let status = await this.updateGdriveItem(entry);
            if (status === "ok") okCount++;
            this._app.toast.info(`Progress ${okCount} / ${changedEntries.length}`);
        }

        // Process each JSON file except the device config file.
        for (const file of files) {
            if (!file.name.endsWith('.json')) continue;
            if (file.name === `device-${deviceId}.json`) continue;

            // Read file content.
            const content = await this.readFile(folderId, file.name);
            let jsonObj: any;

            try {
                jsonObj = JSON.parse(content);
            } catch (e) {
                console.error('Failed to parse JSON from', file.name, e);
                continue;
            }

            // Ensure objectsToLoad array exists.
            if (!Array.isArray(jsonObj.objectsToLoad)) {
                jsonObj.objectsToLoad = [];
            }

            // Append changed entries, avoiding duplicates.
            for (const entry of changedEntries) {
                if (!jsonObj.objectsToLoad.some((o: any) => o.id === entry.id && o.op === entry.op)) {
                    jsonObj.objectsToLoad.push(entry);
                }
            }

            // Write back updated content.
            const newContent = JSON.stringify(jsonObj, null, 4);
            await this.writeFile(folderId, file.name, newContent);
        }
        this._app.toast.info("Sync'ing TO Google Drive done.");

        // Clear changedObjects
        if (okCount == changedEntries.length)
            delete localStorage['changedObjects'];
    }

    //
    async sync(dbName: string) {
        var deviceId = localStorage['deviceId'];
        this._app.toast.info("Syncing data FROM Google Drive...");
        await this.syncFromCloud(deviceId);
        this._app.toast.info("Syncing data TO Google Drive...");
        await this.syncToCloud(deviceId);
    }

    /**
     * MANUALLY CHECKED.
     * Create a new file in a folder.
     * @param folderId - The ID of the parent folder.
     * @param fileName - The name of the file to create.
     * @returns Promise resolving with the created file metadata.
     */
    async createFile(folderId: string, fileName: string): Promise<any> {
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({ access_token: this._accessToken });

        const response = await (window as any).gapi.client.drive.files.create({
            resource: {
                name: fileName,
                parents: [folderId],
            },
            fields: 'id, name',
        });
        return response.result;
    }

    /**
     * Read the content of a file.
     * @param folderId - The ID of the parent folder.
     * @param fileName - The name of the file to read.
     * @returns Promise resolving with the file content as a string.
     */
    async readFile(folderId: string, fileName: string): Promise<string> {
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({ access_token: this._accessToken });

        // Find the file ID by name within the folder.
        const listRes = await (window as any).gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
        const files = listRes.result.files;
        if (!files || files.length === 0) {
            throw new Error(`File "${fileName}" not found in folder ${folderId}`);
        }
        const fileId = files[0].id;
        const getRes = await (window as any).gapi.client.drive.files.get({
            fileId,
            alt: 'media',
        });
        return getRes.body as string;
    }

    /**
     * Rename a file.
     * @param folderId - The ID of the parent folder.
     * @param fileName - Current file name.
     * @param newFileName - New name for the file.
     */
    async renameFile(folderId: string, fileName: string, newFileName: string): Promise<any> {
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({ access_token: this._accessToken });

        const listRes = await (window as any).gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
            fields: 'files(id)',
            spaces: 'drive',
        });
        const files = listRes.result.files;
        if (!files || files.length === 0) {
            throw new Error(`File "${fileName}" not found in folder ${folderId}`);
        }
        const fileId = files[0].id;
        const updateRes = await (window as any).gapi.client.drive.files.update({
            fileId,
            resource: { name: newFileName },
            fields: 'id, name',
        });
        return updateRes.result;
    }

    /**
     * MANUALLY CHECKED.
     * Write content to a file (creates or updates).
     * @param folderId - The ID of the parent folder.
     * @param fileName - The name of the file.
     * @param contentString - The text content to write.
     */
    async writeFile(folderId: string, fileName: string, contentString: string): Promise<any> {
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        (window as any).gapi.client.setToken({ access_token: this._accessToken });

        // Find existing file
        const listRes = await (window as any).gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
            fields: 'files(id)',
            spaces: 'drive',
        });
        const files = listRes.result.files;

        const mimeType = 'text/plain'; // change if needed
        const metadataCreate = { name: fileName, parents: [folderId] };
        const metadataUpdate = { name: fileName };

        // Construct multipart body manually
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartBodyCreate =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadataCreate) +
            delimiter +
            `Content-Type: ${mimeType}\r\n\r\n` +
            contentString +
            closeDelimiter;
        const multipartBodyUpdate =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadataUpdate) +
            delimiter +
            `Content-Type: ${mimeType}\r\n\r\n` +
            contentString +
            closeDelimiter;

        try {
            if (files && files.length > 0) {
                // Update existing file
                const fileId = files[0].id;
                const res = await (window as any).gapi.client.request({
                    path: `/upload/drive/v3/files/${fileId}`,
                    method: 'PATCH',
                    params: { uploadType: 'multipart', fields: 'id, name' },
                    headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
                    body: multipartBodyUpdate,
                });
                return res.result;
            } else {
                // Create new file
                const res = await (window as any).gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart', fields: 'id, name' },
                    headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
                    body: multipartBodyCreate,
                });
                return res.result;
            }
        }
        catch (e) {
            console.log("igsync.writeFile:", JSON.stringify(e));
            throw e;
        }
    }

    /**
     * Delete a file.
     * @param folderId - The ID of the parent folder.
     * @param fileName - The name of the file to delete.
     */
    async deleteFile(folderId: string, fileName: string): Promise<any> {
        if (!(window as any).gapi) {
            throw new Error('gapi client not loaded');
        }
        await (window as any).gapi.client.init({
            apiKey: this._apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({ access_token: this._accessToken });

        const listRes = await (window as any).gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
            fields: 'files(id)',
            spaces: 'drive',
        });
        const files = listRes.result.files;
        if (!files || files.length === 0) {
            throw new Error(`File "${fileName}" not found in folder ${folderId}`);
        }
        const fileId = files[0].id;
        await (window as any).gapi.client.drive.files.delete({ fileId });
        return { success: true, id: fileId };
    }
}

export default IgSync;