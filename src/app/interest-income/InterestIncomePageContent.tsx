"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { InterestIncomeSimulatorForm } from "./InterestIncomeSimulatorForm";
import { getInterestIncomePageData } from "@/lib/interestIncomePageData";
import type { InterestIncomePageData } from "@/lib/interestIncomePageData.types";

export function InterestIncomePageContent() {
  const searchParams = useSearchParams();
  const yearParam = Number(searchParams.get("year")) || null;

  const [data, setData] = useState<InterestIncomePageData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getInterestIncomePageData(yearParam);
      setData(result);
    });
  }, [yearParam]);

  if (!data) {
    return <InterestIncomePageSkeleton />;
  }

  const { year, defaultAvailableListedStockLossJpy } = data;

  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10"
      aria-busy={isPending}
    >
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          特定公社債の利子所得の課税方式シミュレーション({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          国債・地方債・公募公社債・上場公社債投資信託等(特定公社債)の利子等について、
          申告分離課税・申告不要のどちらを選ぶと税負担が軽くなるかを試算する。
        </p>
      </header>

      <InterestIncomeSimulatorForm
        defaultInterestIncomeJpy={0}
        defaultAvailableListedStockLossJpy={defaultAvailableListedStockLossJpy}
      />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本シミュレーターは申告分離課税の税率20.315%(所得税15.315%+住民税5%)を用いた概算であり、
        均等割等の他の要素は考慮していない。一般公社債等の利子(原則として源泉分離課税で申告不可)は
        対象外。実際の申告方式の決定は税理士等の専門家に確認すること。
      </p>
    </div>
  );
}

export function InterestIncomePageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <p className="text-sm text-neutral-500">読み込み中…</p>
    </div>
  );
}
