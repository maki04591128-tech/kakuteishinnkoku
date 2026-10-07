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

// スタンドアロン版では`@/lib/exportUi`の実装を、`/api/export`(Route Handler。
// スタンドアロン版のビルド対象から除外される)へのリンクではなく、ブラウザ上で直接
// `buildDraftCsvExport`を実行してBlobダウンロードさせる実装に差し替える
// (フェーズ5-1-3c。`@/lib/authUi`と同種のパターン)。
const exportUiStandaloneAliasForTurbopack = "./src/lib/exportUi.standalone.tsx";
const exportUiStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/exportUi.standalone.tsx",
);

// スタンドアロン版では`@/lib/incomeDeductionActions`の実装を、`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)の`saveIncomeDeduction`/
// `deleteIncomeDeduction`をそのまま再エクスポートする代わりに、フェーズ3で
// 抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える(フェーズ5-1-3d。
// `@/lib/authUi`・`@/lib/exportUi`と同種のパターン)。
const incomeDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/incomeDeductionActions.standalone.ts";
const incomeDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/incomeDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/employmentIncomeActions`の実装を、`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)の`saveEmploymentIncomeRecord`/
// `deleteEmploymentIncomeRecord`をそのまま再エクスポートする代わりに、フェーズ3で
// 抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える(フェーズ5-1-3d、
// `@/lib/incomeDeductionActions`に続く2つ目)。
const employmentIncomeActionsStandaloneAliasForTurbopack =
  "./src/lib/employmentIncomeActions.standalone.ts";
const employmentIncomeActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/employmentIncomeActions.standalone.ts",
);

// スタンドアロン版では`@/lib/barrierFreeRenovationDeductionActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveBarrierFreeRenovationDeductionRecord`/
// `deleteBarrierFreeRenovationDeductionRecord`をそのまま再エクスポートする代わりに、
// フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`に
// 続く3つ目)。
const barrierFreeRenovationDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/barrierFreeRenovationDeductionActions.standalone.ts";
const barrierFreeRenovationDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/barrierFreeRenovationDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/earthquakeRenovationDeductionActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveEarthquakeRenovationDeductionRecord`/
// `deleteEarthquakeRenovationDeductionRecord`をそのまま再エクスポートする代わりに、
// フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`・
// `@/lib/barrierFreeRenovationDeductionActions`に続く4つ目)。
const earthquakeRenovationDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/earthquakeRenovationDeductionActions.standalone.ts";
const earthquakeRenovationDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/earthquakeRenovationDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/donationTaxCreditActions`の実装を、`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)の`saveDonationTaxCreditRecord`/
// `deleteDonationTaxCreditRecord`をそのまま再エクスポートする代わりに、フェーズ3で
// 抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える(フェーズ5-1-3d、
// `@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`・
// `@/lib/barrierFreeRenovationDeductionActions`・
// `@/lib/earthquakeRenovationDeductionActions`に続く5つ目)。
const donationTaxCreditActionsStandaloneAliasForTurbopack =
  "./src/lib/donationTaxCreditActions.standalone.ts";
const donationTaxCreditActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/donationTaxCreditActions.standalone.ts",
);

