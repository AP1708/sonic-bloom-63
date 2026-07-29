import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Server-only storage for each listener's linked music accounts.
 *
 * Provider refresh/access tokens are encrypted with MUSIC_TOKEN_SECRET before
 * they touch the database, and never leave the server.
 */

export type ConnectionProvider = "spotify" | "youtube";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  /** epoch ms */
  expiresAt: number;
}

export interface ConnectionRow {
  provider: ConnectionProvider;
  accountLabel: string | null;
  scopes: string | null;
  lastSyncedAt: string | null;
  tokens: StoredTokens;
}

function encryptionKey(): Buffer {
  const raw = process.env.MUSIC_TOKEN_SECRET;
  if (!raw) throw new Error("MUSIC_TOKEN_SECRET is not set.");
  return createHash("sha256").update(raw).digest();
}

export function encryptTokens(tokens: StoredTokens): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptTokens(stored: string): StoredTokens {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString(
    "utf8",
  );
  return JSON.parse(json) as StoredTokens;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function saveConnection(input: {
  userId: string;
  provider: ConnectionProvider;
  accountLabel: string | null;
  scopes: string | null;
  tokens: StoredTokens;
}): Promise<void> {
  const db = await admin();
  const { error } = await db.from("user_music_connections").upsert(
    {
      user_id: input.userId,
      provider: input.provider,
      account_label: input.accountLabel,
      scopes: input.scopes,
      token_ciphertext: encryptTokens(input.tokens),
      expires_at: new Date(input.tokens.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function readConnection(
  userId: string,
  provider: ConnectionProvider,
): Promise<ConnectionRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("user_music_connections")
    .select("provider, account_label, scopes, last_synced_at, token_ciphertext")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    provider: data.provider as ConnectionProvider,
    accountLabel: data.account_label,
    scopes: data.scopes,
    lastSyncedAt: data.last_synced_at,
    tokens: decryptTokens(data.token_ciphertext),
  };
}

export async function listConnectionSummaries(userId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("user_music_connections")
    .select("provider, account_label, scopes, last_synced_at")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    provider: row.provider as ConnectionProvider,
    accountLabel: row.account_label,
    scopes: row.scopes,
    lastSyncedAt: row.last_synced_at,
  }));
}

export async function markSynced(userId: string, provider: ConnectionProvider) {
  const db = await admin();
  await db
    .from("user_music_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
}

export async function deleteConnection(userId: string, provider: ConnectionProvider) {
  const db = await admin();
  const { error } = await db
    .from("user_music_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}
