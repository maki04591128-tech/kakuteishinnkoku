// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`cryptoCostMethodActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d。
// `@/lib/authUi`・`@/lib/exportUi`と同種のパターン)。
//
// `setCryptoCostMethod`は暗号資産の評価方法(総平均法/移動平均法)を切り替える
// Server Actionで、トップページ(`src/app/page.tsx`)・`/import`
// (`src/app/import/page.tsx`)の2画面から共通して呼ばれる。各呼び出し元は
// `@/app/actions`から直接importする代わりにこのモジュールを経由することで、
// スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。
export { setCryptoCostMethod } from "@/app/actions";
