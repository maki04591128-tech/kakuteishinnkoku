import type { NextConfig } from "next";
import path from "node:path";

// スタンドアロン(Android)版ビルドかどうか。`npm run build`(自宅サーバー版)では
// 未設定のため従来通りのビルドのまま変わらない。`npm run build:standalone`
// (scripts/build-standalone.mjs経由)でのみ設定される。
const isStandaloneBuild = process.env.BUILD_TARGET === "standalone";

// スタンドアロン版では`@/lib/authUi`の実装を、パスワード認証
// (`@/lib/auth/`・`@/app/login/`)に依存しないスタブに差し替える。これにより
// スタンドアロン版のビルド対象から認証関連コードを除外できる
// (README「現在の最優先事項」フェーズ4の決定)。`src/proxy.ts`・
// `src/app/login/`・`src/lib/auth/`そのものは、`output: "export"`と併用できない
// (Proxy・Cookies・Server Actionsは静的書き出し未対応のため)ため
// scripts/build-standalone.mjsがビルド実行前後に一時的に退避する。
//
// フェーズ5-1-3b: 既定のリポジトリ実装(`defaultXxxRepository`)の切り替えにも
// 同じaliasパターンを使う(各エントリの標準パスを`.standalone`版に差し替える)。
// まず`TaxYearRepository`用の1エントリのみ用意し、以後`src/lib/repositories/`の
// 残りの実装を分離するたびにここへ追記していく想定。
const STANDALONE_MODULE_ALIASES: Record<string, string> = {
  "@/lib/authUi": "src/lib/authUi.standalone.tsx",
  "@/lib/repositories/defaultTaxYearRepository":
    "src/lib/repositories/defaultTaxYearRepository.standalone.ts",
};

// Turbopack(デフォルトバンドラ)向け: ドキュメント記載の相対パス表記。
const standaloneAliasesForTurbopack = Object.fromEntries(
  Object.entries(STANDALONE_MODULE_ALIASES).map(([from, to]) => [from, `./${to}`]),
);
// webpack(`next build --webpack`実行時用のフォールバック)向け: webpackの
// resolve.aliasは絶対パスを要求する。
const standaloneAliasesForWebpack = Object.fromEntries(
  Object.entries(STANDALONE_MODULE_ALIASES).map(([from, to]) => [from, path.resolve(process.cwd(), to)]),
);

const nextConfig: NextConfig = {
  ...(isStandaloneBuild ? { output: "export" } : {}),
  // `next build`内蔵の型チェックはバンドラのresolveAlias設定を認識しないため、
  // 上記エントリを同様に差し替える`paths`を持つ別tsconfigを使う
  // (tsconfig.standalone.json)。
  ...(isStandaloneBuild ? { typescript: { tsconfigPath: "tsconfig.standalone.json" } } : {}),
  // webpackConfigを併用する場合、Turbopack使用時も`turbopack`キーを明示しないと
  // Next.js 16はビルドエラーにする(エラーメッセージの指示に従い空設定を渡す)。
  turbopack: isStandaloneBuild
    ? {
        resolveAlias: standaloneAliasesForTurbopack,
      }
    : {},
  webpack(config) {
    if (isStandaloneBuild) {
      config.resolve.alias = {
        ...config.resolve.alias,
        ...standaloneAliasesForWebpack,
      };
    }
    return config;
  },
};

export default nextConfig;
