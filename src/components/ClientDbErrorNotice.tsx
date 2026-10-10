"use client";

import Link from "next/link";

/**
 * `useAsyncPageData`(`src/lib/useAsyncPageData.ts`)がclientDb初期化エラー
 * (フェーズ6-12、古いWebViewでのOPFS/Web Worker未対応等)を捕捉した際に
 * 表示する共通のエラー表示UI。
 */
export function ClientDbErrorNotice({ error }: { error: Error }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6 sm:p-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← ダッシュボードに戻る
      </Link>
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      >
        {error.message}
      </p>
    </div>
  );
}
