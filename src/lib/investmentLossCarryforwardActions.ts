// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `investmentLossCarryforwardActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-32。`@/lib/futuresLossCarryforwardActions`と
// 同種のパターン)。
//
// `carryForwardInvestmentLoss`は`import/page.tsx`からのみ呼ばれるServer Actionで、
// 呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを経由することで、
// スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、`output: "export"`
// 非対応)をimportグラフから切り離せる。(`setLossCarryforward`/
// `deleteLossCarryforward`は本ステップの対象外で、残り24個の対象として未移行のまま
// `@/app/actions`からの直接importで残っている)
export { carryForwardInvestmentLoss } from "@/app/actions";
