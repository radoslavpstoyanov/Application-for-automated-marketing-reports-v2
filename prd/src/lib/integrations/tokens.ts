import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";
import { fetchWithRetry } from "@/lib/integrations/http";

const TOKEN_PREFIX = "enc:v1:";

type Provider = "google" | "meta";

function getEncryptionKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing token encryption secret.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function isEncryptedSecret(value: string | null | undefined) {
  return !!value && value.startsWith(TOKEN_PREFIX);
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return null;
  if (isEncryptedSecret(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_PREFIX.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  if (!isEncryptedSecret(value)) return value;

  const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted token format.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function persistEncryptedTokens(
  prisma: PrismaClient,
  connection: { id: string; accessToken: string; refreshToken: string | null }
) {
  const encryptedAccessToken = encryptSecret(decryptSecret(connection.accessToken));
  const encryptedRefreshToken = connection.refreshToken ? encryptSecret(decryptSecret(connection.refreshToken)) : null;

  if (connection.accessToken !== encryptedAccessToken || connection.refreshToken !== encryptedRefreshToken) {
    await prisma.oAuthConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encryptedAccessToken!,
        refreshToken: encryptedRefreshToken,
      },
    });
  }
}

export async function getProviderAccessToken(prisma: PrismaClient, userId: string, provider: Provider) {
  const connection = await prisma.oAuthConnection.findFirst({
    where: { userId, provider, connectionStatus: "active" },
  });

  if (!connection) {
    throw new Error(`Няма активна ${provider === "google" ? "Google" : "Meta"} интеграция.`);
  }

  await persistEncryptedTokens(prisma, connection);

  if (provider === "meta") {
    if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      await prisma.oAuthConnection.update({
        where: { id: connection.id },
        data: { connectionStatus: "expired" },
      });
      throw new Error("Meta връзката е изтекла. Свържете акаунта отново.");
    }
    return decryptSecret(connection.accessToken)!;
  }

  if (!connection.tokenExpiresAt || connection.tokenExpiresAt >= new Date()) {
    return decryptSecret(connection.accessToken)!;
  }

  const refreshToken = decryptSecret(connection.refreshToken);
  if (!refreshToken) {
    throw new Error("Google връзката е изтекла. Свържете акаунта отново.");
  }

  const tokenRes = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    await prisma.oAuthConnection.update({
      where: { id: connection.id },
      data: { connectionStatus: "expired" },
    });
    throw new Error("Google връзката е изтекла. Свържете акаунта отново.");
  }

  await prisma.oAuthConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(tokenData.access_token)!,
      tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
      connectionStatus: "active",
    },
  });

  return tokenData.access_token as string;
}
