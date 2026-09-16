"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession, isAuthEnabled } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

export async function login(formData: FormData): Promise<void> {
  if (!isAuthEnabled()) {
    redirect("/");
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !verifyPassword(password)) {
    redirect("/login?error=1");
  }

  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
