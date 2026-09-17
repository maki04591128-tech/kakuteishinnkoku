import { Decimal } from "decimal.js";
import type { CryptoCostMethod, CryptoSymbolYearResult } from "../crypto/calculator";
import type { CryptoMarginSymbolYearResult } from "../crypto/marginCalculator";
import type { InvestmentSymbolYearResult } from "../investment/calculator";
import type { FuturesSymbolYearResult } from "../investment/futuresIncome";
import type { IncomeDeductionSummary, IncomeDeductionType } from "../incomeDeduction";
import { INCOME_DEDUCTION_TYPE_LABELS } from "../incomeDeduction";
import type { TaxFilingSummary } from "./summary";

const CRYPTO_COST_METHOD_LABEL: Record<CryptoCostMethod, string> = {
  AVERAGE: "総平均法",
  MOVING_AVERAGE: "移動平均法",
};

/**
 * 所得控除試算結果(`IncomeDeduction`テーブル登録分)を下書きCSVに転記する際の、
 * 申告書での主な記載箇所の対応表。区分ごとに専用の試算画面はあるが、実際に
 * 転記する申告書の欄は共通のフォーマットのため、ここで一元管理する。
 */
const INCOME_DEDUCTION_FILING_LOCATION: Record<IncomeDeductionType, string> = {
  MEDICAL_EXPENSE:
    "申告書第一表 所得から差し引かれる金額(医療費控除) / 医療費控除の明細書",
  LIFE_INSURANCE:
    "申告書第一表 所得から差し引かれる金額(生命保険料控除) / 第二表 保険料控除等に関する事項",
  SMALL_BUSINESS_MUTUAL_AID:
    "申告書第一表 所得から差し引かれる金額(小規模企業共済等掛金控除) / 第二表 保険料控除等に関する事項",
  SOCIAL_INSURANCE:
    "申告書第一表 所得から差し引かれる金額(社会保険料控除) / 第二表 保険料控除等に関する事項",
  SELF_MEDICATION:
    "申告書第一表 所得から差し引かれる金額(医療費控除・セルフメディケーション税制の特例) / セルフメディケーション税制の明細書",
  SPOUSE:
    "申告書第一表 所得から差し引かれる金額(配偶者(特別)控除) / 第二表 配偶者や親族に関する事項",
  DEPENDENT:
    "申告書第一表 所得から差し引かれる金額(扶養控除) / 第二表 配偶者や親族に関する事項",
  BASIC: "申告書第一表 所得から差し引かれる金額(基礎控除)",
};

/**
 * 「確定申告書等作成コーナー」への入力を補助するための集計CSVを生成する。
 *
 * 重要: これは国税庁が定めるインポート用の公式データ形式ではない。
 * e-Taxへの送信自体は必ず本人が「確定申告書等作成コーナー」または
 * 「e-Taxソフト」上でマイナンバーカード等により行う必要があるため、
 * 本CSVはあくまで入力内容を確認・転記するための下書き資料として扱うこと。
 * (将来、国税庁公表の暗号資産計算結果CSV仕様等を確認できた場合は、
 *  別途 exportOfficialXxxCsv() のような形で公式形式の出力を追加する。)
 */

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatYen(value: Decimal): string {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString();
}

function toCsvLine(fields: (string | number)[]): string {
  return fields.map((f) => csvEscape(String(f))).join(",");
}

