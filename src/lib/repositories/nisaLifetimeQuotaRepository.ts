/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`が直接
 * `prisma.nisaLifetimeQuota`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`・`src/app/import/page.tsx`側の`prisma.nisaLifetimeQuota`
 * 呼び出しはそれぞれの移行時に別途このリポジトリへ委譲する)
 * フェーズ2-25でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientNisaLifetimeQuotaRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaNisaLifetimeQuotaRepository`
 * (フェーズ5-1-3bで`nisaLifetimeQuotaRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは
 * `defaultNisaLifetimeQuotaRepository.ts`/
 * `defaultNisaLifetimeQuotaRepository.standalone.ts`が担う。
 *
 * `openingUsedJpy`/`soldCostBasisJpy`の型(`Decimal`)は`@prisma/client`の値のみ
 * `import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する
 * (`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { InvestmentNisaType, NisaLifetimeQuota } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface NisaLifetimeQuotaRepository {
  findByTaxYearId(taxYearId: number): Promise<NisaLifetimeQuota[]>;
  upsert(params: {
    taxYearId: number;
    nisaType: InvestmentNisaType;
    openingUsedJpy: string;
    soldCostBasisJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
  createMany(
    data: Array<{
      taxYearId: number;
      nisaType: InvestmentNisaType;
      openingUsedJpy: string;
    }>,
  ): Promise<void>;
}

function rowToNisaLifetimeQuota(row: Record<string, SqlValue>): NisaLifetimeQuota {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    nisaType: String(row.nisa_type) as InvestmentNisaType,
    openingUsedJpy: decodeDecimal(String(row.opening_used_jpy)),
    soldCostBasisJpy: decodeDecimal(String(row.sold_cost_basis_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-25)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientNisaLifetimeQuotaRepository(
  db: ClientDb,
): NisaLifetimeQuotaRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<NisaLifetimeQuota[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, nisa_type, opening_used_jpy, sold_cost_basis_jpy,
                created_at, updated_at
         FROM nisa_lifetime_quota WHERE tax_year_id = ? ORDER BY nisa_type`,
        [taxYearId],
      );
      return rows.map(rowToNisaLifetimeQuota);
    },

    async upsert({ taxYearId, nisaType, openingUsedJpy, soldCostBasisJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encodedOpening = encodeDecimal(new Decimal(openingUsedJpy));
      const encodedSoldCostBasis = encodeDecimal(new Decimal(soldCostBasisJpy));
      await db.run(
        `INSERT INTO nisa_lifetime_quota
           (tax_year_id, nisa_type, opening_used_jpy, sold_cost_basis_jpy,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, nisa_type) DO UPDATE SET
           opening_used_jpy = excluded.opening_used_jpy,
           sold_cost_basis_jpy = excluded.sold_cost_basis_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, nisaType, encodedOpening, encodedSoldCostBasis, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM nisa_lifetime_quota WHERE id = ?`, [id]);
    },

    async createMany(data): Promise<void> {
      const now = new Date().toISOString();
      for (const { taxYearId, nisaType, openingUsedJpy } of data) {
        const encodedOpening = encodeDecimal(new Decimal(openingUsedJpy));
        await db.run(
          `INSERT INTO nisa_lifetime_quota
             (tax_year_id, nisa_type, opening_used_jpy, sold_cost_basis_jpy,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [taxYearId, nisaType, encodedOpening, encodeDecimal(new Decimal(0)), now, now],
        );
      }
    },
  };
}
