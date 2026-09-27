import { Decimal } from "decimal.js";

/**
 * 住宅耐震改修特別控除(租税特別措置法41条の19の2。`earthquakeRenovationDeduction.ts`)・
 * 住宅特定改修特別税額控除(措置法41条の19の3)のバリアフリー改修
 * (`barrierFreeRenovationDeduction.ts`)・省エネ改修(`energySavingRenovationDeduction.ts`)・
 * 多世帯同居改修(`multiHouseholdRenovationDeduction.ts`)・耐久性向上改修
 * (`durabilityImprovementRenovationDeduction.ts`)・子育て対応改修
 * (`childRearingRenovationDeduction.ts`)の6類型のうち2つ以上を同一年中に併せて行った
 * 場合の、B(増改築等工事費用分)の1,000万円の限度額の合算判定を試算する。
 *
 * 上記の各モジュールはいずれも「この控除は他の改修工事と併用した場合、Bの1,000万円の
 * 限度額を合算して判定する必要があるが、本ツールは単独での適用を前提とし、この合算
 * 判定は行わない(今後の課題)」と明記していたギャップに対応する。
 *
 * 国税庁タックスアンサーNo.1219(省エネ改修)・No.1220(バリアフリー改修)・
 * No.1222(住宅耐震改修)・No.1224(多世帯同居改修)・No.1227(耐久性向上改修)・
 * No.1228(子育て対応改修)のいずれにも共通して次の記載がある(令和8年4月1日現在法令等の
 * No.1219・No.1220・No.1222の本文を直接確認した)。
 *
 *  「この特別控除の適用を受ける場合において、次に掲げる特別控除の適用を併せて
 *   受けるときは、Bの金額は、次の(1)、(2)のいずれか低い金額(1,000万円から
 *   各改修工事に係るAの金額の合計額を控除した金額を限度)となります。
 *    (1) 各改修工事の標準的な費用の額のうち各改修工事に係る控除対象限度額を
 *        超える部分の金額の合計額と、各改修工事と併せて行う増築、改築その他
 *        一定の工事に要した費用の額の合計額との合計額
 *    (2) 各改修工事の標準的な費用の額の合計額」
 *
 * No.1222(住宅耐震改修)の本文には、この合算対象として省エネ・バリアフリー・多世帯
 * 同居・耐久性向上・子育て対応の5類型が明記されており、住宅耐震改修も他の5類型と
 * 同じB(増改築等工事費用分。No.1222注4)を持つため、6類型すべてが同じ1,000万円の
 * 限度額を共有する(住宅耐震改修のBについては`earthquakeRenovationDeduction.ts`の
 * 機能149のコメント参照。旧実装はBを一切計算しない誤りがあったため機能149で修正した)。
 *
 * つまり、6類型を組み合わせて行った場合でも、A(各改修工事の控除対象限度額までの
 * 部分。10%控除)は改修工事ごとに個別の限度額(バリアフリー200万円、省エネ250万円/
 * 350万円、住宅耐震改修250万円等)で計算する一方、B(5%控除)は1,000万円の限度額を
 * 全類型で共有し、「1,000万円から各改修工事のAの合計額を控除した金額」を上限として、
 * 各改修工事の超過分・関連工事費用を合算した金額に適用する。1類型のみを行った場合は、
 * 本モジュールの計算結果は各単体モジュールの計算結果と一致する(単体モジュールのBの
 * 限度額(1,000万円-そのA)がそのまま合算後の限度額になるため)。
 *
 * 端数処理(100円未満切り捨て)は各モジュールと同様、Aに係る控除額・Bに係る控除額を
 * それぞれ算出した後に行う(各改修工事のAごとに端数処理してから合計する)。
 *
 * **入力の前提:** 各改修工事のA(`amountAJpy`)・標準的な費用の額(`standardCostJpy`)は、
 * 対応する単体モジュール(`barrierFreeRenovationDeduction.ts`・
 * `earthquakeRenovationDeduction.ts`等)の計算結果(`estimateXxxRenovationDeduction`の
 * 戻り値)をそのまま入力する。各単体モジュールが行う適用要件判定(合計所得金額・床面積・
 * 工事内容等)は本モジュールでは行わないため、併せて行う改修工事はいずれも単体モジュール
 * で`eligible: true`(住宅耐震改修は`bEligible`にかかわらずA自体は常に対象)であることを
 * 事前に確認すること。
 *
 * **対象外とした範囲(今後の課題):**
 * - 6類型のうち一部の組み合わせに存在しうる「選択適用」の制約(いずれか1つのみしか
 *   適用できない組み合わせ)の判定はユーザー自身の確認事項とする。
 */

