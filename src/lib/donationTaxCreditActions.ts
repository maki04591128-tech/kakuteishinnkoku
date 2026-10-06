// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`donationTaxCreditActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d。
// `@/lib/earthquakeRenovationDeductionActions`と同種のパターン)。
//
// `saveDonationTaxCreditRecord`/`deleteDonationTaxCreditRecord`は
// `/donation-tax-credit`(`DonationTaxCreditForm.tsx`)から呼ばれるServer Actionで、
// 呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを経由する
// ことで、スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。
export { saveDonationTaxCreditRecord, deleteDonationTaxCreditRecord } from "@/app/actions";
