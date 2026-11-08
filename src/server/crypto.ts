import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(): Buffer {
  const secret = process.env.TAX_ID_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("TAX_ID_KEY ausente.");
  }
  return createHash("sha256").update(secret).digest();
}

export function sealTaxId(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function openTaxId(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
