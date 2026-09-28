/**
 * フェーズ0-3: Decimal.jsの値をクライアントサイドDB(wa-sqlite)に
 * 保存・復元する際の型変換方式。
 *
 * SQLiteには`DECIMAL`型の実体が無く、`DECIMAL`と宣言した列は単に
 * NUMERIC型affinityが付くだけで、実際の格納形式は挿入された値の型に従う。
 * 現行の自宅サーバー版(Prisma+SQLite)で実際にどう格納されているか
 * (`prisma/schema.prisma`のDecimal列)を検証したところ、Prismaのクエリ
 * エンジンはDecimal値を素のJS数値(IEEE754倍精度浮動小数点)としてバインド
 * しており、SQLite側もREAL(浮動小数点)として格納していた。
 * 例: `new Decimal("0.123456789012345678")`を保存して読み戻すと
 * `0.12345678901234568`になり、17桁を超える有効数字が失われる。
 * これは本アプリが`decimal.js`を採用した理由(金額計算を浮動小数点誤差
 * なく行う)と矛盾するため、クライアントDBでは同じ方式を踏襲しない。
 *
 * 採用する方式: クライアントDB側の列は`TEXT`とし、
 * `Decimal.prototype.toFixed()`(引数無し)で指数表記を使わない文字列化
 * を行って保存し、復元時は`new Decimal(text)`でそのまま復元する。
 * 文字列化・復元のいずれも情報の欠落が無く、有効数字の桁数に関わらず
 * 元の値と厳密に一致する。
 */
import Decimal from "decimal.js";

export function encodeDecimal(value: Decimal): string {
  return value.toFixed();
}

export function decodeDecimal(text: string): Decimal {
  return new Decimal(text);
}

export function encodeNullableDecimal(value: Decimal | null): string | null {
  return value === null ? null : encodeDecimal(value);
}

export function decodeNullableDecimal(text: string | null): Decimal | null {
  return text === null ? null : decodeDecimal(text);
}
