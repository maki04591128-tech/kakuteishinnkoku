"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続12回目。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`taxEstimatePageData.standalone.ts`に差し替えられる。
//
// `/tax-estimate`ページはフェーズ7-1の決定に従い`"use client"`化し、`searchParams`の
// 代わりに`useSearchParams()`で`year`を読み取る構成にした(`TaxEstimatePageContent.tsx`参照)。
// このファイルはそのClient Componentから`useEffect`(+`startTransition`)で呼び出す
// Server Function(`"use server"`)として、既存の`buildYearReport`・`buildTaxFilingSummary`・
// `getIncomeDeductionEntries`・各種`getXxxRecord`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import {
  getIncomeDeductionEntries,
  INCOME_DEDUCTION_TYPE_LABELS,
  summarizeIncomeDeductions,
} from "@/lib/incomeDeduction";
import { getMortgageDeductionRecord } from "@/lib/mortgageDeduction";
import { getForeignTaxCreditRecord } from "@/lib/investment/foreignTaxCredit";
import { getDistributionAdjustedForeignTaxCreditRecord } from "@/lib/investment/distributionAdjustedForeignTaxCredit";
import { getResidentTaxAdjustmentDeductionRecord } from "@/lib/residentTaxAdjustmentDeduction";
import { getDonationTaxCreditRecord } from "@/lib/donationTaxCredit";
import { getEarthquakeRenovationDeductionRecord } from "@/lib/earthquakeRenovationDeduction";
import { getEnergySavingRenovationDeductionRecord } from "@/lib/energySavingRenovationDeduction";
import { getBarrierFreeRenovationDeductionRecord } from "@/lib/barrierFreeRenovationDeduction";
import { getMultiHouseholdRenovationDeductionRecord } from "@/lib/multiHouseholdRenovationDeduction";
import { getDurabilityImprovementRenovationDeductionRecord } from "@/lib/durabilityImprovementRenovationDeduction";
import { getChildRearingRenovationDeductionRecord } from "@/lib/childRearingRenovationDeduction";
import { getCertifiedHousingConstructionCreditRecord } from "@/lib/certifiedHousingConstructionCredit";
import { getEmploymentIncomeRecord } from "@/lib/employmentIncome";
import type { TaxEstimatePageData } from "@/lib/taxEstimatePageData.types";

/** 所得控除の登録が無い場合の「給与所得等の課税所得金額」の仮の既定値 */
const BASE_OTHER_COMPREHENSIVE_INCOME_JPY = 5_000_000;

