#!/usr/bin/env node
// スタンドアロン(Android)版用の静的書き出しビルド(`next build` with `output: "export"`)。
// `src/proxy.ts`(Proxy)・`src/app/login/`(Server Actions)・`src/lib/auth/`
// (Cookies使用)は、いずれも静的書き出し(`output: "export"`)が未対応の機能に
// 依存しているため、ビルド実行中のみ一時的にリポジトリ外へ退避する
// (README「現在の最優先事項」フェーズ4の決定)。自宅サーバー版(`npm run build`)
// はこのスクリプトを経由しないため一切影響を受けない。
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

// 退避対象(README「現状分析」フェーズ4の決定に基づく3箇所)。
// `src/lib/authUi.tsx`は上記3箇所に依存する自宅サーバー版向け実装で、
// スタンドアロン版ではnext.config.tsのresolveAlias設定により
// `authUi.standalone.tsx`に差し替えられ参照されなくなるが、`next build`の
// 型チェックはバンドラのalias設定を認識せず`src/lib/authUi.tsx`自体を直接
// 型チェックしてしまうため、他の3箇所と同様に退避する。
const EXCLUDED_PATHS = ["src/proxy.ts", "src/app/login", "src/lib/auth", "src/lib/authUi.tsx"];

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

moveAway();
try {
  const result = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "standalone" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  restore();
}
