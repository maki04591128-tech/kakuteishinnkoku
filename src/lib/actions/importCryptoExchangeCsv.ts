/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`importCryptoExchangeCsv`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(CSV解析・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。文字コード変換(`decodeCsvFile`、
 * `File`を受け取る)は呼び出し側(標準/スタンドアロン版双方の薄いラッパー)で行い、
 * このコア関数はデコード済みのCSV文字列を受け取ることでNode依存を無くし
 * テストしやすくしている(5-1-3d-42)。
 */
import {
  parseExchangeCsv,
  type ExchangeCsvMapping,
  type ExchangeCsvPreset,
} from "@/lib/crypto/exchangeCsv";
import type { CryptoTradeRepository } from "@/lib/repositories/cryptoTradeRepository";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";

const EXCHANGE_LABELS: Record<Exclude<ExchangeCsvPreset, "other">, string> = {
  bitflyer: "bitFlyer",
  coincheck: "Coincheck",
  gmo: "GMOコイン",
  bitbank: "bitbank",
};

function isKnownExchangeCsvPreset(
  preset: ExchangeCsvPreset,
): preset is Exclude<ExchangeCsvPreset, "other"> {
  return preset in EXCHANGE_LABELS;
}

export interface ImportCryptoExchangeCsvInput {
  year: number;
  csvText: string;
  fileName: string;
  preset: ExchangeCsvPreset;
  exchangeName: string | null;
  /** 未指定の場合はpresetによる自動解析(`parseExchangeCsv(preset, csvText)`)を使う。 */
  mapping?: ExchangeCsvMapping;
}

export interface ImportCryptoExchangeCsvResult {
  importedRowCount: number;
  skippedRowCount: number;
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function importCryptoExchangeCsvCore(
  taxYearRepository: TaxYearRepository,
  cryptoTradeRepository: CryptoTradeRepository,
  input: ImportCryptoExchangeCsvInput,
): Promise<ImportCryptoExchangeCsvResult> {
  const { year, csvText, fileName, preset, exchangeName, mapping } = input;
  const exchangeLabel =
    exchangeName ?? (isKnownExchangeCsvPreset(preset) ? EXCHANGE_LABELS[preset] : null);

  const { rows, skippedRows } = mapping
    ? parseExchangeCsv(csvText, mapping)
    : parseExchangeCsv(preset, csvText);

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);

  await cryptoTradeRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: `crypto_csv_${preset}`,
    fileName,
    rows: rows.map((row) => ({
      tradedAt: row.tradedAt,
      symbol: row.symbol,
      type: row.type,
      quantity: row.quantity.toString(),
      unitPriceJpy: row.unitPriceJpy.toString(),
      feeJpy: row.feeJpy.toString(),
      exchange: row.exchange ?? exchangeLabel,
      memo: row.memo ?? null,
      source: mapping
        ? `exchange_csv:${preset}:manual`
        : isKnownExchangeCsvPreset(preset)
          ? `exchange_csv:${preset}`
          : `exchange_csv:${preset}:auto`,
    })),
  });

  const redirectTo =
    skippedRows.length > 0
      ? `/import?year=${year}&tab=crypto&imported=${rows.length}&skipped=${skippedRows.length}`
      : `/import?year=${year}&tab=crypto&imported=${rows.length}`;

  return {
    importedRowCount: rows.length,
    skippedRowCount: skippedRows.length,
    redirectTo,
  };
}
