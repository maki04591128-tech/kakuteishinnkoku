// スタンドアロン版ビルド用の`@/lib/cryptoCreditTradeActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-24。
// `@/lib/cryptoTradeActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`addCryptoCreditTrade`/
// `deleteCryptoCreditTrade`(Server Action)をそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の`import/page.tsx`から
// 見た関数シグネチャ(`(formData: FormData) => Promise<void>`、
// `<form action={...}>`にそのまま渡せる)を変えずに、フェーズ3で抽出済みの
// コア関数(`addCryptoCreditTradeCore`/`deleteCryptoCreditTradeCore`)を
// 直接呼び出す実装に差し替える。呼び出し元が`"use client"`コンポーネントであるため、
// この関数自体に`"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、
// ただのブラウザ内関数呼び出しになる)。
//
// このコア関数が依存する`TaxYearRepository`/`CryptoCreditTradeRepository`は
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultCryptoCreditTradeRepository`)経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアント実装側に解決される。ただし現時点ではブラウザ向けOPFS実装が
// 未結線のプレースホルダーのため、実際に呼び出すと「未結線です」エラーになる。
// 5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  addCryptoCreditTradeCore,
  deleteCryptoCreditTradeCore,
} from "@/lib/actions/cryptoCreditTrade";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { cryptoCreditTradeRepository } from "@/lib/repositories/defaultCryptoCreditTradeRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

export async function addCryptoCreditTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await addCryptoCreditTradeCore(taxYearRepository, cryptoCreditTradeRepository, {
    year,
    settledAt: requireString(formData, "settledAt"),
    symbol: requireString(formData, "symbol"),
    realizedPnlJpy: requireString(formData, "realizedPnlJpy"),
    feeJpy: optionalString(formData, "feeJpy"),
    interestAdjustmentJpy: optionalString(formData, "interestAdjustmentJpy"),
    exchange: optionalString(formData, "exchange"),
    memo: optionalString(formData, "memo"),
  });

  window.location.href = redirectTo;
}

export async function deleteCryptoCreditTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteCryptoCreditTradeCore(cryptoCreditTradeRepository, {
    id,
    year,
  });

  window.location.href = redirectTo;
}
