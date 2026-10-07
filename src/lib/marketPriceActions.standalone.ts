// スタンドアロン版ビルド用の`@/lib/marketPriceActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d。
// `@/lib/brokerAnnualReportActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`setMarketPrice`/`deleteMarketPrice`
// (Server Action)をそのまま再エクスポートするが、`src/app/actions.ts`は
// `"use server"`ディレクティブを持ち`output: "export"`の静的ビルドでは使えない
// (5-1-3a参照)。そのため呼び出し元の`import/page.tsx`から見た関数シグネチャ
// (`(formData: FormData) => Promise<void>`、`<form action={...}>`にそのまま渡せる)を
// 変えずに、フェーズ3で抽出済みのコア関数(`setMarketPriceCore`/
// `deleteMarketPriceCore`)を直接呼び出す実装に差し替える。呼び出し元は
// `page.tsx`(Server Component)だが、スタンドアロン版では画面全体を
// `"use client"`に差し替える想定のため、この関数自体に`"use server"`を付けない
// (自宅サーバー版と違いRPCを経由しない、ただのブラウザ内関数呼び出しになる)。
//
// このコア関数が依存する`MarketPriceRepository`は5-1-3bのビルドターゲット
// 切り替え機構(`defaultMarketPriceRepository`)経由で参照するため、このファイル
// 自体はPrisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
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
  setMarketPriceCore,
  deleteMarketPriceCore,
} from "@/lib/actions/marketPrice";
import { marketPriceRepository } from "@/lib/repositories/defaultMarketPriceRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function setMarketPrice(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const symbol = requireString(formData, "symbol");
  const priceJpy = requireString(formData, "priceJpy");

  const { redirectTo } = await setMarketPriceCore(marketPriceRepository, {
    year,
    symbol,
    priceJpy,
  });

  window.location.href = redirectTo;
}

export async function deleteMarketPrice(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteMarketPriceCore(marketPriceRepository, {
    id,
    year,
  });

  window.location.href = redirectTo;
}
