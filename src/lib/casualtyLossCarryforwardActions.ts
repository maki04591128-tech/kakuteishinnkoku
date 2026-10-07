// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `casualtyLossCarryforwardActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-14・5-1-3d-30。
// `@/lib/residentTaxAdjustmentDeductionActions`と同種のパターン)。
//
// `carryForwardCasualtyLossExcess`は`/casualty-loss-deduction`
// (`CasualtyLossDeductionForm.tsx`)から、`setCasualtyLossCarryforward`/
// `deleteCasualtyLossCarryforward`は`import/page.tsx`(5-1-3d-30)から呼ばれる
// Server Actionで、呼び出し元は`@/app/actions`から直接importする代わりに
// このモジュールを経由することで、スタンドアロン版ビルドでは
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)を
// importグラフから切り離せる。
export {
  carryForwardCasualtyLossExcess,
  setCasualtyLossCarryforward,
  deleteCasualtyLossCarryforward,
} from "@/app/actions";
