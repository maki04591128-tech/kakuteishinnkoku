/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.assetSymbolMapping`を呼んでいた
 * 処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 * フェーズ2-30でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientAssetSymbolMappingRepository`。wa-sqlite)を追加した。
 */
import type { AssetSymbolMapping } from "@prisma/client";
import { prisma } from "../db";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface AssetSymbolMappingRepository {
  findMany(): Promise<AssetSymbolMapping[]>;
  upsert(params: { assetName: string; symbol: string }): Promise<void>;
  delete(id: number): Promise<void>;
}

export function createPrismaAssetSymbolMappingRepository(): AssetSymbolMappingRepository {
  return {
    async findMany(): Promise<AssetSymbolMapping[]> {
      return prisma.assetSymbolMapping.findMany({ orderBy: { assetName: "asc" } });
    },

    async upsert({ assetName, symbol }): Promise<void> {
      await prisma.assetSymbolMapping.upsert({
        where: { assetName },
        create: { assetName, symbol },
        update: { symbol },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.assetSymbolMapping.delete({ where: { id } });
    },
  };
}

function rowToAssetSymbolMapping(row: Record<string, SqlValue>): AssetSymbolMapping {
  return {
    id: Number(row.id),
    assetName: String(row.asset_name),
    symbol: String(row.symbol),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-30)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientAssetSymbolMappingRepository(
  db: ClientDb,
): AssetSymbolMappingRepository {
  return {
    async findMany(): Promise<AssetSymbolMapping[]> {
      const rows = await db.all(
        `SELECT id, asset_name, symbol, created_at, updated_at
         FROM asset_symbol_mapping ORDER BY asset_name ASC`,
      );
      return rows.map(rowToAssetSymbolMapping);
    },

    async upsert({ assetName, symbol }): Promise<void> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO asset_symbol_mapping (asset_name, symbol, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(asset_name) DO UPDATE SET
           symbol = excluded.symbol,
           updated_at = excluded.updated_at`,
        [assetName, symbol, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM asset_symbol_mapping WHERE id = ?`, [id]);
    },
  };
}