// スタンドアロン版では`@/lib/mortgageDeductionActions`の実装を、`src/app/actions.ts`
// (`"use server"`、`output: "export"`非対応)の`saveMortgageDeductionRecord`/
// `deleteMortgageDeductionRecord`をそのまま再エクスポートする代わりに、フェーズ3で
// 抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える(フェーズ5-1-3d、
// `@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`・
// `@/lib/barrierFreeRenovationDeductionActions`・
// `@/lib/earthquakeRenovationDeductionActions`・`@/lib/donationTaxCreditActions`に
// 続く6つ目)。
const mortgageDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/mortgageDeductionActions.standalone.ts";
const mortgageDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/mortgageDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/childRearingRenovationDeductionActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveChildRearingRenovationDeductionRecord`/
// `deleteChildRearingRenovationDeductionRecord`をそのまま再エクスポートする代わりに、
// フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`・
// `@/lib/barrierFreeRenovationDeductionActions`・
// `@/lib/earthquakeRenovationDeductionActions`・`@/lib/donationTaxCreditActions`・
// `@/lib/mortgageDeductionActions`に続く7つ目)。
const childRearingRenovationDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/childRearingRenovationDeductionActions.standalone.ts";
const childRearingRenovationDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/childRearingRenovationDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/energySavingRenovationDeductionActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveEnergySavingRenovationDeductionRecord`/
// `deleteEnergySavingRenovationDeductionRecord`をそのまま再エクスポートする代わりに、
// フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`・
// `@/lib/barrierFreeRenovationDeductionActions`・
// `@/lib/earthquakeRenovationDeductionActions`・`@/lib/donationTaxCreditActions`・
// `@/lib/mortgageDeductionActions`・`@/lib/childRearingRenovationDeductionActions`に
// 続く8つ目)。
const energySavingRenovationDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/energySavingRenovationDeductionActions.standalone.ts";
const energySavingRenovationDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/energySavingRenovationDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/distributionAdjustedForeignTaxCreditActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveDistributionAdjustedForeignTaxCreditRecord`/
// `deleteDistributionAdjustedForeignTaxCreditRecord`をそのまま再エクスポートする
// 代わりに、フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`・
// `@/lib/barrierFreeRenovationDeductionActions`・
// `@/lib/earthquakeRenovationDeductionActions`・`@/lib/donationTaxCreditActions`・
// `@/lib/mortgageDeductionActions`・`@/lib/childRearingRenovationDeductionActions`・
// `@/lib/energySavingRenovationDeductionActions`に続く9つ目)。
const distributionAdjustedForeignTaxCreditActionsStandaloneAliasForTurbopack =
  "./src/lib/distributionAdjustedForeignTaxCreditActions.standalone.ts";
const distributionAdjustedForeignTaxCreditActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/distributionAdjustedForeignTaxCreditActions.standalone.ts",
);

// スタンドアロン版では`@/lib/durabilityImprovementRenovationDeductionActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveDurabilityImprovementRenovationDeductionRecord`/
// `deleteDurabilityImprovementRenovationDeductionRecord`をそのまま再エクスポートする
// 代わりに、フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/incomeDeductionActions`・`@/lib/employmentIncomeActions`・
// `@/lib/barrierFreeRenovationDeductionActions`・
// `@/lib/earthquakeRenovationDeductionActions`・`@/lib/donationTaxCreditActions`・
// `@/lib/mortgageDeductionActions`・`@/lib/childRearingRenovationDeductionActions`・
// `@/lib/energySavingRenovationDeductionActions`・
// `@/lib/distributionAdjustedForeignTaxCreditActions`に続く10つ目)。
const durabilityImprovementRenovationDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/durabilityImprovementRenovationDeductionActions.standalone.ts";
const durabilityImprovementRenovationDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/durabilityImprovementRenovationDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/multiHouseholdRenovationDeductionActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveMultiHouseholdRenovationDeductionRecord`/
// `deleteMultiHouseholdRenovationDeductionRecord`をそのまま再エクスポートする
// 代わりに、フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/durabilityImprovementRenovationDeductionActions`に続く
// 11個目)。
const multiHouseholdRenovationDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/multiHouseholdRenovationDeductionActions.standalone.ts";
const multiHouseholdRenovationDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/multiHouseholdRenovationDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/residentTaxAdjustmentDeductionActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `saveResidentTaxAdjustmentDeductionRecord`/
// `deleteResidentTaxAdjustmentDeductionRecord`をそのまま再エクスポートする
// 代わりに、フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/multiHouseholdRenovationDeductionActions`に続く
// 12個目)。
const residentTaxAdjustmentDeductionActionsStandaloneAliasForTurbopack =
  "./src/lib/residentTaxAdjustmentDeductionActions.standalone.ts";
const residentTaxAdjustmentDeductionActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/residentTaxAdjustmentDeductionActions.standalone.ts",
);

// スタンドアロン版では`@/lib/certifiedHousingConstructionCreditActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の5アクション
// (`save`/`delete`の2つに加え、繰越(`CertifiedHousingConstructionCreditCarryforward`)
// 関連の`carryForward`/`apply`/`delete`の3つ)をそのまま再エクスポートする代わりに、
// フェーズ3で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/residentTaxAdjustmentDeductionActions`に続く13個目)。
const certifiedHousingConstructionCreditActionsStandaloneAliasForTurbopack =
  "./src/lib/certifiedHousingConstructionCreditActions.standalone.ts";
const certifiedHousingConstructionCreditActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/certifiedHousingConstructionCreditActions.standalone.ts",
);

