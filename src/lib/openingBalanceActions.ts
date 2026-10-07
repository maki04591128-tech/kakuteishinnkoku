// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`openingBalanceActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d-32。
// `@/lib/futuresLossCarryforwardActions`と同種のパターン)。
//
// `carryForwardOpeningBalances`/`setOpeningBalance`/`deleteOpeningBalance`は
// `import/page.tsx`からのみ呼ばれるServer Actionで、呼び出し元は`@/app/actions`から
// 直接importする代わりにこのモジュールを経由することで、スタンドアロン版ビルドでは
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)をimportグラフ
// から切り離せる。(`setOpeningBalance`/`deleteOpeningBalance`はフェーズ5-1-3d-35で追加)
export {
  carryForwardOpeningBalances,
  setOpeningBalance,
  deleteOpeningBalance,
} from "@/app/actions";
