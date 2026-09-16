import { Decimal } from "decimal.js";
import type { CryptoCostMethod, CryptoSymbolYearResult } from "../crypto/calculator";
import type { InvestmentSymbolYearResult } from "../investment/calculator";
import type { TaxFilingSummary } from "./summary";

const CRYPTO_COST_METHOD_LABEL: Record<CryptoCostMethod, string> = {
  AVERAGE: "総平均法",
  MOVING_AVERAGE: "移動平均法",
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
      "雑所得(暗号資産)",
      formatYen(summary.cryptoMiscIncomeJpy),
      "申告書第一表 雑所得(業務・その他) / 第二表 雑所得の内訳",
    ]),
  );
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
  lines.push("");

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

  // Excelで文字化けしないようUTF-8 BOM付きで返す(呼び出し側でファイル化する際に付与)
  return lines.join("\n");
}

export const UTF8_BOM = "﻿";
