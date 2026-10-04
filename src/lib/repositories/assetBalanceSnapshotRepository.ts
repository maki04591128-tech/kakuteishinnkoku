/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.assetBalanceSnapshot`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-32でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientAssetBalanceSnapshotRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaAssetBalanceSnapshotRepository`
 * (フェーズ5-1-3bで`assetBalanceSnapshotRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは
 * `defaultAssetBalanceSnapshotRepository.ts`/
 * `defaultAssetBalanceSnapshotRepository.standalone.ts`が担う。
 *
 * `balanceJpy`/`quantity`の型(`Decimal`)は`@prisma/client`の値のみ
 * `import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する
 * (`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { AssetBalanceSnapshot, ImportBatch } from "@prisma/client";
import { Decimal } from "decimal.js";
import {
  decodeDecimal,
  decodeNullableDecimal,
  encodeDecimal,
  encodeNullableDecimal,
} from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface AssetBalanceSnapshotImportRow {
  snapshotDate: Date | null;
  category: string;
  institution: string;
  assetName: string;
  balanceJpy: string;
  quantity: string | null;
}

export type ImportBatchWithSnapshots = ImportBatch & {
  assetBalanceSnapshots: AssetBalanceSnapshot[];
};

export interface AssetBalanceSnapshotRepository {
  findByTaxYearId(taxYearId: number): Promise<AssetBalanceSnapshot[]>;
  findImportBatchesWithSnapshots(input: {
    taxYearId: number;
    sourceType: string;
  }): Promise<ImportBatchWithSnapshots[]>;
  importCsvBatch(input: {
    taxYearId: number;
    sourceType: string;
    fileName: string;
    rows: AssetBalanceSnapshotImportRow[];
  }): Promise<void>;
  deleteImportBatch(importBatchId: number): Promise<void>;
}

function rowToImportBatch(row: Record<string, SqlValue>): ImportBatch {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    sourceType: String(row.source_type),
    fileName: String(row.file_name),
    importedAt: new Date(String(row.imported_at)),
    rowCount: Number(row.row_count),
  };
}

function rowToAssetBalanceSnapshot(
  row: Record<string, SqlValue>,
): AssetBalanceSnapshot {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    snapshotDate: new Date(String(row.snapshot_date)),
    category: String(row.category),
    institution: String(row.institution),
    assetName: String(row.asset_name),
    balanceJpy: decodeDecimal(String(row.balance_jpy)),
    quantity: decodeNullableDecimal(
      row.quantity === null ? null : String(row.quantity),
    ),
    importBatchId:
      row.import_batch_id === null ? null : Number(row.import_batch_id),
    createdAt: new Date(String(row.created_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-32)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientAssetBalanceSnapshotRepository(
  db: ClientDb,
): AssetBalanceSnapshotRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<AssetBalanceSnapshot[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, snapshot_date, category, institution,
                asset_name, balance_jpy, quantity, import_batch_id, created_at
         FROM asset_balance_snapshot
         WHERE tax_year_id = ? ORDER BY id`,
        [taxYearId],
      );
      return rows.map(rowToAssetBalanceSnapshot);
    },

    async findImportBatchesWithSnapshots({
      taxYearId,
      sourceType,
    }): Promise<ImportBatchWithSnapshots[]> {
      const batchRows = await db.all(
        `SELECT id, tax_year_id, source_type, file_name, imported_at, row_count
         FROM import_batch
         WHERE tax_year_id = ? AND source_type = ?
         ORDER BY imported_at DESC, id DESC`,
        [taxYearId, sourceType],
      );

      const result: ImportBatchWithSnapshots[] = [];
      for (const batchRow of batchRows) {
        const batch = rowToImportBatch(batchRow);
        const snapshotRows = await db.all(
          `SELECT id, tax_year_id, snapshot_date, category, institution,
                  asset_name, balance_jpy, quantity, import_batch_id, created_at
           FROM asset_balance_snapshot
           WHERE import_batch_id = ?
           ORDER BY institution ASC, asset_name ASC`,
          [batch.id],
        );
        result.push({
          ...batch,
          assetBalanceSnapshots: snapshotRows.map(rowToAssetBalanceSnapshot),
        });
      }
      return result;
    },

    async importCsvBatch({
      taxYearId,
      sourceType,
      fileName,
      rows,
    }): Promise<void> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO import_batch (tax_year_id, source_type, file_name, imported_at, row_count)
         VALUES (?, ?, ?, ?, ?)`,
        [taxYearId, sourceType, fileName, now, rows.length],
      );
      const [{ id: rawBatchId }] = await db.all(
        `SELECT last_insert_rowid() AS id`,
      );
      const batchId = Number(rawBatchId);

      for (const row of rows) {
        await db.run(
          `INSERT INTO asset_balance_snapshot
             (tax_year_id, snapshot_date, category, institution, asset_name,
              balance_jpy, quantity, import_batch_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taxYearId,
            row.snapshotDate ? row.snapshotDate.toISOString() : now,
            row.category,
            row.institution,
            row.assetName,
            encodeDecimal(new Decimal(row.balanceJpy)),
            encodeNullableDecimal(
              row.quantity === null ? null : new Decimal(row.quantity),
            ),
            batchId,
            now,
          ],
        );
      }
    },

    async deleteImportBatch(importBatchId: number): Promise<void> {
      await db.run(`DELETE FROM asset_balance_snapshot WHERE import_batch_id = ?`, [
        importBatchId,
      ]);
      await db.run(`DELETE FROM import_batch WHERE id = ?`, [importBatchId]);
    },
  };
}
