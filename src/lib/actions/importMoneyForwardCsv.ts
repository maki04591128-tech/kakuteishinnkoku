/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`importMoneyForwardCsv`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(CSV解析・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。文字コード変換(`decodeCsvFile`、
 * `File`を受け取る)は呼び出し側(標準/スタンドアロン版双方の薄いラッパー)で行い、
 * このコア関数はデコード済みのCSV文字列を受け取ることでNode依存を無くし
 * テストしやすくしている(5-1-3d-45)。
 */
import { parseMoneyForwardCashflowCsv } from "@/lib/moneyforward/parseCashflow";
import type { CashflowEntryRepository } from "@/lib/repositories/cashflowEntryRepository";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";

export interface ImportMoneyForwardCsvInput {
  year: number;
  csvText: string;
  fileName: string;
}

export interface ImportMoneyForwardCsvResult {
  importedRowCount: number;
  skippedRowCount: number;
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function importMoneyForwardCsvCore(
  taxYearRepository: TaxYearRepository,
  cashflowEntryRepository: CashflowEntryRepository,
  input: ImportMoneyForwardCsvInput,
): Promise<ImportMoneyForwardCsvResult> {
  const { year, csvText, fileName } = input;

  const { rows, skippedRows } = parseMoneyForwardCashflowCsv(csvText);

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);

  await cashflowEntryRepository.importMoneyForwardCsv({
    taxYearId: taxYear.id,
    fileName,
    rows: rows.map((row) => ({
      date: row.date,
      content: row.content,
      amountJpy: row.amountJpy.toString(),
      direction: row.direction,
      largeCategory: row.largeCategory,
      middleCategory: row.middleCategory,
      institution: row.institution,
      memo: row.memo,
      isCalculationTarget: row.isCalculationTarget,
    })),
  });

  const redirectTo =
    skippedRows.length > 0
      ? `/import?year=${year}&imported=${rows.length}&skipped=${skippedRows.length}`
      : `/import?year=${year}&imported=${rows.length}`;

  return {
    importedRowCount: rows.length,
    skippedRowCount: skippedRows.length,
    redirectTo,
  };
}
