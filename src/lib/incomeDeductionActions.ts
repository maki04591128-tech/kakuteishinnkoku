// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`incomeDeductionActions.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`@/app/actions`、ひいては"use server"の
// `src/app/actions.ts`全体)はビルド対象に含まれない(フェーズ5-1-3d。
// `@/lib/authUi`・`@/lib/exportUi`と同種のパターン)。
//
// `saveIncomeDeduction`/`deleteIncomeDeduction`は基礎控除・医療費控除・
// 生命保険料控除等、`IncomeDeductionType`で区分される15の控除試算画面
// (`src/app/*/*Form.tsx`)から共通して呼ばれるServer Actionで、各呼び出し元は
// `@/app/actions`から直接importする代わりにこのモジュールを経由することで、
// スタンドアロン版ビルドでは`src/app/actions.ts`(`"use server"`、
// `output: "export"`非対応)をimportグラフから切り離せる。
export { saveIncomeDeduction, deleteIncomeDeduction } from "@/app/actions";
