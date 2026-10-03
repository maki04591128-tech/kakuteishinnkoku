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
// Turbopack(デフォルトバンドラ)向け: ドキュメント記載の相対パス表記。
const authUiStandaloneAliasForTurbopack = "./src/lib/authUi.standalone.tsx";
// webpack(`next build --webpack`実行時用のフォールバック)向け: webpackの
// resolve.aliasは絶対パスを要求する。
const authUiStandaloneAliasForWebpack = path.resolve(process.cwd(), "src/lib/authUi.standalone.tsx");

const nextConfig: NextConfig = {
  ...(isStandaloneBuild ? { output: "export" } : {}),
  // `next build`内蔵の型チェックはバンドラのresolveAlias設定を認識しないため、
  // `@/lib/authUi`を`authUi.standalone.tsx`に向ける`paths`を持つ別tsconfigを使う
  // (tsconfig.standalone.json)。
  ...(isStandaloneBuild ? { typescript: { tsconfigPath: "tsconfig.standalone.json" } } : {}),
  // webpackConfigを併用する場合、Turbopack使用時も`turbopack`キーを明示しないと
  // Next.js 16はビルドエラーにする(エラーメッセージの指示に従い空設定を渡す)。
  turbopack: isStandaloneBuild
    ? {
        resolveAlias: {
          "@/lib/authUi": authUiStandaloneAliasForTurbopack,
        },
      }
    : {},
  webpack(config) {
    if (isStandaloneBuild) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/lib/authUi": authUiStandaloneAliasForWebpack,
      };
    }
    return config;
  },
};

export default nextConfig;
