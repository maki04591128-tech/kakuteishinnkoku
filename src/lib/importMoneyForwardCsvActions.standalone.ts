// スタンドアロン版ビルド用の`@/lib/importMoneyForwardCsvActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d)。
//
// 自宅サーバー版は`src/app/actions.ts`の`importMoneyForwardCsv`(Server
// Action)をそのまま再エクスポートするが、`src/app/actions.ts`は`"use server"`
// ディレクティブを持ち`output: "export"`の静的ビルドでは使えない(5-1-3a参照)。
// そのため呼び出し元(`/import`)の`<form action={...}>`にそのまま渡せる関数
// シグネチャ(`(formData: FormData) => Promise<void>`)を変えずに、本ステップ
// (5-1-3d-45)で抽出したコア関数(`importMoneyForwardCsvCore`)を直接呼び出す
// 実装に差し替える。呼び出し元は`"use client"`コンポーネントのため、この関数自体に
// `"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内
// 関数呼び出しになる)。文字コード変換(`decodeCsvFile`)はこのラッパー側で行い、
// コア関数自体はデコード済みのCSV文字列を受け取る。
//
// このコア関数が依存する`TaxYearRepository`/`CashflowEntryRepository`は
// いずれも5-1-3bのビルドターゲット切り替え機構経由で参照するため、このファイル
// 自体はPrisma/クライアントDBどちらの実装かを意識しない(`CashflowEntryRepository`
// 自体は本ステップで初めてこの機構に対応した。README「現在の最優先事項」の
// 5-1-3d-45参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン
// 版では使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版には
// そもそも存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の
// 画面遷移は`useRouter`等のフックに依存せずに済むよう、この関数内で
// `window.location.href`によるフルリロード遷移で代替する。
import { importMoneyForwardCsvCore } from "@/lib/actions/importMoneyForwardCsv";
import { decodeCsvFile } from "@/lib/csv";
import { cashflowEntryRepository } from "@/lib/repositories/defaultCashflowEntryRepository";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function importMoneyForwardCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const csvText = await decodeCsvFile(file);

  const { redirectTo } = await importMoneyForwardCsvCore(
    taxYearRepository,
    cashflowEntryRepository,
    {
      year,
      csvText,
      fileName: file.name,
    },
  );

  window.location.href = redirectTo;
}
