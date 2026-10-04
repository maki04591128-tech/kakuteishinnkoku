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

// スタンドアロン版では既定の`TaxYearRepository`実装を、`@prisma/client`
// (Node専用)に依存しないクライアント(wa-sqlite)実装に差し替える
// (フェーズ5-1-3b。`@/lib/authUi`と同種のパターンを`TaxYearRepository`で
// 初めて適用し、以後他のリポジトリにも同じパターンを広げていく)。
const defaultTaxYearRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultTaxYearRepository.standalone.ts";
const defaultTaxYearRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultTaxYearRepository.standalone.ts",
);

// `EmploymentIncomeRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、`TaxYearRepository`に続く2つ目)。
const defaultEmploymentIncomeRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultEmploymentIncomeRecordRepository.standalone.ts";
const defaultEmploymentIncomeRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultEmploymentIncomeRecordRepository.standalone.ts",
);

// `BarrierFreeRenovationDeductionRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、`TaxYearRepository`・`EmploymentIncomeRecordRepository`に続く3つ目)。
const defaultBarrierFreeRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultBarrierFreeRenovationDeductionRecordRepository.standalone.ts";
const defaultBarrierFreeRenovationDeductionRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultBarrierFreeRenovationDeductionRecordRepository.standalone.ts",
);

// `CertifiedHousingConstructionCreditRecordRepository`/
// `CertifiedHousingConstructionCreditCarryforwardRepository`にも同じ切り替えパターンを
// 適用する(フェーズ5-1-3b、4つ目・5つ目)。
const defaultCertifiedHousingConstructionCreditRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultCertifiedHousingConstructionCreditRecordRepository.standalone.ts";
const defaultCertifiedHousingConstructionCreditRecordRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultCertifiedHousingConstructionCreditRecordRepository.standalone.ts",
  );
const defaultCertifiedHousingConstructionCreditCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultCertifiedHousingConstructionCreditCarryforwardRepository.standalone.ts";
const defaultCertifiedHousingConstructionCreditCarryforwardRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultCertifiedHousingConstructionCreditCarryforwardRepository.standalone.ts",
  );

// `ChildRearingRenovationDeductionRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、6つ目)。
const defaultChildRearingRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultChildRearingRenovationDeductionRecordRepository.standalone.ts";
const defaultChildRearingRenovationDeductionRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultChildRearingRenovationDeductionRecordRepository.standalone.ts",
);

// `DonationTaxCreditRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、7つ目)。
const defaultDonationTaxCreditRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultDonationTaxCreditRecordRepository.standalone.ts";
const defaultDonationTaxCreditRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultDonationTaxCreditRecordRepository.standalone.ts",
);

// `DurabilityImprovementRenovationDeductionRecordRepository`にも同じ切り替えパターンを
// 適用する(フェーズ5-1-3b、8つ目)。
const defaultDurabilityImprovementRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultDurabilityImprovementRenovationDeductionRecordRepository.standalone.ts";
const defaultDurabilityImprovementRenovationDeductionRecordRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultDurabilityImprovementRenovationDeductionRecordRepository.standalone.ts",
  );

// `EarthquakeRenovationDeductionRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、9つ目)。
const defaultEarthquakeRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository.standalone.ts";
const defaultEarthquakeRenovationDeductionRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository.standalone.ts",
);

// `EnergySavingRenovationDeductionRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、10つ目)。
const defaultEnergySavingRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultEnergySavingRenovationDeductionRecordRepository.standalone.ts";
const defaultEnergySavingRenovationDeductionRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultEnergySavingRenovationDeductionRecordRepository.standalone.ts",
);

// `IncomeDeductionRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、11つ目)。
const defaultIncomeDeductionRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultIncomeDeductionRepository.standalone.ts";
const defaultIncomeDeductionRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultIncomeDeductionRepository.standalone.ts",
);

// `MultiHouseholdRenovationDeductionRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、12つ目)。
const defaultMultiHouseholdRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultMultiHouseholdRenovationDeductionRecordRepository.standalone.ts";
const defaultMultiHouseholdRenovationDeductionRecordRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultMultiHouseholdRenovationDeductionRecordRepository.standalone.ts",
  );

// `OpeningBalanceRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、13つ目)。
const defaultOpeningBalanceRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultOpeningBalanceRepository.standalone.ts";
const defaultOpeningBalanceRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultOpeningBalanceRepository.standalone.ts",
);

