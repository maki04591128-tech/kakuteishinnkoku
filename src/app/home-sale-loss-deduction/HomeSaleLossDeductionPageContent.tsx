"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { HomeSaleLossDeductionForm } from "./HomeSaleLossDeductionForm";
import { getHomeSaleLossDeductionPageData } from "@/lib/homeSaleLossDeductionPageData";
import type { HomeSaleLossDeductionPageData } from "@/lib/homeSaleLossDeductionPageData.types";

export function HomeSaleLossDeductionPageContent() {
  const searchParams = useSearchParams();
  const yearParam = Number(searchParams.get("year")) || null;
  const lossCarried = searchParams.get("lossCarried");

  const [data, setData] = useState<HomeSaleLossDeductionPageData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getHomeSaleLossDeductionPageData(yearParam);
      setData(result);
    });
  }, [yearParam]);

  if (!data) {
    return <HomeSaleLossDeductionPageSkeleton />;
  }

  const { year, registeredDeduction, carryforwardEntries } = data;

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
          特定居住用財産の譲渡損失の損益通算・繰越控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          住宅ローンが残っているマイホームを売却して譲渡損失が生じた場合の、特定居住用
          財産の譲渡損失の損益通算及び繰越控除の特例(租税特別措置法41条の5の2)を
          試算できる。買い換え(新居の取得)を要件としない特例のみが対象で、買換資産の
          データが必要な
          <Link href={`/home-replacement-loss-deduction?year=${year}`} className="underline">
            居住用財産の買換え等の場合の譲渡損失の損益通算及び繰越控除の特例(措置法41条の5)
          </Link>
          は別の試算画面で対応する。暗号資産・投資の集計とは独立した単体の試算画面のため、
          この年分の取引データには依存しない。
        </p>
      </header>

      {lossCarried !== null && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {Number(lossCarried) > 0
            ? `${lossCarried}件の繰越譲渡損失を${year + 1}年分として登録しました。`
            : `登録できる繰越譲渡損失はありませんでした(既に${year + 1}年分に登録済みか、控除しきれなかった金額がありません)。`}
        </p>
      )}

      <HomeSaleLossDeductionForm
        year={year}
        registeredDeduction={registeredDeduction}
        carryforwardEntries={carryforwardEntries}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          国税庁タックスアンサーNo.3390の要件・計算式による概算値であり、居住用財産で
          あることの判定や、親族等への譲渡でないこと・前年前々年に他の特例の適用を
          受けていないこと等の細かな要件は必ず自身で確認すること。
        </p>
        <p>
          「この年分の所得控除として登録する」ボタンで登録すると、繰越控除の使用額も
          合わせた実際にその年の総所得金額等から控除できた金額(所得税・住民税とも同額)が
          `/tax-estimate`の「給与所得等の課税所得金額」の初期値に自動反映される
          (登録後も入力欄は手入力で上書き可能)。
        </p>
        <p>
          損益通算の対象額がその年の総所得金額等を超えて控除しきれなかった場合、超過額
          (譲渡損失の金額)は翌年以後3年間繰り越して総所得金額等から控除できる(ただし
          繰越控除を適用する年の合計所得金額が3,000万円を超える場合はその年は適用不可)。
          発生年ごとの繰越残高は
          <Link href={`/import?year=${year}&tab=homeSaleLossCarryforward`} className="underline">
            データ取り込み画面
          </Link>
          で登録・確認でき、当年の試算結果に翌年以後へ繰り越す額が発生した場合は
          下のボタンから{year + 1}年分として一括登録できる。
        </p>
      </div>
    </div>
  );
}

export function HomeSaleLossDeductionPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <p className="text-sm text-neutral-500">読み込み中…</p>
    </div>
  );
}
