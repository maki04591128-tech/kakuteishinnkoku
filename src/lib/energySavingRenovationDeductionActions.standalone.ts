// スタンドアロン版ビルド用の`@/lib/energySavingRenovationDeductionActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d。
// `@/lib/childRearingRenovationDeductionActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の
// `saveEnergySavingRenovationDeductionRecord`/
// `deleteEnergySavingRenovationDeductionRecord`(Server Action)をそのまま再
// エクスポートするが、`src/app/actions.ts`は`"use server"`ディレクティブを持ち
// `output: "export"`の静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の
// `EnergySavingRenovationDeductionForm.tsx`(`"use client"`コンポーネント)から見た
// 関数シグネチャ(`(formData: FormData) => Promise<void>`、
// `<form action={...}>`にそのまま渡せる)を変えずに、フェーズ3で抽出済みの
// コア関数(`saveEnergySavingRenovationDeductionRecordCore`/
// `deleteEnergySavingRenovationDeductionRecordCore`)を直接呼び出す実装に差し替える。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内関数呼び出しになる)。
//
// これらのコア関数が依存する`TaxYearRepository`/
// `EnergySavingRenovationDeductionRecordRepository`は5-1-3bのビルドターゲット
// 切り替え機構(`defaultTaxYearRepository`/
// `defaultEnergySavingRenovationDeductionRecordRepository`)経由で参照するため、
// このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない
// (スタンドアロンビルドでは自動的にクライアント実装側に解決される。ただし現時点では
// ブラウザ向けOPFS実装が未結線のプレースホルダーのため、実際に呼び出すと
// 「未結線です」エラーになる。5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版
// では使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版には
// そもそも存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の
// 画面遷移は`useRouter`等のフックに依存せずに済むよう、この関数内で
// `window.location.href`によるフルリロード遷移で代替する。
import {
  saveEnergySavingRenovationDeductionRecordCore,
  deleteEnergySavingRenovationDeductionRecordCore,
} from "@/lib/actions/energySavingRenovationDeductionRecord";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { energySavingRenovationDeductionRecordRepository } from "@/lib/repositories/defaultEnergySavingRenovationDeductionRecordRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function saveEnergySavingRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const { redirectTo } = await saveEnergySavingRenovationDeductionRecordCore(
    taxYearRepository,
    energySavingRenovationDeductionRecordRepository,
    { year, creditJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteEnergySavingRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteEnergySavingRenovationDeductionRecordCore(
    taxYearRepository,
    energySavingRenovationDeductionRecordRepository,
    { year },
  );

  window.location.href = redirectTo;
}
