/*
 * Screshot end-to-end encryption, format v1. One file, used unchanged by the website (imported) and
 * the extension (copied to extension/share/e2ee.js and loaded as a classic script). Only WebCrypto.
 *
 * Envelope encryption:
 *   - Each screenshot has a random Content Key (CK, AES-256-GCM). The image and its thumbnail are
 *     encrypted once with it: "SCE1" | iv (12) | ciphertext+tag.
 *   - Each user has an identity key pair (ECDH P-256). A CK is "wrapped" for a person with their
 *     public key (ECIES: ephemeral ECDH → HKDF-SHA256 → AES-256-GCM), so anyone can wrap for them and
 *     only they can unwrap. Only me = wrapped for the owner; Invited people = also for each invitee;
 *     Anyone with the link = the CK travels in the link's #fragment, which browsers never send.
 *   - The identity private key is stored encrypted with an Account Master Key (AMK). The AMK is
 *     wrapped by each unlock method (a passkey's PRF output, a recovery code). The server stores only
 *     ciphertext, never the AMK, the private key or a CK.
 */
(function (root, factory) {
  const api = factory(root.crypto);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ScreshotE2EE = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function (webcrypto) {
  "use strict";
  const subtle = webcrypto.subtle;
  const VERSION = 1;
  const BLOB_MAGIC = [0x53, 0x43, 0x45, 0x31]; // "SCE1"
  const IV_BYTES = 12;
  const enc = new TextEncoder();
  const INFO = {
    ckWrap: "screshot/v1/ck-wrap",
    amkPasskey: "screshot/v1/amk-wrap/passkey",
    amkRecovery: "screshot/v1/amk-wrap/recovery",
    privateKey: "screshot/v1/private-key",
  };

  // --- encoding -----------------------------------------------------------------------------

  function toB64u(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let bin = "";
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64u(text) {
    if (typeof text !== "string" || !/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("e2ee: invalid base64url");
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const random = (n) => webcrypto.getRandomValues(new Uint8Array(n));
  function concat() {
    let len = 0;
    for (const a of arguments) len += a.length;
    const out = new Uint8Array(len);
    let at = 0;
    for (const a of arguments) {
      out.set(a, at);
      at += a.length;
    }
    return out;
  }

  // --- AES-GCM primitives -------------------------------------------------------------------

  const aesKey = (raw, usages) => subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usages);
  async function sealBytes(keyRaw, plain, aad) {
    const iv = random(IV_BYTES);
    const params = aad ? { name: "AES-GCM", iv, additionalData: aad } : { name: "AES-GCM", iv };
    const ct = new Uint8Array(await subtle.encrypt(params, await aesKey(keyRaw, ["encrypt"]), plain));
    return { iv, ct };
  }
  async function openBytes(keyRaw, iv, ct, aad) {
    const params = aad ? { name: "AES-GCM", iv, additionalData: aad } : { name: "AES-GCM", iv };
    return new Uint8Array(await subtle.decrypt(params, await aesKey(keyRaw, ["decrypt"]), ct));
  }
  async function hkdf(ikm, salt, info, bytes) {
    const base = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode(info) }, base, bytes * 8));
  }

  // --- content key and blobs ----------------------------------------------------------------

  /** A new random Content Key (32 bytes). */
  function generateContentKey() {
    return random(32);
  }

  /** Encrypt image bytes with a CK. Output: "SCE1" | iv | ciphertext+tag. */
  async function encryptBlob(ck, plain) {
    const bytes = plain instanceof Uint8Array ? plain : new Uint8Array(plain);
    const { iv, ct } = await sealBytes(ck, bytes, new Uint8Array(BLOB_MAGIC));
    return concat(new Uint8Array(BLOB_MAGIC), iv, ct);
  }

  async function decryptBlob(ck, data) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    for (let i = 0; i < 4; i++) if (u8[i] !== BLOB_MAGIC[i]) throw new Error("e2ee: not a Screshot encrypted file");
    return openBytes(ck, u8.subarray(4, 4 + IV_BYTES), u8.subarray(4 + IV_BYTES), new Uint8Array(BLOB_MAGIC));
  }

  /** The CK as it travels in a public link: /s/abc#k=<this>. */
  const contentKeyToFragment = (ck) => "k=" + toB64u(ck);
  function contentKeyFromFragment(hash) {
    const m = /(?:^#?|&)k=([A-Za-z0-9_-]{43})(?:&|$)/.exec(hash || "");
    return m ? fromB64u(m[1]) : null;
  }

  // --- identity keys and wrapping a CK for someone ------------------------------------------

  const EC = { name: "ECDH", namedCurve: "P-256" };

  /** A new identity key pair. The private key is extractable once, so it can be encrypted for storage. */
  async function generateIdentity() {
    const pair = await subtle.generateKey(EC, true, ["deriveBits"]);
    const spki = new Uint8Array(await subtle.exportKey("spki", pair.publicKey));
    return { publicKey: toB64u(spki), privateKey: pair.privateKey };
  }

  const importPublicKey = (spkiB64u) => subtle.importKey("spki", fromB64u(spkiB64u), EC, true, []);

  /** Wrap a CK so only the holder of `recipientPublicKey` (spki, base64url) can open it. */
  async function wrapForRecipient(ck, recipientPublicKey) {
    const recipient = await importPublicKey(recipientPublicKey);
    const eph = await subtle.generateKey(EC, true, ["deriveBits"]);
    const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: recipient }, eph.privateKey, 256));
    const epk = new Uint8Array(await subtle.exportKey("raw", eph.publicKey));
    const salt = fromB64u(recipientPublicKey);
    const kek = await hkdf(shared, salt, INFO.ckWrap, 32);
    const { iv, ct } = await sealBytes(kek, ck, epk);
    return { v: VERSION, alg: "ECDH-P256+HKDF-SHA256+A256GCM", epk: toB64u(epk), iv: toB64u(iv), ct: toB64u(ct) };
  }

  /** Open an envelope with the recipient's private key (a CryptoKey with deriveBits). */
  async function unwrapEnvelope(envelope, privateKey, recipientPublicKey) {
    if (!envelope || envelope.v !== VERSION) throw new Error("e2ee: unsupported envelope");
    const epkRaw = fromB64u(envelope.epk);
    const eph = await subtle.importKey("raw", epkRaw, EC, false, []);
    const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: eph }, privateKey, 256));
    const kek = await hkdf(shared, fromB64u(recipientPublicKey), INFO.ckWrap, 32);
    return openBytes(kek, fromB64u(envelope.iv), fromB64u(envelope.ct), epkRaw);
  }

  // --- protecting the private key -----------------------------------------------------------

  /** A new Account Master Key (32 bytes). It never leaves the browser unwrapped. */
  function generateMasterKey() {
    return random(32);
  }

  /** Encrypt the identity private key (pkcs8) with the AMK, for storage on the server. */
  async function encryptPrivateKey(privateKey, amk) {
    const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", privateKey));
    const { iv, ct } = await sealBytes(amk, pkcs8, enc.encode(INFO.privateKey));
    return { v: VERSION, iv: toB64u(iv), ct: toB64u(ct) };
  }

  /** Decrypt the private key. `extractable: false` (default) keeps it out of reach of page scripts. */
  async function decryptPrivateKey(encrypted, amk, extractable) {
    const pkcs8 = await openBytes(amk, fromB64u(encrypted.iv), fromB64u(encrypted.ct), enc.encode(INFO.privateKey));
    return subtle.importKey("pkcs8", pkcs8, EC, !!extractable, ["deriveBits"]);
  }

  // A key-encryption key from a passkey's PRF output (32 bytes) or from a recovery code.
  const kekFromPrf = (prfOutput, salt) => hkdf(new Uint8Array(prfOutput), salt, INFO.amkPasskey, 32);
  const kekFromRecoveryCode = async (code, salt) => hkdf(recoveryCodeBytes(code), salt, INFO.amkRecovery, 32);

  async function wrapMasterKey(amk, kek, kind) {
    const { iv, ct } = await sealBytes(kek, amk, enc.encode(kind));
    return { v: VERSION, iv: toB64u(iv), ct: toB64u(ct) };
  }
  async function unwrapMasterKey(wrapped, kek, kind) {
    return openBytes(kek, fromB64u(wrapped.iv), fromB64u(wrapped.ct), enc.encode(kind));
  }

  // --- recovery codes -----------------------------------------------------------------------
  // 25 characters from a 32-letter alphabet without look-alikes (125 bits), shown as 5 groups.

  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function generateRecoveryCode() {
    const bytes = random(25);
    let out = "";
    for (let i = 0; i < 25; i++) out += ALPHABET[bytes[i] & 31];
    return out.match(/.{5}/g).join("-");
  }
  // Case, spaces and dashes don't matter when the code is typed back.
  const normalizeRecoveryCode = (code) =>
    String(code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  function recoveryCodeBytes(code) {
    const clean = normalizeRecoveryCode(code);
    if (clean.length !== 25 || [...clean].some((c) => ALPHABET.indexOf(c) < 0)) throw new Error("e2ee: invalid recovery code");
    return enc.encode(clean);
  }
  const isValidRecoveryCode = (code) => {
    try {
      recoveryCodeBytes(code);
      return true;
    } catch {
      return false;
    }
  };

  return {
    VERSION,
    toB64u,
    fromB64u,
    random,
    generateContentKey,
    encryptBlob,
    decryptBlob,
    contentKeyToFragment,
    contentKeyFromFragment,
    generateIdentity,
    wrapForRecipient,
    unwrapEnvelope,
    generateMasterKey,
    encryptPrivateKey,
    decryptPrivateKey,
    kekFromPrf,
    kekFromRecoveryCode,
    wrapMasterKey,
    unwrapMasterKey,
    generateRecoveryCode,
    isValidRecoveryCode,
    KIND: { passkey: INFO.amkPasskey, recovery: INFO.amkRecovery },
  };
});
