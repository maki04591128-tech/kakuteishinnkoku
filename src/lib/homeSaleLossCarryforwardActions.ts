// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `homeSaleLossCarryforwardActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-17・5-1-3d-37。
// `@/lib/casualtyLossCarryforwardActions`と同種のパターン)。
//
// `carryForwardHomeSaleLossExcess`は`/home-sale-loss-deduction`
// (`HomeSaleLossDeductionForm.tsx`)、`setHomeSaleLossCarryforward`/
// `deleteHomeSaleLossCarryforward`は`/import`(`import/page.tsx`)から呼ばれる
// Server Actionで、呼び出し元は`@/app/actions`から直接importする代わりにこの
// モジュールを経由することで、スタンドアロン版ビルドでは`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)をimportグラフから切り離せる。
export {
  carryForwardHomeSaleLossExcess,
  setHomeSaleLossCarryforward,
  deleteHomeSaleLossCarryforward,
} from "@/app/actions";
