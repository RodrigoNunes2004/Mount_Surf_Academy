import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET ?? process.env.DATABASE_URL ?? "";
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET or DATABASE_URL required for encryption");
  }
  return scryptSync(secret, "mta-integration", KEY_LEN);
}

export function encrypt(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const out = Buffer.concat([iv, enc]);
  return `mta:${out.toString("base64url")}`;
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext?.startsWith("mta:")) {
    return ciphertext; // Legacy plain text, treat as-is (migrate later)
  }
  const key = getKey();
  const raw = Buffer.from(ciphertext.slice(4), "base64url");
  const iv = raw.subarray(0, IV_LEN);
  const enc = raw.subarray(IV_LEN, raw.length - TAG_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}
