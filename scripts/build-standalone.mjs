#!/usr/bin/env node
// スタンドアロン(Android)版用の静的書き出しビルド(`next build` with `output: "export"`)。
// `src/proxy.ts`(Proxy)・`src/app/login/`(Server Actions)・`src/lib/auth/`
// (Cookies使用)は、いずれも静的書き出し(`output: "export"`)が未対応の機能に
// 依存しているため、ビルド実行中のみ一時的にリポジトリ外へ退避する
// (README「現在の最優先事項」フェーズ4の決定)。自宅サーバー版(`npm run build`)
// はこのスクリプトを経由しないため一切影響を受けない。
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();

// 退避対象(README「現状分析」フェーズ4の決定に基づく認証関連3箇所+
// フェーズ5-1-2で判明した`/api/export`)。
// `src/lib/authUi.tsx`は認証関連3箇所に依存する自宅サーバー版向け実装で、
// スタンドアロン版ではnext.config.tsのresolveAlias設定により
// `authUi.standalone.tsx`に差し替えられ参照されなくなるが、`next build`の
// 型チェックはバンドラのalias設定を認識せず`src/lib/authUi.tsx`自体を直接
// 型チェックしてしまうため、他の3箇所と同様に退避する。
//
// `src/app/api/export`(CSV下書き出力用のRoute Handler)は、Requestに応じて
// 動的にレスポンスを生成する以上`output: "export"`とは併用できない
// (`force-static`/`revalidate`未設定のRoute Handlerは静的書き出し非対応。
// README フェーズ5-1-2で確認済み)。スタンドアロン版では、このルートが行って
// いたCSV生成(`buildDraftCsvExport`)をブラウザ上で直接実行しBlobダウンロード
// させる形に置き換える想定(フェーズ5-1-3の残課題)のため、ルート自体を
// ビルド対象から除外する。
//
// `src/app/actions.ts`(`"use server"`)は、フェーズ5-1-3dで全32ファイルが
// `@/app/actions`の直接importから移行済みのため、今はこのファイル自体は
// スタンドアロン版のビルド結果(バンドル)には含まれない。しかし下記42個の
// `src/lib/*Actions.ts`(各モデルの自宅サーバー版の既定実装。
// `saveXxx`/`deleteXxx`等を`@/app/actions`からそのまま再エクスポートするだけの
// ファイル)は、スタンドアロン版では`next.config.ts`のalias設定により
// `*.standalone.ts`に差し替えられ参照されなくなるものの、`src/lib/authUi.tsx`と
// 同様の理由(`next build`の型チェックはバンドラのalias設定を認識せず
// ファイル自体を直接型チェックしてしまう)で、`src/app/actions.ts`を退避すると
// これら42ファイルの`from "@/app/actions"`importが解決できずエラーになる。
// そのため`src/app/actions.ts`と合わせてこの42ファイルも退避する。
const EXCLUDED_PATHS = [
  "src/proxy.ts",
  "src/app/login",
  "src/lib/auth",
  "src/lib/authUi.tsx",
  "src/app/api/export",
  "src/app/actions.ts",
  "src/lib/angelTaxLossCarryforwardActions.ts",
  "src/lib/assetSymbolMappingActions.ts",
  "src/lib/barrierFreeRenovationDeductionActions.ts",
  "src/lib/brokerAnnualReportActions.ts",
  "src/lib/casualtyLossCarryforwardActions.ts",
  "src/lib/certifiedHousingConstructionCreditActions.ts",
  "src/lib/childRearingRenovationDeductionActions.ts",
  "src/lib/cryptoCostMethodActions.ts",
  "src/lib/cryptoCreditTradeActions.ts",
  "src/lib/cryptoMarginTradeActions.ts",
  "src/lib/cryptoTradeActions.ts",
  "src/lib/deleteAssetBalanceImportBatchActions.ts",
  "src/lib/distributionAdjustedForeignTaxCreditActions.ts",
  "src/lib/donationTaxCreditActions.ts",
  "src/lib/durabilityImprovementRenovationDeductionActions.ts",
  "src/lib/earthquakeRenovationDeductionActions.ts",
  "src/lib/employmentIncomeActions.ts",
  "src/lib/energySavingRenovationDeductionActions.ts",
  "src/lib/foreignTaxCreditActions.ts",
  "src/lib/foreignTaxCreditCarryforwardActions.ts",
  "src/lib/foreignTaxCreditSpareLimitCarryforwardActions.ts",
  "src/lib/futuresLossCarryforwardActions.ts",
  "src/lib/futuresTradeActions.ts",
  "src/lib/homeReplacementLossCarryforwardActions.ts",
  "src/lib/homeSaleLossCarryforwardActions.ts",
  "src/lib/importAssetBalanceCsvActions.ts",
  "src/lib/importBrokerAnnualReportCsvActions.ts",
  "src/lib/importCryptoExchangeCsvActions.ts",
  "src/lib/importCryptoMarginCsvActions.ts",
  "src/lib/importFuturesCsvActions.ts",
  "src/lib/importMoneyForwardCsvActions.ts",
  "src/lib/incomeDeductionActions.ts",
  "src/lib/investmentLossCarryforwardActions.ts",
  "src/lib/investmentTradeActions.ts",
  "src/lib/marketPriceActions.ts",
  "src/lib/mortgageDeductionActions.ts",
  "src/lib/multiHouseholdRenovationDeductionActions.ts",
  "src/lib/nisaLifetimeQuotaActions.ts",
  "src/lib/openingBalanceActions.ts",
  "src/lib/openingBalanceByInstitutionActions.ts",
  "src/lib/residentTaxAdjustmentDeductionActions.ts",
  "src/lib/stockMarginTradeActions.ts",
];

