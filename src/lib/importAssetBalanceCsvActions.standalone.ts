// スタンドアロン版ビルド用の`@/lib/importAssetBalanceCsvActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d)。
//
// 自宅サーバー版は`src/app/actions.ts`の`importAssetBalanceCsv`(Server
// Action)をそのまま再エクスポートするが、`src/app/actions.ts`は`"use server"`
// ディレクティブを持ち`output: "export"`の静的ビルドでは使えない(5-1-3a参照)。
// そのため呼び出し元(`/import`)の`<form action={...}>`にそのまま渡せる関数
// シグネチャ(`(formData: FormData) => Promise<void>`)を変えずに、本ステップ
// (5-1-3d-40)で抽出したコア関数(`importAssetBalanceCsvCore`)を直接呼び出す実装に
// 差し替える。呼び出し元は`"use client"`コンポーネントのため、この関数自体に
// `"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内
// 関数呼び出しになる)。文字コード変換(`decodeCsvFile`。Shift_JIS対応)は
// `File`(ブラウザAPI)に依存する部分のためこのラッパー側で行い、コア関数自体は
// デコード済みのCSV文字列を受け取る。
//
// このコア関数が依存する`TaxYearRepository`/`AssetBalanceSnapshotRepository`は
// いずれも5-1-3bのビルドターゲット切り替え機構経由で参照するため、このファイル
// 自体はPrisma/クライアントDBどちらの実装かを意識しない。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン
// 版では使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版には
// そもそも存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の
// 画面遷移は`useRouter`等のフックに依存せずに済むよう、この関数内で
// `window.location.href`によるフルリロード遷移で代替する。
import type { AssetBalanceCsvMapping } from "@/lib/moneyforward/parseAssetBalance";
import { importAssetBalanceCsvCore } from "@/lib/actions/importAssetBalanceCsv";
import { decodeCsvFile } from "@/lib/csv";
import { assetBalanceSnapshotRepository } from "@/lib/repositories/defaultAssetBalanceSnapshotRepository";
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
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

export async function importAssetBalanceCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const csvText = await decodeCsvFile(file);
  const mapping: AssetBalanceCsvMapping = {
    institutionColumn: requireString(formData, "institutionColumn"),
    assetNameColumn: requireString(formData, "assetNameColumn"),
    balanceColumn: requireString(formData, "balanceColumn"),
    dateColumn: optionalString(formData, "dateColumn") ?? undefined,
    categoryColumn: optionalString(formData, "categoryColumn") ?? undefined,
    quantityColumn: optionalString(formData, "quantityColumn") ?? undefined,
  };

  const { redirectTo } = await importAssetBalanceCsvCore(
    taxYearRepository,
    assetBalanceSnapshotRepository,
    { year, fileName: file.name, csvText, mapping },
  );

  window.location.href = redirectTo;
}
