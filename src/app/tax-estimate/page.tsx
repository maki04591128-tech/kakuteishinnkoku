import Link from "next/link";
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import {
  getIncomeDeductionEntries,
  INCOME_DEDUCTION_TYPE_LABELS,
  summarizeIncomeDeductions,
} from "@/lib/incomeDeduction";
import { TotalTaxEstimateForm } from "./TotalTaxEstimateForm";

/** 所得控除の登録が無い場合の「給与所得等の課税所得金額」の仮の既定値 */
const BASE_OTHER_COMPREHENSIVE_INCOME_JPY = 5_000_000;

export default async function TaxEstimatePage({
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

  const defaultCryptoMiscIncomeJpy = summary?.cryptoMiscIncomeJpy.toNumber() ?? 0;
  const defaultInvestmentTaxableGainJpy =
    summary?.investmentLossCarryforward.taxableGainJpy.toNumber() ?? 0;
  const defaultFuturesTaxableGainJpy =
    report?.futuresLossCarryforward.taxableGainJpy.toNumber() ?? 0;
  const defaultDividendIncomeJpy = summary?.investmentDividendJpy.toNumber() ?? 0;
  // 当年の株式等譲渡損失(赤字の場合)を、配当所得との損益通算の初期値として提案する
  const defaultAvailableListedStockLossForDividendJpy = report
    ? Math.max(0, -report.investment.totalRealizedGainJpy.toNumber())
    : 0;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const incomeDeductionSummary = summarizeIncomeDeductions(incomeDeductionEntries);
  const registeredIncomeDeductions = incomeDeductionSummary.entries.map((entry) => ({
    label: INCOME_DEDUCTION_TYPE_LABELS[entry.type],
    incomeTaxAmountJpy: entry.incomeTaxAmountJpy.toNumber(),
    residentTaxAmountJpy: entry.residentTaxAmountJpy.toNumber(),
  }));
  const totalRegisteredIncomeTaxDeductionJpy =
    incomeDeductionSummary.totalIncomeTaxAmountJpy.toNumber();
  const incomeDeductionNotes = incomeDeductionSummary.notes;
  const defaultOtherComprehensiveIncomeJpy = Math.max(
    0,
    BASE_OTHER_COMPREHENSIVE_INCOME_JPY - totalRegisteredIncomeTaxDeductionJpy,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          所得税・住民税の概算合計税額試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          暗号資産の雑所得・株式等の譲渡所得・配当所得・先物取引に係る雑所得等を
          合算し、その年の所得税・復興特別所得税・住民税の概算合計額を試算する。
          株式等・配当・先物取引の各金額はこの年の集計値を初期値として表示している。
        </p>
      </header>

      <TotalTaxEstimateForm
        defaultOtherComprehensiveIncomeJpy={defaultOtherComprehensiveIncomeJpy}
        defaultCryptoMiscIncomeJpy={defaultCryptoMiscIncomeJpy}
        defaultInvestmentTaxableGainJpy={defaultInvestmentTaxableGainJpy}
        defaultFuturesTaxableGainJpy={defaultFuturesTaxableGainJpy}
        defaultDividendIncomeJpy={defaultDividendIncomeJpy}
        defaultAvailableListedStockLossForDividendJpy={
          defaultAvailableListedStockLossForDividendJpy
        }
        registeredIncomeDeductions={registeredIncomeDeductions}
        totalRegisteredIncomeTaxDeductionJpy={totalRegisteredIncomeTaxDeductionJpy}
        incomeDeductionNotes={incomeDeductionNotes}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「給与所得等の課税所得金額」は、本ツールが管理していない給与所得等について、
          各種所得控除(基礎控除・社会保険料控除等)を差し引いた後の金額を入力する
          (源泉徴収票の「給与所得控除後の金額」から更に所得控除を差し引いた額に相当)。
          医療費控除・生命保険料控除・小規模企業共済等掛金控除(iDeCo等)・社会保険料控除の
          各試算画面で「この試算結果を◯年分の所得控除として登録する」を実行済みの場合、
          その合計額(所得税ベース)を仮の給与収入(500万円)から差し引いた額を初期値として
          表示する。基礎控除等それ以外の所得控除は引き続き含まれないため、実際の金額は
          自分で確認して上書きすること。
        </p>
        <p>
          住民税は所得割10%固定の概算であり、均等割・調整控除は含まない。また
          源泉徴収税額・予定納税額との相殺は行っていないため、ここで求まるのは
          年間の税額そのものの概算値であり、実際の納付額・還付額とは異なる。
        </p>
        <p>
          本ツールの計算結果は概算であり、実際の申告内容は国税庁「確定申告書等作成
          コーナー」の計算結果や税理士等の専門家の確認を受けること。
        </p>
      </div>
    </div>
  );
}
