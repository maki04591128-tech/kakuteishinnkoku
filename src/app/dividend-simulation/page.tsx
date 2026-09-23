import Link from "next/link";
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import { DividendSimulatorForm } from "./DividendSimulatorForm";

export default async function DividendSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  const defaultDividendJpy = report?.investment.totalDividendJpy.toNumber() ?? 0;
  const defaultDividendHalfCreditJpy =
    report?.investment.totalDividendHalfCreditJpy.toNumber() ?? 0;
  const defaultDividendNoCreditJpy =
    report?.investment.totalDividendNoCreditJpy.toNumber() ?? 0;
  // 当年の株式等譲渡損失(赤字の場合)を、申告分離課税での損益通算の初期値として提案する
  const defaultAvailableListedStockLossJpy = report
    ? Math.max(0, -report.investment.totalRealizedGainJpy.toNumber())
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          配当所得の課税方式シミュレーション({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          総合課税・申告分離課税・申告不要のどれを選ぶと税負担が最も軽くなるかを試算する。
          {report && report.investment.totalDividendJpy.greaterThan(0)
            ? "配当所得金額はこの年の配当受取額(銘柄種別ごとの配当控除税率の内訳を含む)を初期値として表示している。"
            : "配当所得金額は手入力で試算できる。"}
        </p>
      </header>

      <DividendSimulatorForm
        defaultDividendJpy={defaultDividendJpy}
        defaultDividendHalfCreditJpy={defaultDividendHalfCreditJpy}
        defaultDividendNoCreditJpy={defaultDividendNoCreditJpy}
        defaultAvailableListedStockLossJpy={defaultAvailableListedStockLossJpy}
      />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本シミュレーターは所得税の速算表・住民税10%・配当控除の標準的な税率を用いた概算であり、
        均等割・各種所得控除の変動・国民健康保険料等への影響は考慮していない。
        実際の申告方式の決定は税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