// スタンドアロン版では`@/lib/casualtyLossCarryforwardActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `carryForwardCasualtyLossExcess`をそのまま再エクスポートする代わりに、本ステップ
// (5-1-3d-14)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/certifiedHousingConstructionCreditActions`に続く14個目)。
const casualtyLossCarryforwardActionsStandaloneAliasForTurbopack =
  "./src/lib/casualtyLossCarryforwardActions.standalone.ts";
const casualtyLossCarryforwardActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/casualtyLossCarryforwardActions.standalone.ts",
);

// スタンドアロン版では`@/lib/angelTaxLossCarryforwardActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `setAngelTaxLossCarryforward`/`deleteAngelTaxLossCarryforward`をそのまま
// 再エクスポートする代わりに、本ステップ(5-1-3d-15)で抽出済みのコア関数を
// ブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/casualtyLossCarryforwardActions`に続く15個目)。
const angelTaxLossCarryforwardActionsStandaloneAliasForTurbopack =
  "./src/lib/angelTaxLossCarryforwardActions.standalone.ts";
const angelTaxLossCarryforwardActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/angelTaxLossCarryforwardActions.standalone.ts",
);

// スタンドアロン版では`@/lib/foreignTaxCreditActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の4アクション
// (`saveForeignTaxCreditRecord`/`deleteForeignTaxCreditRecord`/
// `carryForwardForeignTaxCreditExcess`/`carryForwardForeignTaxCreditSpareLimit`)を
// そのまま再エクスポートする代わりに、本ステップ(5-1-3d-16)で抽出済みのコア関数を
// ブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/angelTaxLossCarryforwardActions`に続く16個目)。
const foreignTaxCreditActionsStandaloneAliasForTurbopack =
  "./src/lib/foreignTaxCreditActions.standalone.ts";
const foreignTaxCreditActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/foreignTaxCreditActions.standalone.ts",
);

// スタンドアロン版では`@/lib/homeSaleLossCarryforwardActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `carryForwardHomeSaleLossExcess`をそのまま再エクスポートする代わりに、本ステップ
// (5-1-3d-17)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/foreignTaxCreditActions`に続く17個目)。
const homeSaleLossCarryforwardActionsStandaloneAliasForTurbopack =
  "./src/lib/homeSaleLossCarryforwardActions.standalone.ts";
const homeSaleLossCarryforwardActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/homeSaleLossCarryforwardActions.standalone.ts",
);

// スタンドアロン版では`@/lib/homeReplacementLossCarryforwardActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `carryForwardHomeReplacementLossExcess`をそのまま再エクスポートする代わりに、
// 本ステップ(5-1-3d-18)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に
// 差し替える(フェーズ5-1-3d、`@/lib/homeSaleLossCarryforwardActions`に続く18個目)。
const homeReplacementLossCarryforwardActionsStandaloneAliasForTurbopack =
  "./src/lib/homeReplacementLossCarryforwardActions.standalone.ts";
const homeReplacementLossCarryforwardActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/homeReplacementLossCarryforwardActions.standalone.ts",
);

// スタンドアロン版では`@/lib/brokerAnnualReportActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `setBrokerAnnualReport`をそのまま再エクスポートする代わりに、本ステップ
// (5-1-3d-19)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に差し替える
// (フェーズ5-1-3d、`@/lib/homeReplacementLossCarryforwardActions`に続く19個目)。
const brokerAnnualReportActionsStandaloneAliasForTurbopack =
  "./src/lib/brokerAnnualReportActions.standalone.ts";
const brokerAnnualReportActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/brokerAnnualReportActions.standalone.ts",
);

// スタンドアロン版では`@/lib/marketPriceActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `setMarketPrice`/`deleteMarketPrice`をそのまま再エクスポートする代わりに、
// 本ステップ(5-1-3d-20)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に
// 差し替える(フェーズ5-1-3d、`@/lib/brokerAnnualReportActions`に続く20個目)。
const marketPriceActionsStandaloneAliasForTurbopack =
  "./src/lib/marketPriceActions.standalone.ts";
const marketPriceActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/marketPriceActions.standalone.ts",
);

