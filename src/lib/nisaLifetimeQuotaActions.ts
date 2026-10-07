// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`nisaLifetimeQuotaActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d-32。
// `@/lib/futuresLossCarryforwardActions`と同種のパターン)。
//
// `carryForwardNisaLifetimeQuota`は`import/page.tsx`からのみ呼ばれるServer Action
// で、呼び出し元は`@/app/actions`から直接importする代わりにこのモジュールを経由する
// ことで、スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。(`setNisaLifetimeQuota`/
// `deleteNisaLifetimeQuota`は本ステップの対象外で、残り24個の対象として未移行のまま
// `@/app/actions`からの直接importで残っている)
export { carryForwardNisaLifetimeQuota } from "@/app/actions";