export function buildTaxFilingDraftCsv(
  summary: TaxFilingSummary,
  cryptoDetail: CryptoSymbolYearResult[],
  investmentDetail: InvestmentSymbolYearResult[],
  cryptoCostMethod: CryptoCostMethod = "AVERAGE",
  cryptoMarginDetail: CryptoMarginSymbolYearResult[] = [],
  futuresDetail: FuturesSymbolYearResult[] = [],
  incomeDeductions?: IncomeDeductionSummary,
): string {
  const lines: string[] = [];

  lines.push(
    toCsvLine([
      "# このファイルは国税庁の公式インポート形式ではありません。確定申告書等作成コーナーへ転記する際の下書き資料です。",
    ]),
  );
  lines.push(toCsvLine([`# 対象年分: ${summary.year}年分`]));
  lines.push("");

  lines.push(toCsvLine(["■ 所得区分別サマリー"]));
  lines.push(toCsvLine(["区分", "金額(円)", "申告書での主な記載箇所"]));
  lines.push(
    toCsvLine([
      "雑所得(暗号資産・現物+証拠金取引の合計)",
      formatYen(summary.cryptoMiscIncomeJpy),
      "申告書第一表 雑所得(業務・その他) / 第二表 雑所得の内訳",
    ]),
  );
  if (!summary.cryptoMarginIncomeJpy.isZero()) {
    lines.push(
      toCsvLine([
        "  内訳: 現物取引分",
        formatYen(summary.cryptoSpotIncomeJpy),
        "",
      ]),
    );
    lines.push(
      toCsvLine([
        "  内訳: 証拠金(レバレッジ)取引の決済損益分",
        formatYen(summary.cryptoMarginIncomeJpy),
        "",
      ]),
    );
  }
  lines.push(
    toCsvLine([
      "譲渡所得(上場株式等・申告分離課税)",
      formatYen(summary.investmentCapitalGainJpy),
      "申告書第三表(分離課税用) / 株式等に係る譲渡所得等の金額の計算明細書",
    ]),
  );
  lines.push(
    toCsvLine([
      "配当所得",
      formatYen(summary.investmentDividendJpy),
      "申告書第一表 配当所得 / 第二表 配当所得の内訳(課税方式の選択に注意)",
    ]),
  );
  lines.push(
    toCsvLine([
      "先物取引に係る雑所得等(FX・先物・CFD等。繰越控除適用前)",
      formatYen(summary.futuresLossCarryforward.grossRealizedGainJpy),
      "申告書第三表(分離課税用) / 先物取引に係る雑所得等の金額の計算明細書",
    ]),
  );
  lines.push("");

  if (incomeDeductions && incomeDeductions.entries.length > 0) {
    lines.push(toCsvLine(["■ 所得控除サマリー(各試算画面で登録済みの分)"]));
    lines.push(
      toCsvLine([
        "区分",
        "所得税の控除額(円)",
        "住民税の控除額(円)",
        "申告書での主な記載箇所",
      ]),
    );
    for (const entry of incomeDeductions.entries) {
      lines.push(
        toCsvLine([
          INCOME_DEDUCTION_TYPE_LABELS[entry.type],
          formatYen(entry.incomeTaxAmountJpy),
          formatYen(entry.residentTaxAmountJpy),
          INCOME_DEDUCTION_FILING_LOCATION[entry.type],
        ]),
      );
    }
    lines.push(
      toCsvLine([
        "合計(併用不可の医療費控除/セルフメディケーション税制は有利な方のみ計上)",
        formatYen(incomeDeductions.totalIncomeTaxAmountJpy),
        formatYen(incomeDeductions.totalResidentTaxAmountJpy),
        "",
      ]),
    );
    for (const note of incomeDeductions.notes) {
      lines.push(toCsvLine([`# ${note}`]));
    }
    lines.push(
      toCsvLine([
        "# 上記以外の所得控除(社会保険料控除の対象とならない任意保険料等)は本ツールでは試算していないため各自申告書に転記すること。",
      ]),
    );
    lines.push("");
  }

  const carryforward = summary.investmentLossCarryforward;
  if (
    carryforward.totalUsedJpy.greaterThan(0) ||
    carryforward.newLossJpy.greaterThan(0) ||
    carryforward.carryforwardToNextYear.length > 0 ||
    carryforward.expiredByOriginYear.length > 0
  ) {
    lines.push(toCsvLine(["■ 上場株式等の譲渡損失の繰越控除(3年間)"]));
    lines.push(
      toCsvLine([
        "繰越控除の使用額(発生年の古い順に控除)",
        formatYen(carryforward.totalUsedJpy),
        "申告書第三表 / 第四表(損失申告用)",
      ]),
    );
    lines.push(
      toCsvLine([
        "繰越控除後の譲渡所得(課税対象額)",
        formatYen(carryforward.taxableGainJpy),
        "申告書第三表(分離課税用)",
      ]),
    );
    if (carryforward.newLossJpy.greaterThan(0)) {
      lines.push(
        toCsvLine([
          `${summary.year}年分の新規譲渡損失(翌年以後3年間繰越可能)`,
          formatYen(carryforward.newLossJpy),
          "申告書第四表(損失申告用)",
        ]),
      );
    }
    for (const c of carryforward.carryforwardToNextYear) {
      lines.push(
        toCsvLine([
          `${c.originYear}年分発生分の翌年繰越残高`,
          formatYen(c.remainingAmountJpy),
          `控除期限: ${c.originYear + 3}年分まで`,
        ]),
      );
    }
    for (const e of carryforward.expiredByOriginYear) {
      lines.push(
        toCsvLine([
          `${e.originYear}年分発生分(控除期限切れ)`,
          formatYen(e.expiredAmountJpy),
          "控除期限(3年)を超えたため繰越不可",
        ]),
      );
    }
    lines.push("");
  }

  const futuresCarryforward = summary.futuresLossCarryforward;
  if (
    futuresCarryforward.totalUsedJpy.greaterThan(0) ||
    futuresCarryforward.newLossJpy.greaterThan(0) ||
    futuresCarryforward.carryforwardToNextYear.length > 0 ||
    futuresCarryforward.expiredByOriginYear.length > 0
  ) {
    lines.push(toCsvLine(["■ 先物取引に係る雑所得等の繰越控除(3年間・FX/先物/CFD等)"]));
    lines.push(
      toCsvLine([
        "繰越控除の使用額(発生年の古い順に控除)",
        formatYen(futuresCarryforward.totalUsedJpy),
        "申告書第三表 / 第四表(損失申告用)",
      ]),
    );
    lines.push(
      toCsvLine([
        "繰越控除後の課税対象額",
        formatYen(futuresCarryforward.taxableGainJpy),
        "申告書第三表(分離課税用)",
      ]),
    );
    if (futuresCarryforward.newLossJpy.greaterThan(0)) {
      lines.push(
        toCsvLine([
          `${summary.year}年分の新規損失(翌年以後3年間繰越可能)`,
          formatYen(futuresCarryforward.newLossJpy),
          "申告書第四表(損失申告用)",
        ]),
      );
    }
    for (const c of futuresCarryforward.carryforwardToNextYear) {
      lines.push(
        toCsvLine([
          `${c.originYear}年分発生分の翌年繰越残高`,
          formatYen(c.remainingAmountJpy),
          `控除期限: ${c.originYear + 3}年分まで`,
        ]),
      );
    }
    for (const e of futuresCarryforward.expiredByOriginYear) {
      lines.push(
        toCsvLine([
          `${e.originYear}年分発生分(控除期限切れ)`,
          formatYen(e.expiredAmountJpy),
          "控除期限(3年)を超えたため繰越不可",
        ]),
      );
    }
    lines.push("");
  }

  lines.push(toCsvLine([`■ 暗号資産 銘柄別内訳(${CRYPTO_COST_METHOD_LABEL[cryptoCostMethod]})`]));
  lines.push(
    toCsvLine([
      "銘柄",
      "期首数量",
      "年間取得数量",
      "平均取得単価(円)",
      "年間譲渡数量",
      "譲渡収入合計(円)",
      "譲渡原価(円)",
      "受取時収入(マイニング等)(円)",
      "損益(雑所得算入額)(円)",
      "期末数量",
    ]),
  );
  for (const r of cryptoDetail) {
    lines.push(
      toCsvLine([
        r.symbol,
        r.openingQuantity.toString(),
        r.acquiredQuantity.toString(),
        formatYen(r.averageUnitCostJpy),
        r.disposedQuantity.toString(),
        formatYen(r.proceedsJpy),
        formatYen(r.costOfDisposedJpy),
        formatYen(r.incomeJpy),
        formatYen(r.realizedGainJpy),
        r.closingQuantity.toString(),
      ]),
    );
  }
  lines.push("");

  if (cryptoMarginDetail.length > 0) {
    lines.push(toCsvLine(["■ 暗号資産 証拠金(レバレッジ)取引 銘柄別内訳(決済損益)"]));
    lines.push(
      toCsvLine(["銘柄", "決済件数", "決済損益(円)", "手数料(円)", "スワップ等(円)", "雑所得算入額(円)"]),
    );
    for (const r of cryptoMarginDetail) {
      lines.push(
        toCsvLine([
          r.symbol,
          r.settlementCount,
          formatYen(r.grossPnlJpy),
          formatYen(r.feeJpy),
          formatYen(r.swapJpy),
          formatYen(r.realizedGainJpy),
        ]),
      );
    }
    lines.push("");
  }

  lines.push(toCsvLine(["■ 株式等 銘柄別内訳(移動平均法・課税口座分)"]));
  lines.push(
    toCsvLine([
      "銘柄",
      "期首数量",
      "年間買付数量",
      "年間売却数量",
      "譲渡収入合計(円)",
      "譲渡原価(円)",
      "譲渡損益(円)",
      "配当等(円)",
      "期末数量",
    ]),
  );
  for (const r of investmentDetail) {
    lines.push(
      toCsvLine([
        r.symbol,
        r.openingQuantity.toString(),
        r.buyQuantity.toString(),
        r.sellQuantity.toString(),
        formatYen(r.proceedsJpy),
        formatYen(r.costOfSoldJpy),
        formatYen(r.realizedGainJpy),
        formatYen(r.dividendJpy),
        r.closingQuantity.toString(),
      ]),
    );
  }

  if (futuresDetail.length > 0) {
    lines.push("");
    lines.push(toCsvLine(["■ 先物取引・FX 銘柄別内訳(先物取引に係る雑所得等・決済損益)"]));
    lines.push(
      toCsvLine(["銘柄", "決済件数", "決済損益(円)", "手数料(円)", "スワップ等(円)", "雑所得算入額(円)"]),
    );
    for (const r of futuresDetail) {
      lines.push(
        toCsvLine([
          r.symbol,
          r.settlementCount,
          formatYen(r.grossPnlJpy),
          formatYen(r.feeJpy),
          formatYen(r.swapJpy),
          formatYen(r.realizedGainJpy),
        ]),
      );
    }
  }

  // Excelで文字化けしないようUTF-8 BOM付きで返す(呼び出し側でファイル化する際に付与)
  return lines.join("\n");
}

export const UTF8_BOM = "﻿";
