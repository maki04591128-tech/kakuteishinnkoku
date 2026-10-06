// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `residentTaxAdjustmentDeductionActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d。`@/lib/mortgageDeductionActions`と同種の
// パターン)。
//
// `saveResidentTaxAdjustmentDeductionRecord`/`deleteResidentTaxAdjustmentDeductionRecord`は
// `/resident-tax-adjustment-deduction`(`ResidentTaxAdjustmentDeductionForm.tsx`)から
// 呼ばれるServer Actionで、呼び出し元は`@/app/actions`から直接importする代わりにこの
// モジュールを経由することで、スタンドアロン版ビルドでは`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)をimportグラフから切り離せる。
export {
  saveResidentTaxAdjustmentDeductionRecord,
  deleteResidentTaxAdjustmentDeductionRecord,
} from "@/app/actions";
