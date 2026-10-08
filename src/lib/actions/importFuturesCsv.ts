/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`importFuturesCsv`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(CSV解析・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。文字コード変換(`decodeCsvFile`、
 * `File`を受け取る)は呼び出し側(標準/スタンドアロン版双方の薄いラッパー)で行い、
 * このコア関数はデコード済みのCSV文字列を受け取ることでNode依存を無くし
 * テストしやすくしている(5-1-3d-44)。
 */
import { parseFuturesCsv, type FuturesCsvMapping } from "@/lib/investment/futuresCsv";
import type { FuturesTradeRepository } from "@/lib/repositories/futuresTradeRepository";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";

export interface ImportFuturesCsvInput {
  year: number;
  csvText: string;
  fileName: string;
  brokerLabel: string | null;
  mapping: FuturesCsvMapping;
}

export interface ImportFuturesCsvResult {
  importedRowCount: number;
  skippedRowCount: number;
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function importFuturesCsvCore(
  taxYearRepository: TaxYearRepository,
  futuresTradeRepository: FuturesTradeRepository,
  input: ImportFuturesCsvInput,
): Promise<ImportFuturesCsvResult> {
  const { year, csvText, fileName, brokerLabel, mapping } = input;

  const { rows, skippedRows } = parseFuturesCsv(csvText, mapping);

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);

  await futuresTradeRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: "futures_csv",
    fileName,
    rows: rows.map((row) => ({
      settledAt: row.settledAt,
      symbol: row.symbol,
      realizedPnlJpy: row.realizedPnlJpy.toString(),
      feeJpy: row.feeJpy.toString(),
      swapJpy: row.swapJpy.toString(),
      broker: brokerLabel,
      source: "futures_csv:manual",
    })),
  });

  const redirectTo =
    skippedRows.length > 0
      ? `/import?year=${year}&tab=futures&imported=${rows.length}&skipped=${skippedRows.length}`
      : `/import?year=${year}&tab=futures&imported=${rows.length}`;

  return {
    importedRowCount: rows.length,
    skippedRowCount: skippedRows.length,
    redirectTo,
  };
}