// スタンドアロン版では`@/lib/assetSymbolMappingActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `setAssetSymbolMapping`/`deleteAssetSymbolMapping`をそのまま再エクスポートする
// 代わりに、本ステップ(5-1-3d-21)で抽出済みのコア関数をブラウザ上で直接呼び出す
// 実装に差し替える(フェーズ5-1-3d、`@/lib/marketPriceActions`に続く21個目)。
const assetSymbolMappingActionsStandaloneAliasForTurbopack =
  "./src/lib/assetSymbolMappingActions.standalone.ts";
const assetSymbolMappingActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/assetSymbolMappingActions.standalone.ts",
);

// スタンドアロン版では`@/lib/cryptoTradeActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `addCryptoTrade`/`deleteCryptoTrade`をそのまま再エクスポートする代わりに、
// 本ステップ(5-1-3d-23)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に
// 差し替える(フェーズ5-1-3d、`@/lib/assetSymbolMappingActions`に続く22個目)。
const cryptoTradeActionsStandaloneAliasForTurbopack =
  "./src/lib/cryptoTradeActions.standalone.ts";
const cryptoTradeActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/cryptoTradeActions.standalone.ts",
);

// スタンドアロン版では`@/lib/cryptoCreditTradeActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `addCryptoCreditTrade`/`deleteCryptoCreditTrade`をそのまま再エクスポートする
// 代わりに、本ステップ(5-1-3d-24)で抽出済みのコア関数をブラウザ上で直接呼び出す
// 実装に差し替える(フェーズ5-1-3d、`@/lib/cryptoTradeActions`に続く23個目)。
const cryptoCreditTradeActionsStandaloneAliasForTurbopack =
  "./src/lib/cryptoCreditTradeActions.standalone.ts";
const cryptoCreditTradeActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/cryptoCreditTradeActions.standalone.ts",
);

// スタンドアロン版では`@/lib/cryptoMarginTradeActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `addCryptoMarginTrade`/`deleteCryptoMarginTrade`をそのまま再エクスポートする
// 代わりに、本ステップ(5-1-3d-25)で抽出済みのコア関数をブラウザ上で直接呼び出す
// 実装に差し替える(フェーズ5-1-3d、`@/lib/cryptoCreditTradeActions`に続く24個目)。
const cryptoMarginTradeActionsStandaloneAliasForTurbopack =
  "./src/lib/cryptoMarginTradeActions.standalone.ts";
const cryptoMarginTradeActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/cryptoMarginTradeActions.standalone.ts",
);

// スタンドアロン版では`@/lib/futuresTradeActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `addFuturesTrade`/`deleteFuturesTrade`をそのまま再エクスポートする代わりに、
// 本ステップ(5-1-3d-26)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に
// 差し替える(フェーズ5-1-3d、`@/lib/cryptoMarginTradeActions`に続く25個目)。
const futuresTradeActionsStandaloneAliasForTurbopack =
  "./src/lib/futuresTradeActions.standalone.ts";
const futuresTradeActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/futuresTradeActions.standalone.ts",
);

// スタンドアロン版では`@/lib/investmentTradeActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `addInvestmentTrade`/`deleteInvestmentTrade`をそのまま再エクスポートする代わりに、
// 本ステップ(5-1-3d-27)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に
// 差し替える(フェーズ5-1-3d、`@/lib/futuresTradeActions`に続く26個目)。
const investmentTradeActionsStandaloneAliasForTurbopack =
  "./src/lib/investmentTradeActions.standalone.ts";
const investmentTradeActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/investmentTradeActions.standalone.ts",
);

// スタンドアロン版では`@/lib/stockMarginTradeActions`の実装を、
// `src/app/actions.ts`(`"use server"`、`output: "export"`非対応)の
// `addStockMarginTrade`/`deleteStockMarginTrade`をそのまま再エクスポートする代わりに、
// 本ステップ(5-1-3d-28)で抽出済みのコア関数をブラウザ上で直接呼び出す実装に
// 差し替える(フェーズ5-1-3d、`@/lib/investmentTradeActions`に続く27個目)。
const stockMarginTradeActionsStandaloneAliasForTurbopack =
  "./src/lib/stockMarginTradeActions.standalone.ts";
const stockMarginTradeActionsStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/stockMarginTradeActions.standalone.ts",
);

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

// `DistributionAdjustedForeignTaxCreditRecordRepository`にも同じ切り替えパターンを
// 適用する(フェーズ5-1-3b、17つ目)。
const defaultDistributionAdjustedForeignTaxCreditRecordRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone.ts";
const defaultDistributionAdjustedForeignTaxCreditRecordRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone.ts",
  );

