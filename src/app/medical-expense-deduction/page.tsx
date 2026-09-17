import Link from "next/link";
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { MedicalExpenseDeductionForm } from "./MedicalExpenseDeductionForm";

export default async function MedicalExpenseDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  const summary = report
    ? buildTaxFilingSummary(
        year,
        report.crypto,
        report.investment,
        report.lossCarryforward,
        report.cryptoMargin,
        report.futures,
        report.futuresLossCarryforward,
      )
    : null;

  // 給与所得等(本ツールが管理しない部分)は概算試算と同じ既定値(500万円)を仮定し、
  // 暗号資産・株式等・配当・先物の当年集計値を合算して総所得金額等の初期値とする
  const defaultTotalIncomeJpy =
    5_000_000 +
    (summary?.cryptoMiscIncomeJpy.toNumber() ?? 0) +
    (summary?.investmentLossCarryforward.taxableGainJpy.toNumber() ?? 0) +
    (summary?.investmentDividendJpy.toNumber() ?? 0) +
    (report?.futuresLossCarryforward.taxableGainJpy.toNumber() ?? 0);

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "MEDICAL_EXPENSE");
  const registeredDeductionJpy = registeredEntry
    ? Number(registeredEntry.incomeTaxAmountJpy)
    : null;
  const registeredSelfMedicationEntry = findIncomeDeductionEntry(
    incomeDeductionEntries,
    "SELF_MEDICATION",
  );
  const registeredSelfMedicationDeductionJpy = registeredSelfMedicationEntry
    ? Number(registeredSelfMedicationEntry.incomeTaxAmountJpy)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          医療費控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          年間に支払った医療費と保険金等の補填額から、所得税法上の医療費控除額を試算する。
          総所得金額等はこの年の暗号資産・株式等・配当・先物の集計値と、給与所得等の
          仮定値(500万円)を合算した金額を初期値として表示している。選択制で併用できない
          セルフメディケーション税制(特定一般用医薬品等購入費控除)との比較も行える。
        </p>
      </header>

      <MedicalExpenseDeductionForm
        year={year}
        defaultTotalIncomeJpy={defaultTotalIncomeJpy}
        registeredDeductionJpy={registeredDeductionJpy}
        registeredSelfMedicationDeductionJpy={registeredSelfMedicationDeductionJpy}
      />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        国税庁の医療費控除の計算式による概算値であり、実際の申告には医療費控除の明細書の
        作成が必要。医療費控除とセルフメディケーション税制(特定一般用医薬品等購入費控除)は
        選択制で併用できないため、両方を登録した場合`/tax-estimate`の合計額には有利な方の
        金額のみを反映する。「この試算結果を{year}年分の所得控除として登録する」ボタンで
        登録すると、`/tax-estimate`の「給与所得等の課税所得金額」の初期値にこの控除額が
        自動反映される(登録後も入力欄は手入力で上書き可能)。
      </p>
    </div>
  );
}
