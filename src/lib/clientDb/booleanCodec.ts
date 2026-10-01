/**
 * フェーズ2-27: Boolean値をクライアントサイドDB(wa-sqlite)に保存・復元する
 * 際の型変換方式。
 *
 * SQLiteには`BOOLEAN`型の実体が無く、列は単にNUMERIC型affinityが付くだけ
 * (`decimalCodec.ts`のDecimal列と同じ事情)。本アプリでは列をINTEGERとして
 * 宣言し、`true`を1、`false`を0として保存する。wa-sqlite(`sqlite.ts`)は
 * INTEGER列をJSのnumber型で返すため、復元時は`=== 1`で判定する。
 */
export function encodeBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function decodeBoolean(value: number): boolean {
  return value === 1;
}
