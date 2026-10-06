// スタンドアロン版ビルド用の`@/lib/incomeDeductionActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d)。
//
// 自宅サーバー版は`src/app/actions.ts`の`saveIncomeDeduction`/
// `deleteIncomeDeduction`(Server Action)をそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の15の控除試算画面
// (`src/app/*/*Form.tsx`、いずれも`"use client"`コンポーネント)から見た
// 関数シグネチャ(`(formData: FormData) => Promise<void>`、`<form action={...}>`に
// そのまま渡せる)を変えずに、フェーズ3で抽出済みのコア関数
// (`saveIncomeDeductionCore`/`deleteIncomeDeductionCore`)を直接呼び出す実装に
// 差し替える。呼び出し元が`"use client"`コンポーネントであるため、この関数自体に
// `"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内
// 関数呼び出しになる)。
//
// これらのコア関数が依存する`TaxYearRepository`/`IncomeDeductionRepository`は
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`/
// `defaultIncomeDeductionRepository`)経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアント実装側に解決される。ただし現時点ではブラウザ向けOPFS実装が
// 未結線のプレースホルダーのため、実際に呼び出すと「未結線です」エラーになる。
// 5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版
// では使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版には
// そもそも存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の
// 画面遷移は`useRouter`等のフックに依存せずに済むよう、この関数内で
// `window.location.href`によるフルリロード遷移で代替する(スタンドアロン版は
// クライアントのみで完結する静的SPAのため、遷移のたびに最新のクライアントDBの
// 内容で画面を再構築するフルリロードで問題ない)。
import {
  saveIncomeDeductionCore,
  deleteIncomeDeductionCore,
} from "@/lib/actions/incomeDeductionRecord";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { incomeDeductionRepository } from "@/lib/repositories/defaultIncomeDeductionRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function saveIncomeDeduction(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const type = requireString(formData, "type");
  const incomeTaxAmountJpy = requireString(formData, "incomeTaxAmountJpy");
  const residentTaxAmountJpy = requireString(formData, "residentTaxAmountJpy");
  const redirectPath = requireString(formData, "redirectPath");

  const { redirectTo } = await saveIncomeDeductionCore(
    taxYearRepository,
    incomeDeductionRepository,
    { year, type, incomeTaxAmountJpy, residentTaxAmountJpy, redirectPath },
  );

  window.location.href = redirectTo;
}

export async function deleteIncomeDeduction(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const type = requireString(formData, "type");
  const redirectPath = requireString(formData, "redirectPath");

  const { redirectTo } = await deleteIncomeDeductionCore(
    taxYearRepository,
    incomeDeductionRepository,
    { year, type, redirectPath },
  );

  window.location.href = redirectTo;
}
