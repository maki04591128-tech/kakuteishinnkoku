// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `importAssetBalanceCsvActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d。`@/lib/deleteAssetBalanceImportBatchActions`
// 等と同種のパターン)。
//
// `importAssetBalanceCsv`は資産残高CSV(マネーフォワード ME等)を取り込むServer
// Actionで、`/import`(`src/app/import/page.tsx`)の1画面のみが使う。
export { importAssetBalanceCsv } from "@/app/actions";
