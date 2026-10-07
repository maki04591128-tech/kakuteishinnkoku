// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`assetSymbolMappingActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d。
// `@/lib/marketPriceActions`と同種のパターン)。
//
// `setAssetSymbolMapping`/`deleteAssetSymbolMapping`は`/import`
// (`import/page.tsx`)から呼ばれるServer Actionで、呼び出し元は`@/app/actions`から
// 直接importする代わりにこのモジュールを経由することで、スタンドアロン版ビルドでは
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)をimportグラフから
// 切り離せる。
export { setAssetSymbolMapping, deleteAssetSymbolMapping } from "@/app/actions";
