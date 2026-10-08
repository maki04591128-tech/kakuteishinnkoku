/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`importBrokerAnnualReportCsv`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(CSV解析・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。文字コード変換(`decodeCsvFile`、
 * `File`を受け取る)は呼び出し側(標準/スタンドアロン版双方の薄いラッパー)で行い、
 * このコア関数はデコード済みのCSV文字列を受け取ることでNode依存を無くし
 * テストしやすくしている(5-1-3d-41)。
 */
import type { AnnualReportCsvMapping } from "@/lib/investment/annualReportCsv";
import { parseBrokerAnnualReportCsv } from "@/lib/investment/annualReportCsv";
import type { BrokerAnnualReportRepository } from "@/lib/repositories/brokerAnnualReportRepository";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";

export interface ImportBrokerAnnualReportCsvInput {
  year: number;
  csvText: string;
  mapping: AnnualReportCsvMapping;
}

export interface ImportBrokerAnnualReportCsvResult {
  importedRowCount: number;
  skippedRowCount: number;
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function importBrokerAnnualReportCsvCore(
  taxYearRepository: TaxYearRepository,
  brokerAnnualReportRepository: BrokerAnnualReportRepository,
  input: ImportBrokerAnnualReportCsvInput,
): Promise<ImportBrokerAnnualReportCsvResult> {
  const { year, csvText, mapping } = input;

  const { rows, skippedRows } = parseBrokerAnnualReportCsv(csvText, mapping);

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);

  await brokerAnnualReportRepository.upsertMany(
    rows.map((row) => ({
      taxYearId: taxYear.id,
      broker: row.broker,
      accountType: row.accountType,
      proceedsJpy: row.proceedsJpy.toString(),
      acquisitionCostJpy: row.acquisitionCostJpy.toString(),
      dividendJpy: row.dividendJpy.toString(),
    })),
  );

  const redirectTo =
    skippedRows.length > 0
      ? `/import?year=${year}&tab=brokerReport&imported=${rows.length}&skipped=${skippedRows.length}`
      : `/import?year=${year}&tab=brokerReport&imported=${rows.length}`;

  return {
    importedRowCount: rows.length,
    skippedRowCount: skippedRows.length,
    redirectTo,
  };
}