// `MortgageDeductionRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、14つ目)。
const defaultMortgageDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultMortgageDeductionRecordRepository.standalone.ts";
const defaultMortgageDeductionRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultMortgageDeductionRecordRepository.standalone.ts",
);

// `ForeignTaxCreditRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、15つ目)。
const defaultForeignTaxCreditRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultForeignTaxCreditRecordRepository.standalone.ts";
const defaultForeignTaxCreditRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultForeignTaxCreditRecordRepository.standalone.ts",
);

// `ResidentTaxAdjustmentDeductionRecordRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、16つ目)。
const defaultResidentTaxAdjustmentDeductionRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultResidentTaxAdjustmentDeductionRecordRepository.standalone.ts";
const defaultResidentTaxAdjustmentDeductionRecordRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultResidentTaxAdjustmentDeductionRecordRepository.standalone.ts",
);

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
          "@/lib/repositories/defaultTaxYearRepository":
            defaultTaxYearRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultEmploymentIncomeRecordRepository":
            defaultEmploymentIncomeRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultBarrierFreeRenovationDeductionRecordRepository":
            defaultBarrierFreeRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultCertifiedHousingConstructionCreditRecordRepository":
            defaultCertifiedHousingConstructionCreditRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultCertifiedHousingConstructionCreditCarryforwardRepository":
            defaultCertifiedHousingConstructionCreditCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultChildRearingRenovationDeductionRecordRepository":
            defaultChildRearingRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultDonationTaxCreditRecordRepository":
            defaultDonationTaxCreditRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultDurabilityImprovementRenovationDeductionRecordRepository":
            defaultDurabilityImprovementRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository":
            defaultEarthquakeRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultEnergySavingRenovationDeductionRecordRepository":
            defaultEnergySavingRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultIncomeDeductionRepository":
            defaultIncomeDeductionRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultMultiHouseholdRenovationDeductionRecordRepository":
            defaultMultiHouseholdRenovationDeductionRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultOpeningBalanceRepository":
            defaultOpeningBalanceRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultMortgageDeductionRecordRepository":
            defaultMortgageDeductionRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultForeignTaxCreditRecordRepository":
            defaultForeignTaxCreditRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultResidentTaxAdjustmentDeductionRecordRepository":
            defaultResidentTaxAdjustmentDeductionRecordRepositoryStandaloneAliasForTurbopack,
        },
      }
    : {},
  webpack(config) {
    if (isStandaloneBuild) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/lib/authUi": authUiStandaloneAliasForWebpack,
        "@/lib/repositories/defaultTaxYearRepository":
          defaultTaxYearRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultEmploymentIncomeRecordRepository":
          defaultEmploymentIncomeRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultBarrierFreeRenovationDeductionRecordRepository":
          defaultBarrierFreeRenovationDeductionRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultCertifiedHousingConstructionCreditRecordRepository":
          defaultCertifiedHousingConstructionCreditRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultCertifiedHousingConstructionCreditCarryforwardRepository":
          defaultCertifiedHousingConstructionCreditCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultChildRearingRenovationDeductionRecordRepository":
          defaultChildRearingRenovationDeductionRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultDonationTaxCreditRecordRepository":
          defaultDonationTaxCreditRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultDurabilityImprovementRenovationDeductionRecordRepository":
          defaultDurabilityImprovementRenovationDeductionRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository":
          defaultEarthquakeRenovationDeductionRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultEnergySavingRenovationDeductionRecordRepository":
          defaultEnergySavingRenovationDeductionRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultIncomeDeductionRepository":
          defaultIncomeDeductionRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultMultiHouseholdRenovationDeductionRecordRepository":
          defaultMultiHouseholdRenovationDeductionRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultOpeningBalanceRepository":
          defaultOpeningBalanceRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultMortgageDeductionRecordRepository":
          defaultMortgageDeductionRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultForeignTaxCreditRecordRepository":
          defaultForeignTaxCreditRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultResidentTaxAdjustmentDeductionRecordRepository":
          defaultResidentTaxAdjustmentDeductionRecordRepositoryStandaloneAliasForWebpack,
      };
    }
    return config;
  },
};

export default nextConfig;