// `CryptoTradeRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、18つ目。`src/lib/reporting.ts`の残り対象の1つ目)。
const defaultCryptoTradeRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultCryptoTradeRepository.standalone.ts";
const defaultCryptoTradeRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultCryptoTradeRepository.standalone.ts",
);

// `CryptoMarginTradeRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、19つ目。`src/lib/reporting.ts`の残り対象の2つ目)。
const defaultCryptoMarginTradeRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultCryptoMarginTradeRepository.standalone.ts";
const defaultCryptoMarginTradeRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultCryptoMarginTradeRepository.standalone.ts",
);

// `CryptoCreditTradeRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、20つ目。`src/lib/reporting.ts`の残り対象の3つ目)。
const defaultCryptoCreditTradeRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultCryptoCreditTradeRepository.standalone.ts";
const defaultCryptoCreditTradeRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultCryptoCreditTradeRepository.standalone.ts",
);

// `InvestmentTradeRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、21つ目。`src/lib/reporting.ts`の残り対象の4つ目)。
const defaultInvestmentTradeRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultInvestmentTradeRepository.standalone.ts";
const defaultInvestmentTradeRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultInvestmentTradeRepository.standalone.ts",
);

// `StockMarginTradeRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、22つ目。`src/lib/reporting.ts`の残り対象の5つ目)。
const defaultStockMarginTradeRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultStockMarginTradeRepository.standalone.ts";
const defaultStockMarginTradeRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultStockMarginTradeRepository.standalone.ts",
);

// `FuturesTradeRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、23つ目。`src/lib/reporting.ts`の残り対象の6つ目)。
const defaultFuturesTradeRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultFuturesTradeRepository.standalone.ts";
const defaultFuturesTradeRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultFuturesTradeRepository.standalone.ts",
);

// `InvestmentLossCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、24つ目。`src/lib/reporting.ts`の残り対象の7つ目)。
const defaultInvestmentLossCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultInvestmentLossCarryforwardRepository.standalone.ts";
const defaultInvestmentLossCarryforwardRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultInvestmentLossCarryforwardRepository.standalone.ts",
  );

// `FuturesLossCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、25つ目。`src/lib/reporting.ts`の残り対象の8つ目)。
const defaultFuturesLossCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultFuturesLossCarryforwardRepository.standalone.ts";
const defaultFuturesLossCarryforwardRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultFuturesLossCarryforwardRepository.standalone.ts",
  );

// `NisaLifetimeQuotaRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、26つ目。`src/lib/reporting.ts`の残り対象の9つ目)。
const defaultNisaLifetimeQuotaRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultNisaLifetimeQuotaRepository.standalone.ts";
const defaultNisaLifetimeQuotaRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultNisaLifetimeQuotaRepository.standalone.ts",
);

// `AssetBalanceSnapshotRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、27つ目。`src/lib/reporting.ts`の残り対象の最後)。
const defaultAssetBalanceSnapshotRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultAssetBalanceSnapshotRepository.standalone.ts";
const defaultAssetBalanceSnapshotRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultAssetBalanceSnapshotRepository.standalone.ts",
);

// `BrokerAnnualReportRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、`src/lib/reporting.ts`消費分の27個に続く、`src/app/actions.ts`
// のみが消費する残り11個の1つ目)。
const defaultBrokerAnnualReportRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultBrokerAnnualReportRepository.standalone.ts";
const defaultBrokerAnnualReportRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultBrokerAnnualReportRepository.standalone.ts",
);

// `OpeningBalanceByInstitutionRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、`src/app/actions.ts`のみが消費する残り11個の2つ目)。
const defaultOpeningBalanceByInstitutionRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultOpeningBalanceByInstitutionRepository.standalone.ts";
const defaultOpeningBalanceByInstitutionRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultOpeningBalanceByInstitutionRepository.standalone.ts",
);

// `AssetSymbolMappingRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、`src/app/actions.ts`のみが消費する残り11個の3つ目)。
const defaultAssetSymbolMappingRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultAssetSymbolMappingRepository.standalone.ts";
const defaultAssetSymbolMappingRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultAssetSymbolMappingRepository.standalone.ts",
);

// `MarketPriceRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3b、`src/app/actions.ts`のみが消費する残り11個の4つ目)。
const defaultMarketPriceRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultMarketPriceRepository.standalone.ts";
const defaultMarketPriceRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultMarketPriceRepository.standalone.ts",
);

