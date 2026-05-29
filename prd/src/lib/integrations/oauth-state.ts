import crypto from "crypto";

interface OAuthStatePayload {
  userId: string;
  issuedAt: number;
}

function getStateSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing OAuth state secret.");
  }
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function createOAuthState(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() } satisfies OAuthStatePayload)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseOAuthState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) {
    throw new Error("Invalid OAuth state.");
  }

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid OAuth state signature.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as OAuthStatePayload;
  if (!parsed.userId || Date.now() - parsed.issuedAt > 15 * 60 * 1000) {
    throw new Error("Expired OAuth state.");
  }

  return parsed.userId;
}
