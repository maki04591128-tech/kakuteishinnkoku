// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`cryptoMarginTradeActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては
// "use server"の`src/app/actions.ts`全体)はビルド対象に含まれない
// (フェーズ5-1-3d-25。`@/lib/cryptoCreditTradeActions`と同種のパターン)。
//
// `addCryptoMarginTrade`/`deleteCryptoMarginTrade`は`import/page.tsx`からのみ
// 呼ばれるServer Actionで、呼び出し元は`@/app/actions`から直接importする代わりに
// このモジュールを経由することで、スタンドアロン版ビルドでは
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)を
// importグラフから切り離せる。
export { addCryptoMarginTrade, deleteCryptoMarginTrade } from "@/app/actions";
