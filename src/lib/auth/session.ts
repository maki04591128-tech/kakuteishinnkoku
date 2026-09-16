import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getEncodedSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET が設定されていません。AUTH_PASSWORD を設定する場合は SESSION_SECRET も .env に設定してください(例: openssl rand -base64 32)。",
    );
  }
  return new TextEncoder().encode(secret);
}

export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_PASSWORD);
}

async function encryptSession(expiresAt: number): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(getEncodedSecretKey());
}

export async function verifySessionToken(session: string | undefined): Promise<boolean> {
  if (!session) return false;
  try {
    const { payload } = await jwtVerify(session, getEncodedSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export async function createSession(): Promise<void> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session = await encryptSession(expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function verifySession(): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(session);
}

export { SESSION_COOKIE_NAME };
