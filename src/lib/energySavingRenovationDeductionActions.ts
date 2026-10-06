// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `energySavingRenovationDeductionActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d。`@/lib/incomeDeductionActions`・
// `@/lib/employmentIncomeActions`・`@/lib/barrierFreeRenovationDeductionActions`・
// `@/lib/earthquakeRenovationDeductionActions`・`@/lib/donationTaxCreditActions`・
// `@/lib/mortgageDeductionActions`・`@/lib/childRearingRenovationDeductionActions`と
// 同種のパターン)。
//
// `saveEnergySavingRenovationDeductionRecord`/
// `deleteEnergySavingRenovationDeductionRecord`は
// `/energy-saving-renovation-deduction`
// (`EnergySavingRenovationDeductionForm.tsx`)から呼ばれるServer Actionで、
// 呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを経由することで、
// スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。
export {
  saveEnergySavingRenovationDeductionRecord,
  deleteEnergySavingRenovationDeductionRecord,
} from "@/app/actions";
