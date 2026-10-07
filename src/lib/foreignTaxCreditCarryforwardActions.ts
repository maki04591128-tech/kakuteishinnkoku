// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `foreignTaxCreditCarryforwardActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-31。`@/lib/futuresLossCarryforwardActions`と
// 同種のパターン)。
//
// `setForeignTaxCreditCarryforward`/`deleteForeignTaxCreditCarryforward`は
// `import/page.tsx`からのみ呼ばれるServer Actionで、呼び出し元は`@/app/actions`から
// 直接importする代わりにこのモジュールを経由することで、スタンドアロン版ビルドでは
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)を
// importグラフから切り離せる。
export {
  setForeignTaxCreditCarryforward,
  deleteForeignTaxCreditCarryforward,
} from "@/app/actions";
