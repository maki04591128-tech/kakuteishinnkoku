// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `deleteAssetBalanceImportBatchActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d。`@/lib/cryptoCostMethodActions`等と同種の
// パターン)。
//
// `deleteAssetBalanceImportBatch`は資産残高CSVインポートバッチを削除するServer
// Actionで、`/import`(`src/app/import/page.tsx`)の1画面のみが使う。
export { deleteAssetBalanceImportBatch } from "@/app/actions";
