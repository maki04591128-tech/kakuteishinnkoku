"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession, deleteSession, isAuthEnabled } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLoginAttempt,
} from "@/lib/auth/loginRateLimit";

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    // 複数プロキシを経由する場合、先頭が実際の接続元
    return forwardedFor.split(",")[0]!.trim();
  }
  return headerList.get("x-real-ip") ?? "unknown";
}

export async function login(formData: FormData): Promise<void> {
  if (!isAuthEnabled()) {
    redirect("/");
  }

  const ip = await getClientIp();
  const rateLimit = await checkLoginRateLimit(ip);
  if (rateLimit.locked) {
    const minutes = Math.max(1, Math.ceil(rateLimit.retryAfterMs / 60_000));
    redirect(`/login?error=locked&minutes=${minutes}`);
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !verifyPassword(password)) {
    await recordFailedLoginAttempt(ip);
    redirect("/login?error=1");
  }

  await clearLoginAttempts(ip);
  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
