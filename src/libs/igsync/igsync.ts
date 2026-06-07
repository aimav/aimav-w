// Shorthands
var log = console.log;

// indexeddb-gdrive sync lib
class IgSync {
    private _clientId: string = "";
    private _apiKey: string = "";
    private _accessToken: string = "";

    /**
     * Create a new folder.
     *
     * @param name - The name of the folder to create.
     * @returns A promise that resolves with the created folder information.
     */
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
                    q: `'${parentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
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

        if (parentId == "root") {
            const response = await (window as any).gapi.client.drive.files.list({
                q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)',
                spaces: 'drive',
            });
            const files = response.result.files;
            if (!files || files.length === 0) { }
            else {
                log("Folder exists:", path, name);
                return;
            }
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
     * Retrieve a folder and its items (files/sub‑folders).
     *
     * @param id - The ID of the folder to retrieve.
     * @returns A promise that resolves with the folder and its children.
     */
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
     * Update the name of an existing folder.
     *
     * @param id - The ID of the folder to rename.
     * @param newName - The new name for the folder.
     * @returns A promise that resolves when the update is complete.
     */
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
     * Delete a folder.
     *
     * @param id - The ID of the folder to delete.
     * @returns A promise that resolves when the folder has been removed.
     */
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
    async init(clientId: string, apiKey: string, accessToken: string): Promise<void> {
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

    //
    async sync(dbName: string) {
        var deviceId = localStorage['deviceId'];
        // TODO: implement synchronization logic using deviceId
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