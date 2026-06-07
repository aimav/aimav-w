// indexeddb-gdrive sync lib
class IgSync {
    private _clientId: string = "";
    private _accessToken: string = "";

    /**
     * Create a new folder.
     *
     * @param name - The name of the folder to create.
     * @returns A promise that resolves with the created folder information.
     */
    /**
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
        await (window as any).gapi.client.init({
            apiKey: this._clientId,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
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
     * Retrieve information about a folder.
     *
     * @param id - The ID of the folder to retrieve.
     * @returns A promise that resolves with the folder metadata.
     */
    /**
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
            apiKey: this._clientId,
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
            apiKey: this._clientId,
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
            apiKey: this._clientId,
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
            apiKey: this._clientId,
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
     * Initialize the IgSync instance with the OAuth client ID and an access token.
     *
     * @param clientId - The OAuth client ID obtained from Google Cloud Console.
     * @param accessToken - The OAuth access token used for authenticated API calls.
     */
    init(clientId: string, accessToken: string): void {
        // Store the client ID and access token for later use when loading the Google API client.
        this._clientId = clientId;
        this._accessToken = accessToken;
    }

    /**
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
            apiKey: this._clientId,
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
            apiKey: this._clientId,
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
            apiKey: this._clientId,
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
            apiKey: this._clientId,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        await (window as any).gapi.client.setToken({ access_token: this._accessToken });

        // Find existing file or create a new one.
        const listRes = await (window as any).gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
            fields: 'files(id)',
            spaces: 'drive',
        });
        const files = listRes.result.files;
        const media = { body: contentString };
        if (files && files.length > 0) {
            const fileId = files[0].id;
            const updateRes = await (window as any).gapi.client.drive.files.update({
                fileId,
                media,
                fields: 'id, name',
            });
            return updateRes.result;
        } else {
            const createRes = await (window as any).gapi.client.drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media,
                fields: 'id, name',
            });
            return createRes.result;
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
            apiKey: this._clientId,
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