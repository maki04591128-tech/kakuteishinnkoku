// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`nisaLifetimeQuotaActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d-32。
// `@/lib/futuresLossCarryforwardActions`と同種のパターン)。
//
// `carryForwardNisaLifetimeQuota`/`setNisaLifetimeQuota`/
// `deleteNisaLifetimeQuota`はいずれも`import/page.tsx`からのみ呼ばれるServer
// Actionで、呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを
// 経由することで、スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。(`setNisaLifetimeQuota`/
// `deleteNisaLifetimeQuota`はフェーズ5-1-3d-34で追加)
export {
  carryForwardNisaLifetimeQuota,
  setNisaLifetimeQuota,
  deleteNisaLifetimeQuota,
} from "@/app/actions";
