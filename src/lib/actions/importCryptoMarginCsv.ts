/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`importCryptoMarginCsv`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(CSV解析・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。文字コード変換(`decodeCsvFile`、
 * `File`を受け取る)は呼び出し側(標準/スタンドアロン版双方の薄いラッパー)で行い、
 * このコア関数はデコード済みのCSV文字列を受け取ることでNode依存を無くし
 * テストしやすくしている(5-1-3d-43)。
 */
import { parseCryptoMarginCsv, type MarginCsvMapping } from "@/lib/crypto/marginCsv";
import type { CryptoMarginTradeRepository } from "@/lib/repositories/cryptoMarginTradeRepository";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";

export interface ImportCryptoMarginCsvInput {
  year: number;
  csvText: string;
  fileName: string;
  exchangeName: string | null;
  mapping: MarginCsvMapping;
}

export interface ImportCryptoMarginCsvResult {
  importedRowCount: number;
  skippedRowCount: number;
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function importCryptoMarginCsvCore(
  taxYearRepository: TaxYearRepository,
  cryptoMarginTradeRepository: CryptoMarginTradeRepository,
  input: ImportCryptoMarginCsvInput,
): Promise<ImportCryptoMarginCsvResult> {
  const { year, csvText, fileName, exchangeName, mapping } = input;

  const { rows, skippedRows } = parseCryptoMarginCsv(csvText, mapping);

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);

  await cryptoMarginTradeRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: "crypto_margin_csv",
    fileName,
    rows: rows.map((row) => ({
      settledAt: row.settledAt,
      symbol: row.symbol,
      realizedPnlJpy: row.realizedPnlJpy.toString(),
      feeJpy: row.feeJpy.toString(),
      swapJpy: row.swapJpy.toString(),
      exchange: exchangeName,
      source: "crypto_margin_csv:manual",
    })),
  });

  const redirectTo =
    skippedRows.length > 0
      ? `/import?year=${year}&tab=cryptoMargin&imported=${rows.length}&skipped=${skippedRows.length}`
      : `/import?year=${year}&tab=cryptoMargin&imported=${rows.length}`;

  return {
    importedRowCount: rows.length,
    skippedRowCount: skippedRows.length,
    redirectTo,
  };
}
