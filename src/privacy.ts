import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

export function encryptPayload(payload: Record<string, unknown>, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const data = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptPayload(encrypted: string, key: Buffer): Record<string, unknown> {
  const buffer = Buffer.from(encrypted, "base64");
  const iv = buffer.slice(0, 12);
  const tag = buffer.slice(12, 28);
  const ciphertext = buffer.slice(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

export function generateKey(): Buffer {
  return crypto.randomBytes(32);
}
