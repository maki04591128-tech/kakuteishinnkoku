/**
 * フェーズ5(5-1-2)。`src/app/api/export/route.ts`から、Next.jsのRoute
 * Handler固有API(`NextRequest`/`NextResponse`)に依存しない部分(年ごとの
 * データ集計・CSV生成)をコア関数として切り出した。フェーズ3の「コア関数
 * 抽出」パターンと同じ狙いだが、`buildYearReport`自体が多数のリポジトリを
 * 内部で(注入ではなく)直接呼び出す大きな関数のため、本関数も現時点では
 * 既定のPrisma実装にそのまま依存する(リポジトリ注入によるテスト容易化は
 * 対象外)。
 *
 * `output: "export"`(スタンドアロン版の静的書き出し)はRequestに依存する
 * Route Handlerを未対応としているため、この関数を切り出すだけではまだ
 * スタンドアロン版のビルドは成功しない。Route Handler自体をビルド対象から
 * 除外した上で、クライアント側から直接この関数(またはクライアントDB版の
 * 同等実装)を呼び出す形に置き換える対応を次のステップで行う。
 */
import { buildTaxFilingDraftCsv, UTF8_BOM } from "@/lib/etax/csvExport";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { getIncomeDeductionEntries, summarizeIncomeDeductions } from "@/lib/incomeDeduction";
import { getDonationTaxCreditRecord } from "@/lib/donationTaxCredit";
import { getForeignTaxCreditRecord } from "@/lib/investment/foreignTaxCredit";
import { getDistributionAdjustedForeignTaxCreditRecord } from "@/lib/investment/distributionAdjustedForeignTaxCredit";
import { getMortgageDeductionRecord } from "@/lib/mortgageDeduction";
import { getResidentTaxAdjustmentDeductionRecord } from "@/lib/residentTaxAdjustmentDeduction";
import { getEarthquakeRenovationDeductionRecord } from "@/lib/earthquakeRenovationDeduction";
import { getEnergySavingRenovationDeductionRecord } from "@/lib/energySavingRenovationDeduction";
import { getBarrierFreeRenovationDeductionRecord } from "@/lib/barrierFreeRenovationDeduction";
import { getMultiHouseholdRenovationDeductionRecord } from "@/lib/multiHouseholdRenovationDeduction";
import { getDurabilityImprovementRenovationDeductionRecord } from "@/lib/durabilityImprovementRenovationDeduction";
import { getChildRearingRenovationDeductionRecord } from "@/lib/childRearingRenovationDeduction";
import { getCertifiedHousingConstructionCreditRecord } from "@/lib/certifiedHousingConstructionCredit";
import { buildYearReport } from "@/lib/reporting";

export interface DraftCsvExport {
  /** ダウンロード時のファイル名(拡張子込み)。 */
  filename: string;
  /** UTF-8 BOM付きのCSV本文。 */
  content: string;
}

/**
 * 指定年分の申告書作成コーナー用下書きCSVを生成する。対象年分のデータが
 * 無い場合は`null`を返す。
 */
export async function buildDraftCsvExport(year: number): Promise<DraftCsvExport | null> {
  const report = await buildYearReport(year);
  if (!report) {
    return null;
  }

  const [
    mortgageDeductionRecord,
    foreignTaxCreditRecord,
    donationTaxCreditRecord,
    distributionAdjustedForeignTaxCreditRecord,
    residentTaxAdjustmentDeductionRecord,
    earthquakeRenovationDeductionRecord,
    energySavingRenovationDeductionRecord,
    barrierFreeRenovationDeductionRecord,
    multiHouseholdRenovationDeductionRecord,
    durabilityImprovementRenovationDeductionRecord,
    childRearingRenovationDeductionRecord,
    certifiedHousingConstructionCreditRecord,
  ] = await Promise.all([
    getMortgageDeductionRecord(year),
    getForeignTaxCreditRecord(year),
    getDonationTaxCreditRecord(year),
    getDistributionAdjustedForeignTaxCreditRecord(year),
    getResidentTaxAdjustmentDeductionRecord(year),
    getEarthquakeRenovationDeductionRecord(year),
    getEnergySavingRenovationDeductionRecord(year),
    getBarrierFreeRenovationDeductionRecord(year),
    getMultiHouseholdRenovationDeductionRecord(year),
    getDurabilityImprovementRenovationDeductionRecord(year),
    getChildRearingRenovationDeductionRecord(year),
    getCertifiedHousingConstructionCreditRecord(year),
  ]);

  const summary = buildTaxFilingSummary(
    year,
    report.crypto,
    report.investment,
    report.lossCarryforward,
    report.cryptoMargin,
    report.futures,
    report.futuresLossCarryforward,
    mortgageDeductionRecord
      ? {
          nationalTaxCreditJpy: mortgageDeductionRecord.nationalTaxCreditJpy,
          residentTaxCreditJpy: mortgageDeductionRecord.residentTaxCreditJpy,
        }
      : undefined,
    foreignTaxCreditRecord
      ? { totalCreditJpy: foreignTaxCreditRecord.totalCreditJpy }
      : undefined,
    report.investmentNonListed,
    donationTaxCreditRecord
      ? {
          totalCreditJpy: donationTaxCreditRecord.totalTaxCreditJpy,
          residentTaxBasicDeductionJpy: donationTaxCreditRecord.residentTaxBasicDeductionJpy,
        }
      : undefined,
    distributionAdjustedForeignTaxCreditRecord
      ? { creditJpy: distributionAdjustedForeignTaxCreditRecord.creditJpy }
      : undefined,
    residentTaxAdjustmentDeductionRecord
      ? { adjustmentDeductionJpy: residentTaxAdjustmentDeductionRecord.adjustmentDeductionJpy }
      : undefined,
    earthquakeRenovationDeductionRecord
      ? { creditJpy: earthquakeRenovationDeductionRecord.creditJpy }
      : undefined,
    energySavingRenovationDeductionRecord
      ? { creditJpy: energySavingRenovationDeductionRecord.creditJpy }
      : undefined,
    barrierFreeRenovationDeductionRecord
      ? { creditJpy: barrierFreeRenovationDeductionRecord.creditJpy }
      : undefined,
    multiHouseholdRenovationDeductionRecord
      ? { creditJpy: multiHouseholdRenovationDeductionRecord.creditJpy }
      : undefined,
    durabilityImprovementRenovationDeductionRecord
      ? { creditJpy: durabilityImprovementRenovationDeductionRecord.creditJpy }
      : undefined,
    childRearingRenovationDeductionRecord
      ? { creditJpy: childRearingRenovationDeductionRecord.creditJpy }
      : undefined,
    certifiedHousingConstructionCreditRecord
      ? { creditJpy: certifiedHousingConstructionCreditRecord.creditJpy }
      : undefined,
    report.stockMargin,
    report.cryptoCredit,
  );
  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const incomeDeductions = summarizeIncomeDeductions(incomeDeductionEntries);

  const csv = buildTaxFilingDraftCsv(
    summary,
    report.crypto.bySymbol,
    report.investment.bySymbol,
    report.cryptoCostMethod,
    report.cryptoMargin.bySymbol,
    report.futures.bySymbol,
    incomeDeductions,
    report.investmentNonListed.bySymbol,
    report.stockMargin.bySymbol,
    report.cryptoCredit.bySymbol,
  );

  return {
    filename: `kakuteishinkoku_draft_${year}.csv`,
    content: UTF8_BOM + csv,
  };
}
