// スタンドアロン版ビルド用の`@/lib/certifiedHousingConstructionCreditActions`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d。
// `@/lib/residentTaxAdjustmentDeductionActions.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`src/app/actions.ts`の5つのServer Actionをそのまま再エクスポートするが、
// `src/app/actions.ts`は`"use server"`ディレクティブを持ち`output: "export"`の
// 静的ビルドでは使えない(5-1-3a参照)。そのため呼び出し元の
// `CertifiedHousingConstructionCreditForm.tsx`/`page.tsx`から見た関数シグネチャ
// (`(formData: FormData) => Promise<void>`、`<form action={...}>`にそのまま渡せる)を
// 変えずに、フェーズ3で抽出済みのコア関数
// (`saveCertifiedHousingConstructionCreditRecordCore`/
// `deleteCertifiedHousingConstructionCreditRecordCore`/
// `carryForwardCertifiedHousingConstructionCreditExcessCore`/
// `applyCertifiedHousingConstructionCreditCarryforwardCore`/
// `deleteCertifiedHousingConstructionCreditCarryforwardCore`)を直接呼び出す実装に
// 差し替える。呼び出し元が`"use client"`コンポーネントであるため、この関数自体に
// `"use server"`を付けない(自宅サーバー版と違いRPCを経由しない、ただのブラウザ内関数
// 呼び出しになる)。
//
// これらのコア関数が依存する`TaxYearRepository`/
// `CertifiedHousingConstructionCreditRecordRepository`/
// `CertifiedHousingConstructionCreditCarryforwardRepository`は5-1-3bのビルドターゲット
// 切り替え機構(`defaultTaxYearRepository`/
// `defaultCertifiedHousingConstructionCreditRecordRepository`/
// `defaultCertifiedHousingConstructionCreditCarryforwardRepository`)経由で参照するため、
// このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない(スタンドアロン
// ビルドでは自動的にクライアント実装側に解決される。ただし現時点ではブラウザ向けOPFS
// 実装が未結線のプレースホルダーのため、実際に呼び出すと「未結線です」エラーになる。
// 5-1-3b参照)。
//
// Server Actionの`redirect()`/`revalidatePath()`はサーバー無しのスタンドアロン版では
// 使えない。`revalidatePath`相当のキャッシュ再検証はスタンドアロン版にはそもそも
// 存在せず(ページは毎回クライアントDBを読み直す想定)、`redirect`相当の画面遷移は
// `useRouter`等のフックに依存せずに済むよう、この関数内で`window.location.href`による
// フルリロード遷移で代替する。
import {
  saveCertifiedHousingConstructionCreditRecordCore,
  deleteCertifiedHousingConstructionCreditRecordCore,
} from "@/lib/actions/certifiedHousingConstructionCreditRecord";
import {
  carryForwardCertifiedHousingConstructionCreditExcessCore,
  applyCertifiedHousingConstructionCreditCarryforwardCore,
  deleteCertifiedHousingConstructionCreditCarryforwardCore,
} from "@/lib/actions/certifiedHousingConstructionCreditCarryforward";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";
import { certifiedHousingConstructionCreditRecordRepository } from "@/lib/repositories/defaultCertifiedHousingConstructionCreditRecordRepository";
import { certifiedHousingConstructionCreditCarryforwardRepository } from "@/lib/repositories/defaultCertifiedHousingConstructionCreditCarryforwardRepository";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

export async function saveCertifiedHousingConstructionCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const { redirectTo } = await saveCertifiedHousingConstructionCreditRecordCore(
    taxYearRepository,
    certifiedHousingConstructionCreditRecordRepository,
    { year, creditJpy },
  );

  window.location.href = redirectTo;
}

export async function deleteCertifiedHousingConstructionCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteCertifiedHousingConstructionCreditRecordCore(
    taxYearRepository,
    certifiedHousingConstructionCreditRecordRepository,
    { year },
  );

  window.location.href = redirectTo;
}

export async function carryForwardCertifiedHousingConstructionCreditExcess(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await carryForwardCertifiedHousingConstructionCreditExcessCore(
    taxYearRepository,
    certifiedHousingConstructionCreditCarryforwardRepository,
    { year, remainingAmountJpy },
  );

  window.location.href = redirectTo;
}

export async function applyCertifiedHousingConstructionCreditCarryforward(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await applyCertifiedHousingConstructionCreditCarryforwardCore(
    taxYearRepository,
    certifiedHousingConstructionCreditRecordRepository,
    certifiedHousingConstructionCreditCarryforwardRepository,
    { year },
  );

  window.location.href = redirectTo;
}

export async function deleteCertifiedHousingConstructionCreditCarryforward(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteCertifiedHousingConstructionCreditCarryforwardCore(
    taxYearRepository,
    certifiedHousingConstructionCreditCarryforwardRepository,
    { year },
  );

  window.location.href = redirectTo;
}
