// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `distributionAdjustedForeignTaxCreditActions.standalone.ts`に差し替えられ、
// このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d。
// `@/lib/mortgageDeductionActions`・`@/lib/childRearingRenovationDeductionActions`・
// `@/lib/energySavingRenovationDeductionActions`と同種のパターン)。
//
// `saveDistributionAdjustedForeignTaxCreditRecord`/
// `deleteDistributionAdjustedForeignTaxCreditRecord`は
// `/distribution-adjusted-foreign-tax-credit`
// (`DistributionAdjustedForeignTaxCreditForm.tsx`)から呼ばれるServer Actionで、
// 呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを経由する
// ことで、スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。
export {
  saveDistributionAdjustedForeignTaxCreditRecord,
  deleteDistributionAdjustedForeignTaxCreditRecord,
} from "@/app/actions";
