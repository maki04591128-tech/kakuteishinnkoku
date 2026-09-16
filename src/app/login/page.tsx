import { redirect } from "next/navigation";
import { isAuthEnabled } from "@/lib/auth/session";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isAuthEnabled()) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">確定申告ツール</h1>
        <p className="mt-1 text-sm text-neutral-500">
          パスワードを入力してください
        </p>
      </div>

      {params.error && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          パスワードが違います。
        </p>
      )}

      <form action={login} className="flex flex-col gap-3">
        <label htmlFor="password" className="text-sm text-neutral-500">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          className="mt-2 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-neutral-900"
        >
          ログイン
        </button>
      </form>
    </div>
  );
}
