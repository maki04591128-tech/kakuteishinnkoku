/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.openingBalanceByInstitution`を
 * 呼んでいた処理をこのインターフェース経由に置き換える。挙動は既存の
 * Prisma実装と完全に一致させる。
 * フェーズ2-28でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientOpeningBalanceByInstitutionRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaOpeningBalanceByInstitutionRepository`(フェーズ
 * 5-1-3bで`openingBalanceByInstitutionRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離し
 * スタンドアロン版バンドルに引き込まれないようにする)を使う。ビルドターゲットに
 * 応じたどちらを使うかの既定の切り替えは`defaultOpeningBalanceByInstitutionRepository.ts`/
 * `defaultOpeningBalanceByInstitutionRepository.standalone.ts`が担う。
 *
 * `quantity`の型(`OpeningBalanceByInstitution`の`Decimal`)は`@prisma/client`の
 * 値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する
 * (`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type {
  OpeningBalanceAssetClass,
  OpeningBalanceByInstitution,
} from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface OpeningBalanceByInstitutionRepository {
  findByTaxYearId(
    taxYearId: number,
  ): Promise<OpeningBalanceByInstitution[]>;
  upsert(params: {
    taxYearId: number;
    assetClass: OpeningBalanceAssetClass;
    symbol: string;
    institution: string;
    quantity: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
}

function rowToOpeningBalanceByInstitution(
  row: Record<string, SqlValue>,
): OpeningBalanceByInstitution {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    assetClass: String(row.asset_class) as OpeningBalanceAssetClass,
    symbol: String(row.symbol),
    institution: String(row.institution),
    quantity: decodeDecimal(String(row.quantity)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-28)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientOpeningBalanceByInstitutionRepository(
  db: ClientDb,
): OpeningBalanceByInstitutionRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<OpeningBalanceByInstitution[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, asset_class, symbol, institution,
                quantity, created_at, updated_at
         FROM opening_balance_by_institution
         WHERE tax_year_id = ? ORDER BY asset_class, symbol, institution`,
        [taxYearId],
      );
      return rows.map(rowToOpeningBalanceByInstitution);
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      institution,
      quantity,
    }): Promise<void> {
      const now = new Date().toISOString();
      const encodedQuantity = encodeDecimal(new Decimal(quantity));
      await db.run(
        `INSERT INTO opening_balance_by_institution
           (tax_year_id, asset_class, symbol, institution,
            quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, asset_class, symbol, institution) DO UPDATE SET
           quantity = excluded.quantity,
           updated_at = excluded.updated_at`,
        [taxYearId, assetClass, symbol, institution, encodedQuantity, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM opening_balance_by_institution WHERE id = ?`, [
        id,
      ]);
    },
  };
}