// Next.jsのApp Routerは`src/app/`配下のディレクトリ名に関わらず`page.tsx`等を
// 走査するため、`src/app/login`を単にリネームするだけでは別ルートとして
// ビルド対象に残ってしまう。退避先は`src/`の外(リポジトリ直下の一時ディレクトリ)
// にする。
const BACKUP_ROOT = path.join(root, ".standalone-build-backup");

const targets = EXCLUDED_PATHS.map((relativePath) => ({
  original: path.join(root, relativePath),
  backup: path.join(BACKUP_ROOT, relativePath),
}));

function moveAway() {
  if (existsSync(BACKUP_ROOT)) {
    throw new Error(
      `バックアップ先が既に存在します: ${BACKUP_ROOT}\n` +
        "前回のスタンドアロン版ビルドが異常終了した可能性があります。" +
        "退避済みファイルを手動で元の場所に戻してから再実行してください。",
    );
  }
  for (const { original, backup } of targets) {
    if (existsSync(original)) {
      mkdirSync(path.dirname(backup), { recursive: true });
      renameSync(original, backup);
    }
  }
}

function restore() {
  for (const { original, backup } of targets) {
    if (existsSync(backup)) {
      mkdirSync(path.dirname(original), { recursive: true });
      renameSync(backup, original);
    }
  }
  if (existsSync(BACKUP_ROOT)) {
    rmSync(BACKUP_ROOT, { recursive: true });
  }
}

// `SIGINT`/`SIGTERM`で中断された場合(Ctrl-Cやシェルの`timeout`コマンド等)にも
// 退避したファイルを必ず元に戻す。`spawnSync`は同期的にイベントループを
// ブロックするため、ブロック中に届いたシグナルをNode側のハンドラで拾えず
// (デフォルト動作でそのまま終了し、下の`finally`が実行されない)退避済みの
// ファイルが残ってしまう不具合が実際に発生したため、イベントループを
// ブロックしない非同期の`spawn`に変更し、シグナルハンドラで`restore()`を
// 呼べるようにした。
function runNextBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["next", "build"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, BUILD_TARGET: "standalone" },
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

let restored = false;
function restoreOnce() {
  if (restored) return;
  restored = true;
  restore();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restoreOnce();
    process.exit(1);
  });
}

moveAway();
try {
  process.exitCode = await runNextBuild();
} finally {
  restoreOnce();
}