// `CasualtyLossCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3d-14。5-1-3bで洗い出した「`actions.ts`のみが消費する残り7個の
// リポジトリ」の1つ目)。
const defaultCasualtyLossCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultCasualtyLossCarryforwardRepository.standalone.ts";
const defaultCasualtyLossCarryforwardRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultCasualtyLossCarryforwardRepository.standalone.ts",
);

// `AngelTaxLossCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3d-15。5-1-3bで洗い出した「`actions.ts`のみが消費する残り7個の
// リポジトリ」の2つ目)。
const defaultAngelTaxLossCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultAngelTaxLossCarryforwardRepository.standalone.ts";
const defaultAngelTaxLossCarryforwardRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultAngelTaxLossCarryforwardRepository.standalone.ts",
);

// `ForeignTaxCreditCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3d-16。5-1-3bで洗い出した「`actions.ts`のみが消費する残り7個の
// リポジトリ」の3つ目)。
const defaultForeignTaxCreditCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultForeignTaxCreditCarryforwardRepository.standalone.ts";
const defaultForeignTaxCreditCarryforwardRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultForeignTaxCreditCarryforwardRepository.standalone.ts",
);

// `ForeignTaxCreditSpareLimitCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3d-16。5-1-3bで洗い出した「`actions.ts`のみが消費する残り7個の
// リポジトリ」の4つ目)。
const defaultForeignTaxCreditSpareLimitCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository.standalone.ts";
const defaultForeignTaxCreditSpareLimitCarryforwardRepositoryStandaloneAliasForWebpack =
  path.resolve(
    process.cwd(),
    "src/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository.standalone.ts",
  );

// `HomeSaleLossCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3d-17。5-1-3bで洗い出した「`actions.ts`のみが消費する残り7個の
// リポジトリ」の5つ目)。
const defaultHomeSaleLossCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultHomeSaleLossCarryforwardRepository.standalone.ts";
const defaultHomeSaleLossCarryforwardRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultHomeSaleLossCarryforwardRepository.standalone.ts",
);

// `HomeReplacementLossCarryforwardRepository`にも同じ切り替えパターンを適用する
// (フェーズ5-1-3d-18。5-1-3bで洗い出した「`actions.ts`のみが消費する残り7個の
// リポジトリ」の6つ目)。
const defaultHomeReplacementLossCarryforwardRepositoryStandaloneAliasForTurbopack =
  "./src/lib/repositories/defaultHomeReplacementLossCarryforwardRepository.standalone.ts";
