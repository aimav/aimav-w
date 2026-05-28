/**
 * Declaration file for src/modules/common.js.
 * Provides TypeScript type signatures for all exported functions.
 */

/**
 * Computes the SHA-1 hex digest of a UTF-8 encoded string using the Web Crypto API.
 * @param message - The input string to hash.
 * @returns A promise that resolves to the lowercase hex-encoded SHA-1 hash.
 */
export declare function sha1(message: string): Promise<string>;
