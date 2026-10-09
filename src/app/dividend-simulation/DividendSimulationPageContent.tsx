"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { DividendSimulatorForm } from "./DividendSimulatorForm";
import { getDividendSimulationPageData } from "@/lib/dividendSimulationPageData";
import type { DividendSimulationPageData } from "@/lib/dividendSimulationPageData.types";

export function DividendSimulationPageContent() {
  const searchParams = useSearchParams();
  const yearParam = Number(searchParams.get("year")) || null;

  const [data, setData] = useState<DividendSimulationPageData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getDividendSimulationPageData(yearParam);
      setData(result);
    });
  }, [yearParam]);

  if (!data) {
    return <DividendSimulationPageSkeleton />;
  }

  const {
    year,
    defaultDividendJpy,
    defaultDividendHalfCreditJpy,
    defaultDividendQuarterCreditJpy,
    defaultDividendNoCreditJpy,
    defaultAvailableListedStockLossJpy,
    defaultNonListedDividendJpy,
    defaultNonListedDividendHalfCreditJpy,
    defaultNonListedDividendQuarterCreditJpy,
    defaultNonListedDividendNoCreditJpy,
  } = data;

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
          配当所得の課税方式シミュレーション({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          総合課税・申告分離課税・申告不要のどれを選ぶと税負担が最も軽くなるかを試算する。
          {defaultDividendJpy > 0
            ? "配当所得金額はこの年の配当受取額(銘柄種別ごとの配当控除税率の内訳を含む)を初期値として表示している。"
            : "配当所得金額は手入力で試算できる。"}
        </p>
      </header>

      <DividendSimulatorForm
        defaultDividendJpy={defaultDividendJpy}
        defaultDividendHalfCreditJpy={defaultDividendHalfCreditJpy}
        defaultDividendQuarterCreditJpy={defaultDividendQuarterCreditJpy}
        defaultDividendNoCreditJpy={defaultDividendNoCreditJpy}
        defaultAvailableListedStockLossJpy={defaultAvailableListedStockLossJpy}
        defaultNonListedDividendJpy={defaultNonListedDividendJpy}
        defaultNonListedDividendHalfCreditJpy={defaultNonListedDividendHalfCreditJpy}
        defaultNonListedDividendQuarterCreditJpy={defaultNonListedDividendQuarterCreditJpy}
        defaultNonListedDividendNoCreditJpy={defaultNonListedDividendNoCreditJpy}
      />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本シミュレーターは所得税の速算表・住民税10%・配当控除の標準的な税率を用いた概算であり、
        均等割・各種所得控除の変動・国民健康保険料等への影響は考慮していない。
        実際の申告方式の決定は税理士等の専門家に確認すること。
      </p>
    </div>
  );
}

export function DividendSimulationPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <p className="text-sm text-neutral-500">読み込み中…</p>
    </div>
  );
}
