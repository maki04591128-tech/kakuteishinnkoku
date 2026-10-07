// スタンドアロン版ビルド用の`@/lib/deleteAssetBalanceImportBatchActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d)。
//
// 自宅サーバー版は`src/app/actions.ts`の`deleteAssetBalanceImportBatch`(Server
// Action)をそのまま再エクスポートするが、`src/app/actions.ts`は`"use server"`
// ディレクティブを持ち`output: "export"`の静的ビルドでは使えない(5-1-3a参照)。
// そのため呼び出し元(`/import`)の`<form action={...}>`にそのまま渡せる関数
// シグネチャ(`(formData: FormData) => Promise<void>`)を変えずに、フェーズ3で
// 抽出済みのコア関数(`deleteAssetBalanceImportBatchCore`)を直接呼び出す実装に
// 差し替える。呼び出し元は`"use client"`コンポーネントのため、この関数自体に
// `"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内
// 関数呼び出しになる)。
//
// このコア関数が依存する`AssetBalanceSnapshotRepository`は5-1-3bのビルド
// ターゲット切り替え機構(`defaultAssetBalanceSnapshotRepository`)経由で参照する
// ため、このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン
// 版では使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版には
// そもそも存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の
// 画面遷移は`useRouter`等のフックに依存せずに済むよう、この関数内で
// `window.location.href`によるフルリロード遷移で代替する。
import { deleteAssetBalanceImportBatchCore } from "@/lib/actions/deleteAssetBalanceImportBatch";
import { assetBalanceSnapshotRepository } from "@/lib/repositories/defaultAssetBalanceSnapshotRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function deleteAssetBalanceImportBatch(formData: FormData): Promise<void> {
  const importBatchId = Number(requireString(formData, "importBatchId"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteAssetBalanceImportBatchCore(assetBalanceSnapshotRepository, {
    importBatchId,
    year,
  });

  window.location.href = redirectTo;
}
