// スタンドアロン版ビルド用の`@/lib/assetSymbolMappingActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-21。
// `@/lib/marketPriceActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`setAssetSymbolMapping`/
// `deleteAssetSymbolMapping`(Server Action)をそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の`import/page.tsx`から
// 見た関数シグネチャ(`(formData: FormData) => Promise<void>`、
// `<form action={...}>`にそのまま渡せる)を変えずに、フェーズ3で抽出済みのコア関数
// (`setAssetSymbolMappingCore`/`deleteAssetSymbolMappingCore`)を直接呼び出す
// 実装に差し替える。呼び出し元の`page.tsx`(Server Component)は、スタンドアロン版
// では画面全体を`"use client"`に差し替える想定のため、この関数自体に
// `"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内
// 関数呼び出しになる)。
//
// このコア関数が依存する`AssetSymbolMappingRepository`は5-1-3bのビルドターゲット
// 切り替え機構(`defaultAssetSymbolMappingRepository`)経由で参照するため、この
// ファイル自体はPrisma/クライアントDBどちらの実装かを意識しない(スタンドアロン
// ビルドでは自動的にクライアント実装側に解決される。ただし現時点ではブラウザ向け
// OPFS実装が未結線のプレースホルダーのため、実際に呼び出すと「未結線です」
// エラーになる。5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  setAssetSymbolMappingCore,
  deleteAssetSymbolMappingCore,
} from "@/lib/actions/assetSymbolMapping";
import { assetSymbolMappingRepository } from "@/lib/repositories/defaultAssetSymbolMappingRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function setAssetSymbolMapping(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const assetName = requireString(formData, "assetName");
  const symbol = requireString(formData, "symbol");

  const { redirectTo } = await setAssetSymbolMappingCore(assetSymbolMappingRepository, {
    year,
    assetName,
    symbol,
  });

  window.location.href = redirectTo;
}

export async function deleteAssetSymbolMapping(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteAssetSymbolMappingCore(assetSymbolMappingRepository, {
    id,
    year,
  });

  window.location.href = redirectTo;
}
