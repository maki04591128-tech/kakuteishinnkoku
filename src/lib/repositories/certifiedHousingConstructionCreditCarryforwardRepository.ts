/**
 * フェーズ1(リポジトリパターン導入): `src/lib/certifiedHousingConstructionCredit.ts`が
 * 直接`prisma.certifiedHousingConstructionCreditCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-11でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCertifiedHousingConstructionCreditCarryforwardRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaCertifiedHousingConstructionCreditCarryforwardRepository`
 * (フェーズ5-1-3bで`certifiedHousingConstructionCreditCarryforwardRepository.prisma.ts`に
 * 分離。`@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultCertifiedHousingConstructionCreditCarryforwardRepository.ts`/
 * `defaultCertifiedHousingConstructionCreditCarryforwardRepository.standalone.ts`が担う。
 *
 * `remainingAmountJpy`の型(`CertifiedHousingConstructionCreditCarryforward`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため使わない。
 * `decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { CertifiedHousingConstructionCreditCarryforward } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface CertifiedHousingConstructionCreditCarryforwardRepository {
  findByTaxYearId(
    taxYearId: number,
  ): Promise<CertifiedHousingConstructionCreditCarryforward | null>;
  upsert(params: { taxYearId: number; originYear: number; remainingAmountJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToCertifiedHousingConstructionCreditCarryforward(
  row: Record<string, SqlValue>,
): CertifiedHousingConstructionCreditCarryforward {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    originYear: Number(row.origin_year),
    remainingAmountJpy: decodeDecimal(String(row.remaining_amount_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-11)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCertifiedHousingConstructionCreditCarryforwardRepository(
  db: ClientDb,
): CertifiedHousingConstructionCreditCarryforwardRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditCarryforward | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at
         FROM certified_housing_construction_credit_carryforward WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToCertifiedHousingConstructionCreditCarryforward(row) : null;
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
      await db.run(
        `INSERT INTO certified_housing_construction_credit_carryforward
           (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           origin_year = excluded.origin_year,
           remaining_amount_jpy = excluded.remaining_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, originYear, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(
        `DELETE FROM certified_housing_construction_credit_carryforward WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
