// スタンドアロン版ビルド用の`@/lib/cryptoCostMethodActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d)。
//
// 自宅サーバー版は`src/app/actions.ts`の`setCryptoCostMethod`(Server Action)を
// そのまま再エクスポートするが、`src/app/actions.ts`は`"use server"`
// ディレクティブを持ち`output: "export"`の静的ビルドでは使えない(5-1-3a参照)。
// そのため呼び出し元の2画面(トップページ・`/import`、いずれも元の
// `setCryptoCostMethod`はServer Actionだが呼び出し側の`<form action={...}>`に
// そのまま渡せる関数シグネチャ(`(formData: FormData) => Promise<void>`)を
// 変えずに、フェーズ3で抽出済みのコア関数(`setCryptoCostMethodCore`)を直接
// 呼び出す実装に差し替える。呼び出し元はいずれも`"use client"`コンポーネント
// (トップページ側はこのフォーム部分のみクライアントコンポーネントに分離される
// 想定)のため、この関数自体に`"use server"`を付けない(自宅サーバー版と違い
// RPCを経由しない、ただのブラウザ内関数呼び出しになる)。
//
// このコア関数が依存する`TaxYearRepository`は5-1-3bのビルドターゲット
// 切り替え機構(`defaultTaxYearRepository`)経由で参照するため、このファイル
// 自体はPrisma/クライアントDBどちらの実装かを意識しない。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン
// 版では使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版には
// そもそも存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の
// 画面遷移は`useRouter`等のフックに依存せずに済むよう、この関数内で
// `window.location.href`によるフルリロード遷移で代替する。
import { setCryptoCostMethodCore } from "@/lib/actions/setCryptoCostMethod";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export async function setCryptoCostMethod(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const cryptoCostMethod = requireString(formData, "cryptoCostMethod");
  const tab = optionalString(formData, "tab");

  const { redirectTo } = await setCryptoCostMethodCore(taxYearRepository, {
    year,
    cryptoCostMethod,
    tab,
  });

  window.location.href = redirectTo;
}