export type RenovationCreditCategory =
  | "BARRIER_FREE"
  | "ENERGY_SAVING"
  | "MULTI_HOUSEHOLD"
  | "DURABILITY_IMPROVEMENT"
  | "CHILD_REARING"
  | "EARTHQUAKE";

const AMOUNT_A_CREDIT_RATE = 0.1;
const AMOUNT_B_CREDIT_RATE = 0.05;
const COMBINED_B_LIMIT_JPY = new Decimal(10_000_000);

export interface RenovationCreditCategoryInput {
  category: RenovationCreditCategory;
  /** 対応する単体モジュールの標準的な費用の額(頭打ち前。standardCostJpy) */
  standardCostJpy: Decimal.Value;
  /** 対応する単体モジュールのA(amountAJpy。控除対象限度額までの部分) */
  amountAJpy: Decimal.Value;
  /** 併せて行う増築・改築その他の一定の工事に要した費用の額(補助金等控除後。未入力は0) */
  otherRelatedWorkCostJpy?: Decimal.Value;
}

export interface RenovationCreditCombinationInput {
  categories: RenovationCreditCategoryInput[];
}

export interface RenovationCreditCategoryDetail {
  category: RenovationCreditCategory;
  standardCostJpy: Decimal;
  amountAJpy: Decimal;
  /** 標準的な費用の額のうち控除対象限度額を超える部分(standardCostJpy - amountAJpy) */
  excessOverControlLimitJpy: Decimal;
  otherRelatedWorkCostJpy: Decimal;
  /** この改修工事単独のA分の控除額(100円未満切り捨て) */
  aCreditJpy: Decimal;
}

