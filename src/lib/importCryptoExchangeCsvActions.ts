// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `importCryptoExchangeCsvActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d。`@/lib/importBrokerAnnualReportCsvActions`
// 等と同種のパターン)。
//
// `importCryptoExchangeCsv`は暗号資産取引所の取引履歴CSVを取り込むServer
// Actionで、`/import`(`src/app/import/page.tsx`)の1画面のみが使う。
export { importCryptoExchangeCsv } from "@/app/actions";
