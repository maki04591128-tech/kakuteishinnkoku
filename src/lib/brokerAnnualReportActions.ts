// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `brokerAnnualReportActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-19。`@/lib/homeReplacementLossCarryforwardActions`
// と同種のパターン)。
//
// `setBrokerAnnualReport`は`/import`(`AnnualReportTextImportForm.tsx`)から
// 呼ばれるServer Actionで、呼び出し元は`@/app/actions`から直接importする代わりに
// このモジュールを経由することで、スタンドアロン版ビルドでは`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)をimportグラフから切り離せる。
export { setBrokerAnnualReport } from "@/app/actions";
