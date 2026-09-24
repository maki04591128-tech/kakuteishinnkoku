import Link from "next/link";
import { getDistributionAdjustedForeignTaxCreditRecord } from "@/lib/investment/distributionAdjustedForeignTaxCredit";
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import { DistributionAdjustedForeignTaxCreditForm } from "./DistributionAdjustedForeignTaxCreditForm";

export default async function DistributionAdjustedForeignTaxCreditPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const [report, registeredRecord] = await Promise.all([
    buildYearReport(year),
    getDistributionAdjustedForeignTaxCreditRecord(year),
  ]);

  const autoDistributionAdjustedForeignTaxJpy =
    report?.investment.totalDistributionAdjustedForeignTaxJpy.toString() ?? "0";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          分配時調整外国税相当額控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          投資信託等が国外資産から生じた利子・配当等を受け取る際に信託段階で
          源泉徴収された外国所得税額のうち、特定口座年間取引報告書等に
          「分配時調整外国税相当額」として記載された金額は、その年分の所得税額
          (復興特別所得税を含む)から控除できる(所得税法93条の2)。国外で発行された
          株式・投資信託等の配当等にかかる
          <Link href={`/foreign-tax-credit?year=${year}`} className="underline">
            外国税額控除
          </Link>
          とは別の制度で、控除限度額の計算・繰越は無い(国内籍の投資信託・ETFの
          分配金にも生じうる)。
        </p>
      </header>

      {params.saved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の分配時調整外国税相当額控除を登録しました。下書きCSV(データ取り込み
          画面のエクスポート)の税額控除欄と、`/tax-estimate`の合計税額試算に自動反映されます。
        </p>
      )}

      <DistributionAdjustedForeignTaxCreditForm
        year={year}
        autoDistributionAdjustedForeignTaxJpy={autoDistributionAdjustedForeignTaxJpy}
        registeredCreditJpy={registeredRecord ? registeredRecord.creditJpy.toNumber() : null}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「分配時調整外国税相当額」は、
          <Link href={`/import?year=${year}&tab=investment`} className="underline">
            データ取り込み画面
          </Link>
          で配当・分配金(type=DIVIDEND)を登録する際に入力すると、その課税口座分
          (NISA口座は国内非課税のため対象外)を合算して自動集計し初期値に反映する
          (取得後も手入力で上書き可能)。「控除適用前の所得税額」は、本ツールが管理
          しない給与所得等も含めた確定申告書全体の金額(
          <Link href={`/tax-estimate?year=${year}`} className="underline">
            所得税・住民税の概算合計税額試算
          </Link>
          の外国税額控除適用後の所得税額)を入力する。
        </p>
        <p>
          外国税額控除(所得税法95条)と異なり控除限度額の計算・繰越控除は無く、
          その年分の所得税額(復興特別所得税を含む)を上限にそのまま控除する
          (超過分は繰越・還付されず切り捨て)。住民税についてはこの控除に
          相当する制度が存在しないため、所得税・復興特別所得税分のみを試算する。
        </p>
        <p>
          本ツールの計算結果は概算であり、実際の申告内容は国税庁「確定申告書等作成
          コーナー」の計算結果や税理士等の専門家の確認を受けること。
        </p>
      </div>
    </div>
  );
}