const defaultHomeReplacementLossCarryforwardRepositoryStandaloneAliasForWebpack = path.resolve(
  process.cwd(),
  "src/lib/repositories/defaultHomeReplacementLossCarryforwardRepository.standalone.ts",
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
          "@/lib/exportUi": exportUiStandaloneAliasForTurbopack,
          "@/lib/incomeDeductionActions": incomeDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/employmentIncomeActions": employmentIncomeActionsStandaloneAliasForTurbopack,
          "@/lib/barrierFreeRenovationDeductionActions":
            barrierFreeRenovationDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/earthquakeRenovationDeductionActions":
            earthquakeRenovationDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/donationTaxCreditActions": donationTaxCreditActionsStandaloneAliasForTurbopack,
          "@/lib/mortgageDeductionActions": mortgageDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/childRearingRenovationDeductionActions":
            childRearingRenovationDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/energySavingRenovationDeductionActions":
            energySavingRenovationDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/distributionAdjustedForeignTaxCreditActions":
            distributionAdjustedForeignTaxCreditActionsStandaloneAliasForTurbopack,
          "@/lib/durabilityImprovementRenovationDeductionActions":
            durabilityImprovementRenovationDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/multiHouseholdRenovationDeductionActions":
            multiHouseholdRenovationDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/residentTaxAdjustmentDeductionActions":
            residentTaxAdjustmentDeductionActionsStandaloneAliasForTurbopack,
          "@/lib/certifiedHousingConstructionCreditActions":
            certifiedHousingConstructionCreditActionsStandaloneAliasForTurbopack,
          "@/lib/casualtyLossCarryforwardActions":
            casualtyLossCarryforwardActionsStandaloneAliasForTurbopack,
          "@/lib/angelTaxLossCarryforwardActions":
            angelTaxLossCarryforwardActionsStandaloneAliasForTurbopack,
          "@/lib/foreignTaxCreditActions": foreignTaxCreditActionsStandaloneAliasForTurbopack,
          "@/lib/homeSaleLossCarryforwardActions":
            homeSaleLossCarryforwardActionsStandaloneAliasForTurbopack,
          "@/lib/homeReplacementLossCarryforwardActions":
            homeReplacementLossCarryforwardActionsStandaloneAliasForTurbopack,
          "@/lib/brokerAnnualReportActions":
            brokerAnnualReportActionsStandaloneAliasForTurbopack,
          "@/lib/marketPriceActions": marketPriceActionsStandaloneAliasForTurbopack,
          "@/lib/assetSymbolMappingActions":
            assetSymbolMappingActionsStandaloneAliasForTurbopack,
          "@/lib/cryptoTradeActions": cryptoTradeActionsStandaloneAliasForTurbopack,
          "@/lib/cryptoCreditTradeActions":
            cryptoCreditTradeActionsStandaloneAliasForTurbopack,
          "@/lib/cryptoMarginTradeActions":
            cryptoMarginTradeActionsStandaloneAliasForTurbopack,
          "@/lib/futuresTradeActions": futuresTradeActionsStandaloneAliasForTurbopack,
          "@/lib/investmentTradeActions":
            investmentTradeActionsStandaloneAliasForTurbopack,
          "@/lib/stockMarginTradeActions":
            stockMarginTradeActionsStandaloneAliasForTurbopack,
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
          "@/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository":
            defaultDistributionAdjustedForeignTaxCreditRecordRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultCryptoTradeRepository":
            defaultCryptoTradeRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultCryptoMarginTradeRepository":
            defaultCryptoMarginTradeRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultCryptoCreditTradeRepository":
            defaultCryptoCreditTradeRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultInvestmentTradeRepository":
            defaultInvestmentTradeRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultStockMarginTradeRepository":
            defaultStockMarginTradeRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultFuturesTradeRepository":
            defaultFuturesTradeRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultInvestmentLossCarryforwardRepository":
            defaultInvestmentLossCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultFuturesLossCarryforwardRepository":
            defaultFuturesLossCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultNisaLifetimeQuotaRepository":
            defaultNisaLifetimeQuotaRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultAssetBalanceSnapshotRepository":
            defaultAssetBalanceSnapshotRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultBrokerAnnualReportRepository":
            defaultBrokerAnnualReportRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultOpeningBalanceByInstitutionRepository":
            defaultOpeningBalanceByInstitutionRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultAssetSymbolMappingRepository":
            defaultAssetSymbolMappingRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultMarketPriceRepository":
            defaultMarketPriceRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultCasualtyLossCarryforwardRepository":
            defaultCasualtyLossCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultAngelTaxLossCarryforwardRepository":
            defaultAngelTaxLossCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository":
            defaultForeignTaxCreditCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository":
            defaultForeignTaxCreditSpareLimitCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultHomeSaleLossCarryforwardRepository":
            defaultHomeSaleLossCarryforwardRepositoryStandaloneAliasForTurbopack,
          "@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository":
            defaultHomeReplacementLossCarryforwardRepositoryStandaloneAliasForTurbopack,
        },
      }
    : {},
  webpack(config) {
    if (isStandaloneBuild) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/lib/authUi": authUiStandaloneAliasForWebpack,
        "@/lib/exportUi": exportUiStandaloneAliasForWebpack,
        "@/lib/incomeDeductionActions": incomeDeductionActionsStandaloneAliasForWebpack,
        "@/lib/employmentIncomeActions": employmentIncomeActionsStandaloneAliasForWebpack,
        "@/lib/barrierFreeRenovationDeductionActions":
          barrierFreeRenovationDeductionActionsStandaloneAliasForWebpack,
        "@/lib/earthquakeRenovationDeductionActions":
          earthquakeRenovationDeductionActionsStandaloneAliasForWebpack,
        "@/lib/donationTaxCreditActions": donationTaxCreditActionsStandaloneAliasForWebpack,
        "@/lib/mortgageDeductionActions": mortgageDeductionActionsStandaloneAliasForWebpack,
        "@/lib/childRearingRenovationDeductionActions":
          childRearingRenovationDeductionActionsStandaloneAliasForWebpack,
        "@/lib/energySavingRenovationDeductionActions":
          energySavingRenovationDeductionActionsStandaloneAliasForWebpack,
        "@/lib/distributionAdjustedForeignTaxCreditActions":
          distributionAdjustedForeignTaxCreditActionsStandaloneAliasForWebpack,
        "@/lib/durabilityImprovementRenovationDeductionActions":
          durabilityImprovementRenovationDeductionActionsStandaloneAliasForWebpack,
        "@/lib/multiHouseholdRenovationDeductionActions":
          multiHouseholdRenovationDeductionActionsStandaloneAliasForWebpack,
        "@/lib/residentTaxAdjustmentDeductionActions":
          residentTaxAdjustmentDeductionActionsStandaloneAliasForWebpack,
        "@/lib/certifiedHousingConstructionCreditActions":
          certifiedHousingConstructionCreditActionsStandaloneAliasForWebpack,
        "@/lib/casualtyLossCarryforwardActions":
          casualtyLossCarryforwardActionsStandaloneAliasForWebpack,
        "@/lib/angelTaxLossCarryforwardActions":
          angelTaxLossCarryforwardActionsStandaloneAliasForWebpack,
        "@/lib/foreignTaxCreditActions": foreignTaxCreditActionsStandaloneAliasForWebpack,
        "@/lib/homeSaleLossCarryforwardActions":
          homeSaleLossCarryforwardActionsStandaloneAliasForWebpack,
        "@/lib/homeReplacementLossCarryforwardActions":
          homeReplacementLossCarryforwardActionsStandaloneAliasForWebpack,
        "@/lib/brokerAnnualReportActions":
          brokerAnnualReportActionsStandaloneAliasForWebpack,
        "@/lib/marketPriceActions": marketPriceActionsStandaloneAliasForWebpack,
        "@/lib/assetSymbolMappingActions":
          assetSymbolMappingActionsStandaloneAliasForWebpack,
        "@/lib/cryptoTradeActions": cryptoTradeActionsStandaloneAliasForWebpack,
        "@/lib/cryptoCreditTradeActions":
          cryptoCreditTradeActionsStandaloneAliasForWebpack,
        "@/lib/cryptoMarginTradeActions":
          cryptoMarginTradeActionsStandaloneAliasForWebpack,
        "@/lib/futuresTradeActions": futuresTradeActionsStandaloneAliasForWebpack,
        "@/lib/investmentTradeActions": investmentTradeActionsStandaloneAliasForWebpack,
        "@/lib/stockMarginTradeActions": stockMarginTradeActionsStandaloneAliasForWebpack,
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
        "@/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository":
          defaultDistributionAdjustedForeignTaxCreditRecordRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultCryptoTradeRepository":
          defaultCryptoTradeRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultCryptoMarginTradeRepository":
          defaultCryptoMarginTradeRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultCryptoCreditTradeRepository":
          defaultCryptoCreditTradeRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultInvestmentTradeRepository":
          defaultInvestmentTradeRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultStockMarginTradeRepository":
          defaultStockMarginTradeRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultFuturesTradeRepository":
          defaultFuturesTradeRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultInvestmentLossCarryforwardRepository":
          defaultInvestmentLossCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultFuturesLossCarryforwardRepository":
          defaultFuturesLossCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultNisaLifetimeQuotaRepository":
          defaultNisaLifetimeQuotaRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultAssetBalanceSnapshotRepository":
          defaultAssetBalanceSnapshotRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultBrokerAnnualReportRepository":
          defaultBrokerAnnualReportRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultOpeningBalanceByInstitutionRepository":
          defaultOpeningBalanceByInstitutionRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultAssetSymbolMappingRepository":
          defaultAssetSymbolMappingRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultMarketPriceRepository":
          defaultMarketPriceRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultCasualtyLossCarryforwardRepository":
          defaultCasualtyLossCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultAngelTaxLossCarryforwardRepository":
          defaultAngelTaxLossCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository":
          defaultForeignTaxCreditCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository":
          defaultForeignTaxCreditSpareLimitCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultHomeSaleLossCarryforwardRepository":
          defaultHomeSaleLossCarryforwardRepositoryStandaloneAliasForWebpack,
        "@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository":
          defaultHomeReplacementLossCarryforwardRepositoryStandaloneAliasForWebpack,
      };
    }
    return config;
  },
};

export default nextConfig;
