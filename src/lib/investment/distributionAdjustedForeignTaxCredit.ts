import { Decimal } from "decimal.js";
import { prisma } from "../db";

/**
 * 分配時調整外国税相当額控除(所得税法93条の2)。
 *
 * 投資信託等(集団投資信託)が国外資産から生じた利子・配当等を受け取る際、
 * 現地で外国所得税が源泉徴収されることがある。この外国所得税額のうち、
 * 信託段階で必要経費又は取得費に算入されず、分配時に受益者の各種所得の
 * 金額の計算上も控除されない部分に相当する金額(分配時調整外国税相当額)を、
 * その受益者のその年分の所得税額から控除できる制度。証券会社が発行する
 * 特定口座年間取引報告書には配当等の内訳として「分配時調整外国税相当額」
 * の欄がある。
 *
 * `investment/foreignTaxCredit.ts`の外国税額控除(所得税法95条)とは別の制度で、
 * 次の点が異なる。
 *  - 対象: 外国税額控除は「国外で発行された株式・投資信託等」(isForeign=true)
 *    からの配当等が対象だが、分配時調整外国税相当額控除は投資信託自体が
 *    国外資産を組み入れている場合に生じるため、国内籍の投資信託・ETFの
 *    分配金にも生じうる(isForeignとは独立)。
 *  - 限度額: 外国税額控除は所得税・復興特別所得税・住民税それぞれに複雑な
 *    控除限度額の計算が必要だが、分配時調整外国税相当額は信託段階で
 *    既に按分計算された金額のため、追加の限度額計算は無く、その年分の
 *    所得税額(復興特別所得税を含む)を上限にそのまま控除できる。
 *  - 繰越: 外国税額控除の控除限度超過額・控除余裕額のような繰越制度は無い
 *    (控除しきれなかった分はその年限りで切り捨て)。
 *
 * **制約:** 住民税についてはこの控除に相当する制度が存在しない(所得税・
 * 復興特別所得税のみの制度)。三菱UFJモルガン・スタンレー証券の投資信託等に
 * 係る二重課税調整制度に関する案内で「住民税について、二重課税調整制度の
 * 適用はありません」と明記されているほか、三井住友信託銀行の案内でも
 * 住民税分の税額計算式には通知外国税相当額(分配時調整外国税相当額)による
 * 控除が組み込まれていないことが確認できる。複数の独立した情報源で一致した
 * ため、以前の版で「今後の課題」としていた住民税分の扱いは、未対応ではなく
 * 制度上存在しない恒久的な対象外である旨に修正した(計算ロジック自体に変更は
 * 無い)。
 */

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export interface DistributionAdjustedForeignTaxCreditInput {
  /** 特定口座年間取引報告書等に記載された分配時調整外国税相当額の合計(円) */
  distributionAdjustedForeignTaxJpy: Decimal.Value;
  /** この控除を適用する前の、その年分の所得税額(復興特別所得税を含む) */
  nationalTaxBeforeCreditJpy: Decimal.Value;
}

export interface DistributionAdjustedForeignTaxCreditResult {
  distributionAdjustedForeignTaxJpy: Decimal;
  nationalTaxBeforeCreditJpy: Decimal;
  /** 実際に適用される控除額(入力値と適用前の所得税額のいずれか少ない方。繰越なし) */
  creditJpy: Decimal;
  notes: string[];
}

/**
 * 分配時調整外国税相当額控除の控除額を試算する。DBに依存しない純粋関数。
 * 外国税額控除のような限度額計算は無く、その年分の所得税額(復興特別所得税を
 * 含む)を上限にそのまま控除する単純な計算のため、上限判定のみを行う。
 */
export function estimateDistributionAdjustedForeignTaxCredit(
  input: DistributionAdjustedForeignTaxCreditInput,
): DistributionAdjustedForeignTaxCreditResult {
  const distributionAdjustedForeignTaxJpy = new Decimal(input.distributionAdjustedForeignTaxJpy);
  const nationalTaxBeforeCreditJpy = new Decimal(input.nationalTaxBeforeCreditJpy);

  requireNonNegative(distributionAdjustedForeignTaxJpy, "分配時調整外国税相当額");
  requireNonNegative(nationalTaxBeforeCreditJpy, "控除適用前の所得税額");

  const creditJpy = Decimal.min(distributionAdjustedForeignTaxJpy, nationalTaxBeforeCreditJpy);

  const notes: string[] = [
    "外国税額控除(所得税法95条)と異なり控除限度額の計算・繰越控除は無く、その年分の所得税額(復興特別所得税を含む)を上限にそのまま控除する。",
    "住民税についてはこの控除に相当する制度が存在しないため、所得税・復興特別所得税分のみを控除する。",
  ];
  if (creditJpy.lessThan(distributionAdjustedForeignTaxJpy)) {
    notes.push(
      "分配時調整外国税相当額がその年の所得税額を上回ったため、超過分は切り捨てて0円を下限とした(繰越・還付は生じない)。",
    );
  }

  return {
    distributionAdjustedForeignTaxJpy,
    nationalTaxBeforeCreditJpy,
    creditJpy,
    notes,
  };
}

export interface DistributionAdjustedForeignTaxCreditRecordEntry {
  taxYear: number;
  /** その年分の控除額(所得税・復興特別所得税分。DistributionAdjustedForeignTaxCreditResult.creditJpy) */
  creditJpy: Decimal;
}

/**
 * `/distribution-adjusted-foreign-tax-credit`で登録済みの、指定した年分の
 * 分配時調整外国税相当額控除額をDBから読み出す。外国税額控除
 * (`getForeignTaxCreditRecord`)と同様、下書きCSV(`/api/export`)の税額控除欄・
 * `/tax-estimate`の合計税額試算への自動反映に使う。未登録の年は null を返す。
 */
export async function getDistributionAdjustedForeignTaxCreditRecord(
  year: number,
): Promise<DistributionAdjustedForeignTaxCreditRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.distributionAdjustedForeignTaxCreditRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    creditJpy: new Decimal(record.creditJpy.toString()),
  };
}
