// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `certifiedHousingConstructionCreditActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d。`@/lib/residentTaxAdjustmentDeductionActions`と
// 同種のパターン)。
//
// `saveCertifiedHousingConstructionCreditRecord`/
// `deleteCertifiedHousingConstructionCreditRecord`/
// `carryForwardCertifiedHousingConstructionCreditExcess`/
// `applyCertifiedHousingConstructionCreditCarryforward`/
// `deleteCertifiedHousingConstructionCreditCarryforward`は
// `/certified-housing-construction-credit`
// (`CertifiedHousingConstructionCreditForm.tsx`・`page.tsx`)から呼ばれるServer Actionで、
// 呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを経由することで、
// スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、`output: "export"`
// 非対応)をimportグラフから切り離せる。
export {
  saveCertifiedHousingConstructionCreditRecord,
  deleteCertifiedHousingConstructionCreditRecord,
  carryForwardCertifiedHousingConstructionCreditExcess,
  applyCertifiedHousingConstructionCreditCarryforward,
  deleteCertifiedHousingConstructionCreditCarryforward,
} from "@/app/actions";
