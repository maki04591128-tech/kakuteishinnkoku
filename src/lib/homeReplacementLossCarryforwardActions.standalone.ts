// スタンドアロン版ビルド用の`@/lib/homeReplacementLossCarryforwardActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-18・5-1-3d-37。
// `@/lib/homeSaleLossCarryforwardActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の`carryForwardHomeReplacementLossExcess`/
// `setHomeReplacementLossCarryforward`/`deleteHomeReplacementLossCarryforward`
// (Server Action)をそのまま再エクスポートするが、`src/app/actions.ts`は
// `"use server"`ディレクティブを持ち`output: "export"`の静的ビルドでは使えない
// (5-1-3a参照)。そのため呼び出し元の`HomeReplacementLossDeductionForm.tsx`/
// `import/page.tsx`(いずれも`"use client"`コンポーネント)から見た関数シグネチャ
// (`(formData: FormData) => Promise<void>`、`<form action={...}>`にそのまま
// 渡せる)を変えずに、フェーズ3で抽出済みのコア関数
// (`carryForwardHomeReplacementLossExcessCore`/`setHomeReplacementLossCarryforwardCore`/
// `deleteHomeReplacementLossCarryforwardCore`)を直接呼び出す実装に差し替える。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内関数呼び出しになる)。
//
// このコア関数が依存する`TaxYearRepository`/
// `HomeReplacementLossCarryforwardRepository`は5-1-3bのビルドターゲット切り替え機構
// (`defaultTaxYearRepository`/`defaultHomeReplacementLossCarryforwardRepository`)
// 経由で参照するため、このファイル自体はPrisma/クライアントDBどちらの実装かを
// 意識しない(スタンドアロンビルドでは自動的にクライアント実装側に解決される。
// ただし現時点ではブラウザ向けOPFS実装が未結線のプレースホルダーのため、実際に
// 呼び出すと「未結線です」エラーになる。5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  carryForwardHomeReplacementLossExcessCore,
  setHomeReplacementLossCarryforwardCore,
  deleteHomeReplacementLossCarryforwardCore,
} from "@/lib/actions/homeReplacementLossCarryforward";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { homeReplacementLossCarryforwardRepository } from "@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function carryForwardHomeReplacementLossExcess(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "carryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const { redirectTo } = await carryForwardHomeReplacementLossExcessCore(
    taxYearRepository,
    homeReplacementLossCarryforwardRepository,
    { year, entries },
  );

  window.location.href = redirectTo;
}

export async function setHomeReplacementLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setHomeReplacementLossCarryforwardCore(
    taxYearRepository,
    homeReplacementLossCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteHomeReplacementLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteHomeReplacementLossCarryforwardCore(
    homeReplacementLossCarryforwardRepository,
    { id, year },
  );

  window.location.href = redirectTo;
}
