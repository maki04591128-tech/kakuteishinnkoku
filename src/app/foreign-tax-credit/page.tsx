import Link from "next/link";
import { prisma } from "@/lib/db";
import { getForeignTaxCreditRecord } from "@/lib/investment/foreignTaxCredit";
import { buildYearReport } from "@/lib/reporting";
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import { ForeignTaxCreditForm } from "./ForeignTaxCreditForm";

export default async function ForeignTaxCreditPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    excessCarried?: string;
    spareLimitCarried?: string;
    foreignTaxCreditSaved?: string;
  }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const taxYear = await getOrCreateTaxYear(year);
  const [carryforwards, spareLimitCarryforwards, report, registeredRecord] = await Promise.all([
    prisma.foreignTaxCreditCarryforward.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { originYear: "asc" },
    }),
    prisma.foreignTaxCreditSpareLimitCarryforward.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { originYear: "asc" },
    }),
    buildYearReport(year),
    getForeignTaxCreditRecord(year),
  ]);

  const autoForeignSourceIncomeJpy =
    report?.investment.totalForeignSourceIncomeJpy.toString() ?? "0";
  const autoForeignIncomeTaxPaidJpy =
    report?.investment.totalForeignTaxWithheldJpy.toString() ?? "0";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          外国税額控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          米国株式等、国外で源泉徴収された配当等がある場合に、その年の所得税額・
          復興特別所得税額・住民税額から控除できる外国税額控除の限度額と控除額を試算する。
        </p>
      </header>

      {params.excessCarried !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {Number(params.excessCarried) > 0
            ? `${params.excessCarried}件の繰越控除限度超過額を${year + 1}年分として登録しました。`
            : `登録できる繰越控除限度超過額はありませんでした(既に${year + 1}年分に登録済みか、超過額が発生していません)。`}
        </p>
      )}

      {params.spareLimitCarried !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {Number(params.spareLimitCarried) > 0
            ? `${params.spareLimitCarried}件の繰越控除余裕額を${year + 1}年分として登録しました。`
            : `登録できる繰越控除余裕額はありませんでした(既に${year + 1}年分に登録済みか、余裕額が発生していません)。`}
        </p>
      )}

      {params.foreignTaxCreditSaved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の外国税額控除を登録しました。下書きCSV(データ取り込み画面の
          エクスポート)の税額控除欄に自動反映されます。
        </p>
      )}

      <ForeignTaxCreditForm
        year={year}
        carryforwardEntries={carryforwards.map((c) => ({
          originYear: c.originYear,
          remainingAmountJpy: c.remainingAmountJpy.toString(),
        }))}
        spareLimitCarryforwardEntries={spareLimitCarryforwards.map((c) => ({
          originYear: c.originYear,
          remainingAmountJpy: c.remainingAmountJpy.toString(),
        }))}
        autoForeignSourceIncomeJpy={autoForeignSourceIncomeJpy}
        autoForeignIncomeTaxPaidJpy={autoForeignIncomeTaxPaidJpy}
        registeredTotalCreditJpy={
          registeredRecord ? registeredRecord.totalCreditJpy.toNumber() : null
        }
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「所得税額」「所得総額(総所得金額等)」は、本ツールが集計する暗号資産・投資の
          損益だけでなく、給与所得など他のすべての所得を合算した確定申告書全体の金額を
          入力する必要がある(本ツールは給与所得等を管理していないため自動計算できない)。
        </p>
        <p>
          「国外所得金額」は、`/import`
          で株式等の取引に「国外で発行された株式・投資信託等」のチェックを付けて
          配当・分配金または売却を登録すると、その課税口座分(NISA口座は国内非課税の
          ため対象外)の配当等と譲渡益(為替差損益を含む)を合算して自動集計し初期値に
          反映する(取得後も手入力で上書き可能)。「外国所得税額」は配当等の源泉徴収分
          のみ自動集計する(株式等の譲渡益に対する現地源泉徴収は通常発生しないため
          対象外)。取引登録していない国外所得はいずれも自動集計されないため、
          その場合は引き続き手入力すること。
        </p>
        <p>
          繰越控除限度超過額・繰越控除余裕額はいずれも発生年ごとに
          <Link href={`/import?year=${year}&tab=foreignTaxCredit`} className="underline">
            データ取り込み画面
          </Link>
          で登録・確認でき、発生年から3年間のみ有効(期限切れは自動的に控除対象から
          除外)。当年の試算結果に翌年以後へ繰り越す額が発生した場合は、下のボタンから
          {year + 1}年分として一括登録できる(住民税の控除限度額は所得税の控除限度額の
          30%(道府県民税12%+市町村民税18%)の標準割合で概算しており、実際の控除は
          所得税→復興特別所得税→住民税の順に市区町村が計算する)。
        </p>
        <p>
          本ツールの計算結果は概算であり、実際の申告内容は国税庁「確定申告書等作成
          コーナー」の計算結果や税理士等の専門家の確認を受けること。
        </p>
      </div>
    </div>
  );
}