export async function getTaxEstimatePageData(yearParam: number | null): Promise<TaxEstimatePageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

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
        undefined, // mortgageDeduction
        undefined, // foreignTaxCredit
        report.investmentNonListed,
        undefined, // donationTaxCredit
        undefined, // distributionAdjustedForeignTaxCredit
        undefined, // residentTaxAdjustmentDeduction
        undefined, // earthquakeRenovationDeduction
        undefined, // energySavingRenovationDeduction
        undefined, // barrierFreeRenovationDeduction
        undefined, // multiHouseholdRenovationDeduction
        undefined, // durabilityImprovementRenovationDeduction
        undefined, // childRearingRenovationDeduction
        undefined, // certifiedHousingConstructionCredit
        report.stockMargin,
        report.cryptoCredit,
      )
    : null;

  const defaultCryptoMiscIncomeJpy = summary?.cryptoMiscIncomeJpy.toNumber() ?? 0;
  const defaultInvestmentTaxableGainJpy =
    summary?.investmentLossCarryforward.taxableGainJpy.toNumber() ?? 0;
  const defaultNonListedInvestmentTaxableGainJpy =
    report?.nonListedInvestmentTaxableGainJpy.toNumber() ?? 0;
  const defaultFuturesTaxableGainJpy =
    report?.futuresLossCarryforward.taxableGainJpy.toNumber() ?? 0;
  const defaultDividendIncomeJpy = summary?.investmentDividendJpy.toNumber() ?? 0;
  // 当年の株式等譲渡損失(現物取引+信用取引の合計。赤字の場合)を、
  // 配当所得との損益通算の初期値として提案する
  const defaultAvailableListedStockLossForDividendJpy = report
    ? Math.max(
        0,
        -report.investment.totalRealizedGainJpy
          .plus(report.stockMargin.totalRealizedGainJpy)
          .toNumber(),
      )
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

  const employmentIncomeRecord = await getEmploymentIncomeRecord(year);
  const registeredEmploymentIncome = employmentIncomeRecord
    ? {
        grossSalaryJpy: employmentIncomeRecord.grossSalaryJpy.toNumber(),
        employmentIncomeJpy: employmentIncomeRecord.employmentIncomeJpy.toNumber(),
      }
    : null;
  // 給与所得の試算(/employment-income)で年分の給与収入が登録済みならその給与所得金額を、
  // 未登録なら実際の給与収入額とは無関係な仮の値(500万円)を基礎として使う
  const baseComprehensiveIncomeJpy =
    registeredEmploymentIncome?.employmentIncomeJpy ?? BASE_OTHER_COMPREHENSIVE_INCOME_JPY;
  const defaultOtherComprehensiveIncomeJpy = Math.max(
    0,
    baseComprehensiveIncomeJpy - totalRegisteredIncomeTaxDeductionJpy,
  );

  const mortgageDeductionRecord = await getMortgageDeductionRecord(year);
  const registeredMortgageDeduction = mortgageDeductionRecord
    ? {
        nationalTaxCreditJpy: mortgageDeductionRecord.nationalTaxCreditJpy.toNumber(),
        residentTaxCreditJpy: mortgageDeductionRecord.residentTaxCreditJpy.toNumber(),
      }
    : null;

  const foreignTaxCreditRecord = await getForeignTaxCreditRecord(year);
  const registeredForeignTaxCredit = foreignTaxCreditRecord
    ? {
        nationalTaxCreditJpy: foreignTaxCreditRecord.nationalTaxCreditJpy.toNumber(),
        residentTaxCreditJpy: foreignTaxCreditRecord.residentTaxCreditJpy.toNumber(),
      }
    : null;

  const residentTaxAdjustmentDeductionRecord = await getResidentTaxAdjustmentDeductionRecord(year);
  const registeredResidentTaxAdjustmentDeductionJpy =
    residentTaxAdjustmentDeductionRecord?.adjustmentDeductionJpy.toNumber() ?? null;

  const donationTaxCreditRecord = await getDonationTaxCreditRecord(year);
  const registeredDonationTaxCreditJpy = donationTaxCreditRecord?.totalTaxCreditJpy.toNumber() ?? null;
  const registeredDonationTaxCreditResidentTaxJpy =
    donationTaxCreditRecord?.residentTaxBasicDeductionJpy.toNumber() ?? null;

  const distributionAdjustedForeignTaxCreditRecord =
    await getDistributionAdjustedForeignTaxCreditRecord(year);
  const registeredDistributionAdjustedForeignTaxCreditJpy =
    distributionAdjustedForeignTaxCreditRecord?.creditJpy.toNumber() ?? null;

  const earthquakeRenovationDeductionRecord = await getEarthquakeRenovationDeductionRecord(year);
  const registeredEarthquakeRenovationDeductionJpy =
    earthquakeRenovationDeductionRecord?.creditJpy.toNumber() ?? null;

  const energySavingRenovationDeductionRecord = await getEnergySavingRenovationDeductionRecord(year);
  const registeredEnergySavingRenovationDeductionJpy =
    energySavingRenovationDeductionRecord?.creditJpy.toNumber() ?? null;

  const barrierFreeRenovationDeductionRecord = await getBarrierFreeRenovationDeductionRecord(year);
  const registeredBarrierFreeRenovationDeductionJpy =
    barrierFreeRenovationDeductionRecord?.creditJpy.toNumber() ?? null;

  const multiHouseholdRenovationDeductionRecord =
    await getMultiHouseholdRenovationDeductionRecord(year);
  const registeredMultiHouseholdRenovationDeductionJpy =
    multiHouseholdRenovationDeductionRecord?.creditJpy.toNumber() ?? null;

  const durabilityImprovementRenovationDeductionRecord =
    await getDurabilityImprovementRenovationDeductionRecord(year);
  const registeredDurabilityImprovementRenovationDeductionJpy =
    durabilityImprovementRenovationDeductionRecord?.creditJpy.toNumber() ?? null;

  const childRearingRenovationDeductionRecord = await getChildRearingRenovationDeductionRecord(year);
  const registeredChildRearingRenovationDeductionJpy =
    childRearingRenovationDeductionRecord?.creditJpy.toNumber() ?? null;

  const certifiedHousingConstructionCreditRecord =
    await getCertifiedHousingConstructionCreditRecord(year);
  const registeredCertifiedHousingConstructionCreditJpy =
    certifiedHousingConstructionCreditRecord?.creditJpy.toNumber() ?? null;

  return {
    year,
    availableYears,
    defaultOtherComprehensiveIncomeJpy,
    defaultCryptoMiscIncomeJpy,
    defaultInvestmentTaxableGainJpy,
    defaultNonListedInvestmentTaxableGainJpy,
    defaultFuturesTaxableGainJpy,
    defaultDividendIncomeJpy,
    defaultAvailableListedStockLossForDividendJpy,
    registeredIncomeDeductions,
    totalRegisteredIncomeTaxDeductionJpy,
    incomeDeductionNotes,
    registeredEmploymentIncome,
    registeredResidentTaxAdjustmentDeductionJpy,
    registeredMortgageDeduction,
    registeredDonationTaxCreditJpy,
    registeredDonationTaxCreditResidentTaxJpy,
    registeredForeignTaxCredit,
    registeredDistributionAdjustedForeignTaxCreditJpy,
    registeredEarthquakeRenovationDeductionJpy,
    registeredEnergySavingRenovationDeductionJpy,
    registeredBarrierFreeRenovationDeductionJpy,
    registeredMultiHouseholdRenovationDeductionJpy,
    registeredDurabilityImprovementRenovationDeductionJpy,
    registeredChildRearingRenovationDeductionJpy,
    registeredCertifiedHousingConstructionCreditJpy,
  };
}
