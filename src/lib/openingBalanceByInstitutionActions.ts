// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `openingBalanceByInstitutionActions.standalone.ts`に差し替えられ、このファイル
// (と依存先の`@/app/actions`、ひいては"use server"の`src/app/actions.ts`全体)は
// ビルド対象に含まれない(フェーズ5-1-3d-32の`@/lib/futuresLossCarryforwardActions`
// と同種のパターン)。
//
// `setOpeningBalanceByInstitution`/`deleteOpeningBalanceByInstitution`は
// `import/page.tsx`からのみ呼ばれるServer Actionで、呼び出し元は`@/app/actions`から
// 直接importする代わりにこのモジュールを経由することで、スタンドアロン版ビルドでは
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)をimportグラフ
// から切り離せる。(フェーズ5-1-3d-36)
export {
  setOpeningBalanceByInstitution,
  deleteOpeningBalanceByInstitution,
} from "@/app/actions";
