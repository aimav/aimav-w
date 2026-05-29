/**
 * Computes the SHA-1 hex digest of a UTF-8 encoded string using the Web Crypto API.
 * @param {string} message - The input string to hash.
 * @returns {Promise<string>} The lowercase hex-encoded SHA-1 hash.
 */
export async function sha1(message) {
    const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8); // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex.toLowerCase();
}
window.sha1 = sha1;