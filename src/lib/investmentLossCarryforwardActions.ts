// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `investmentLossCarryforwardActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-32。`@/lib/futuresLossCarryforwardActions`と
// 同種のパターン)。
//
// `carryForwardInvestmentLoss`/`setLossCarryforward`/`deleteLossCarryforward`は
// いずれも`import/page.tsx`からのみ呼ばれるServer Actionで、呼び出し元は
// `@/app/actions`から直接importする代わりにこのモジュールを経由することで、
// スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、`output: "export"`
// 非対応)をimportグラフから切り離せる。(`setLossCarryforward`/
// `deleteLossCarryforward`はフェーズ5-1-3d-33で追加)
export {
  carryForwardInvestmentLoss,
  setLossCarryforward,
  deleteLossCarryforward,
} from "@/app/actions";
