"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { UnrealizedGainForm } from "./UnrealizedGainForm";
import { getUnrealizedGainPageData } from "@/lib/unrealizedGainPageData";
import type { UnrealizedGainPageData } from "@/lib/unrealizedGainPageData.types";

export function UnrealizedGainPageContent() {
  const searchParams = useSearchParams();
  const yearParam = Number(searchParams.get("year")) || null;

  const [data, setData] = useState<UnrealizedGainPageData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getUnrealizedGainPageData(yearParam);
      setData(result);
    });
  }, [yearParam]);

  if (!data) {
    return <UnrealizedGainPageSkeleton />;
  }

  const { year, holdings } = data;

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10"
      aria-busy={isPending}
    >
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          含み損益シミュレーション({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          この年分に期末時点で保有している銘柄について、現在価格を入力すると含み損益を試算できる。
          損出し(含み損のある銘柄を年内に売却して当年の所得を圧縮する節税策)の判断材料として使う。
          現在価格は自動取得せず、`/import`の「現在価格(時価)の登録」欄にその銘柄の価格を
          登録していればその値を、未登録の場合は平均取得単価(含み損益0円)を初期値として表示するため、
          いずれの場合も必ず実際の相場に更新すること。
        </p>
      </header>

      <UnrealizedGainForm holdings={holdings} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本シミュレーターはこの年分にアプリへ登録済みの取引から計算した期末保有数量・平均取得単価を
        用いた概算であり、実際の売却時の約定単価・手数料・スワップ等は反映しない。また、複数の
        取引所・証券会社にまたがる同一銘柄の保有は合算して試算する。現在価格は手入力のため、
        入力を誤ると結果も誤る点に注意すること。実際の売却判断は必ず最新の相場・税理士等の
        専門家の確認を受けること。
      </p>
    </div>
  );
}

export function UnrealizedGainPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <p className="text-sm text-neutral-500">読み込み中…</p>
    </div>
  );
}
