// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `homeReplacementLossCarryforwardActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-18・5-1-3d-37。
// `@/lib/homeSaleLossCarryforwardActions`と同種のパターン)。
//
// `carryForwardHomeReplacementLossExcess`は`/home-replacement-loss-deduction`
// (`HomeReplacementLossDeductionForm.tsx`)、`setHomeReplacementLossCarryforward`/
// `deleteHomeReplacementLossCarryforward`は`/import`(`import/page.tsx`)から呼ばれる
// Server Actionで、呼び出し元は`@/app/actions`から直接importする代わりにこの
// モジュールを経由することで、スタンドアロン版ビルドでは`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)をimportグラフから切り離せる。
export {
  carryForwardHomeReplacementLossExcess,
  setHomeReplacementLossCarryforward,
  deleteHomeReplacementLossCarryforward,
} from "@/app/actions";
