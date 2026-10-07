// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `brokerAnnualReportActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-19。`@/lib/homeReplacementLossCarryforwardActions`
// と同種のパターン)。
//
// `setBrokerAnnualReport`は`/import`(`AnnualReportTextImportForm.tsx`・
// `import/page.tsx`自身)から、`deleteBrokerAnnualReport`は`import/page.tsx`
// から呼ばれるServer Actionで、呼び出し元は`@/app/actions`から直接importする
// 代わりにこのモジュールを経由することで、スタンドアロン版ビルドでは
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)を
// importグラフから切り離せる(5-1-3d-22で`deleteBrokerAnnualReport`を追加)。
export { setBrokerAnnualReport, deleteBrokerAnnualReport } from "@/app/actions";