export interface RenovationCreditCombinationResult {
  categories: RenovationCreditCategoryDetail[];
  /** 各改修工事のAの合計額 */
  totalAJpy: Decimal;
  /** Aに係る控除額の合計(各改修工事ごとに100円未満切り捨てた後の合計) */
  totalACreditJpy: Decimal;
  /** Bの限度額(1,000万円から各改修工事のAの合計額を控除した金額) */
  combinedBLimitJpy: Decimal;
  /** (1) 各改修工事の超過分の合計+関連工事費用の合計 */
  candidate1Jpy: Decimal;
  /** (2) 各改修工事の標準的な費用の額(頭打ち前)の合計 */
  candidate2Jpy: Decimal;
  /** 併用後のB(候補(1)(2)のいずれか低い金額を、Bの限度額で頭打ちした金額) */
  combinedBJpy: Decimal;
  /** Bに係る控除額(100円未満切り捨て) */
  bCreditJpy: Decimal;
  /** 控除額の合計(A分+B分) */
  totalCreditJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

const CATEGORY_LABELS: Record<RenovationCreditCategory, string> = {
  BARRIER_FREE: "バリアフリー改修",
  ENERGY_SAVING: "省エネ改修",
  MULTI_HOUSEHOLD: "多世帯同居改修",
  DURABILITY_IMPROVEMENT: "耐久性向上改修",
  CHILD_REARING: "子育て対応改修",
  EARTHQUAKE: "住宅耐震改修",
};

/**
 * 住宅耐震改修・バリアフリー改修・省エネ改修・多世帯同居改修・耐久性向上改修・
 * 子育て対応改修のうち2つ以上を同一年中に併せて行った場合の、Bの1,000万円の限度額の
 * 合算判定を試算する。DBに依存しない純粋関数。
 */
export function combineRenovationCredits(
  input: RenovationCreditCombinationInput,
): RenovationCreditCombinationResult {
  if (input.categories.length === 0) {
    throw new Error("少なくとも1つの改修工事を入力してください");
  }

  const seen = new Set<RenovationCreditCategory>();
  for (const c of input.categories) {
    if (seen.has(c.category)) {
      throw new Error(`同じ改修工事の種類(${CATEGORY_LABELS[c.category]})が重複しています`);
    }
    seen.add(c.category);
  }

  const categories: RenovationCreditCategoryDetail[] = input.categories.map((c) => {
    const standardCostJpy = new Decimal(c.standardCostJpy);
    const amountAJpy = new Decimal(c.amountAJpy);
    const otherRelatedWorkCostJpy = c.otherRelatedWorkCostJpy
      ? new Decimal(c.otherRelatedWorkCostJpy)
      : new Decimal(0);
    requireNonNegative(standardCostJpy, `${CATEGORY_LABELS[c.category]}の標準的な費用の額`);
    requireNonNegative(amountAJpy, `${CATEGORY_LABELS[c.category]}のA`);
    requireNonNegative(
      otherRelatedWorkCostJpy,
      `${CATEGORY_LABELS[c.category]}に係る増改築等工事費用の額`,
    );
    if (amountAJpy.greaterThan(standardCostJpy)) {
      throw new Error(
        `${CATEGORY_LABELS[c.category]}のAは標準的な費用の額を超えることはできません`,
      );
    }

    const excessOverControlLimitJpy = standardCostJpy.minus(amountAJpy);
    const aCreditJpy = floorToHundredYen(amountAJpy.times(AMOUNT_A_CREDIT_RATE));

    return {
      category: c.category,
      standardCostJpy,
      amountAJpy,
      excessOverControlLimitJpy,
      otherRelatedWorkCostJpy,
      aCreditJpy,
    };
  });

  const totalAJpy = categories.reduce((sum, c) => sum.plus(c.amountAJpy), new Decimal(0));
  const totalACreditJpy = categories.reduce((sum, c) => sum.plus(c.aCreditJpy), new Decimal(0));

  const candidate1Jpy = categories.reduce(
    (sum, c) => sum.plus(c.excessOverControlLimitJpy).plus(c.otherRelatedWorkCostJpy),
    new Decimal(0),
  );
  const candidate2Jpy = categories.reduce((sum, c) => sum.plus(c.standardCostJpy), new Decimal(0));
  const combinedBLimitJpy = Decimal.max(COMBINED_B_LIMIT_JPY.minus(totalAJpy), 0);
  const combinedBBeforeCapJpy = Decimal.min(candidate1Jpy, candidate2Jpy);
  const combinedBJpy = Decimal.min(combinedBBeforeCapJpy, combinedBLimitJpy);
  const bCreditJpy = floorToHundredYen(combinedBJpy.times(AMOUNT_B_CREDIT_RATE));

  const totalCreditJpy = totalACreditJpy.plus(bCreditJpy);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1219・No.1220・No.1222・No.1224・No.1227・No.1228、租税特別措置法41条の19の2・41条の19の3に基づく概算値。住宅耐震改修・バリアフリー改修・省エネ改修・多世帯同居改修・耐久性向上改修・子育て対応改修のうち2つ以上を同一年中に併せて行った場合、Aは改修工事ごとの個別の控除対象限度額で計算する一方、Bは1,000万円の限度額を全類型で共有し、「1,000万円から各改修工事のAの合計額を控除した金額」を上限とする。",
    "各改修工事のA・標準的な費用の額は、対応する単体モジュール(/barrier-free-renovation-deduction・/earthquake-renovation-deduction等)の計算結果(amountAJpy・standardCostJpy)をそのまま入力すること。適用要件(合計所得金額・床面積・工事内容等)の判定は単体モジュール側で行うため、本モジュールでは行わない。",
  ];
  if (combinedBBeforeCapJpy.greaterThan(combinedBLimitJpy)) {
    notes.push(
      "併用後のBが「1,000万円から各改修工事のAの合計額を控除した金額」の限度額を超えるため頭打ちにした。",
    );
  }

  return {
    categories,
    totalAJpy,
    totalACreditJpy,
    combinedBLimitJpy,
    candidate1Jpy,
    candidate2Jpy,
    combinedBJpy,
    bCreditJpy,
    totalCreditJpy,
    notes,
  };
}
