// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `angelTaxLossCarryforwardActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-15。`@/lib/casualtyLossCarryforwardActions`
// と同種のパターン)。
//
// `setAngelTaxLossCarryforward`/`deleteAngelTaxLossCarryforward`は
// `/angel-tax-loss-carryforward`(`page.tsx`)から呼ばれるServer Actionで、
// 呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを経由する
// ことで、スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。
export { setAngelTaxLossCarryforward, deleteAngelTaxLossCarryforward } from "@/app/actions";
