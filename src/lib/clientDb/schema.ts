/**
 * スタンドアロン(Android)版のクライアントサイドDBスキーマ(フェーズ2)。
 *
 * `prisma/schema.prisma`の各モデルに対応するCREATE TABLE文を、フェーズ1の
 * リポジトリインターフェースを1つ実装するたびにここへ追加していく。列名は
 * Prismaスキーマのフィールド名をsnake_caseにしたもの、Decimal相当の列は
 * フェーズ0-3で決定した通りTEXT型(`decimalCodec.ts`で変換)とする。
 */
import type { ClientDb } from "./sqlite";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tax_year (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL UNIQUE,
    crypto_cost_method TEXT NOT NULL DEFAULT 'AVERAGE',
    created_at TEXT NOT NULL
  )`,
];

/** 未作成のテーブルを作成する(既存テーブルには影響しない)。 */
export async function applyClientDbSchema(db: ClientDb): Promise<void> {
  for (const statement of STATEMENTS) {
    await db.run(statement);
  }
}
