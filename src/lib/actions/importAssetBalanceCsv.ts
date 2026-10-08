/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`importAssetBalanceCsv`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(CSV解析・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。文字コード変換(`decodeCsvFile`、
 * `File`を受け取る)は呼び出し側(標準/スタンドアロン版双方の薄いラッパー)で行い、
 * このコア関数はデコード済みのCSV文字列を受け取ることでNode依存を無くし
 * テストしやすくしている(5-1-3d-40)。
 */
import type { AssetBalanceCsvMapping } from "@/lib/moneyforward/parseAssetBalance";
import { parseMoneyForwardAssetBalanceCsv } from "@/lib/moneyforward/parseAssetBalance";
import type { AssetBalanceSnapshotRepository } from "@/lib/repositories/assetBalanceSnapshotRepository";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";

export interface ImportAssetBalanceCsvInput {
  year: number;
  fileName: string;
  csvText: string;
  mapping: AssetBalanceCsvMapping;
}

export interface ImportAssetBalanceCsvResult {
  importedRowCount: number;
  skippedRowCount: number;
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function importAssetBalanceCsvCore(
  taxYearRepository: TaxYearRepository,
  assetBalanceSnapshotRepository: AssetBalanceSnapshotRepository,
  input: ImportAssetBalanceCsvInput,
): Promise<ImportAssetBalanceCsvResult> {
  const { year, fileName, csvText, mapping } = input;

  const { rows, skippedRows } = parseMoneyForwardAssetBalanceCsv(csvText, mapping);

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);

  await assetBalanceSnapshotRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: "moneyforward_assets",
    fileName,
    rows: rows.map((row) => ({
      snapshotDate: row.snapshotDate ?? null,
      category: row.category,
      institution: row.institution,
      assetName: row.assetName,
      balanceJpy: row.balanceJpy.toString(),
      quantity: row.quantity ? row.quantity.toString() : null,
    })),
  });

  const redirectTo =
    skippedRows.length > 0
      ? `/import?year=${year}&tab=assetBalance&imported=${rows.length}&skipped=${skippedRows.length}`
      : `/import?year=${year}&tab=assetBalance&imported=${rows.length}`;

  return {
    importedRowCount: rows.length,
    skippedRowCount: skippedRows.length,
    redirectTo,
  };
}
