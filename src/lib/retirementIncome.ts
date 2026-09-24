import { Decimal } from "decimal.js";
import { nationalIncomeTaxWithSurtaxJpy, RESIDENT_TAX_RATE } from "./incomeTax";

/**
 * 退職金(退職手当等)を受け取った場合の退職所得の金額・源泉徴収されるべき
 * 所得税額(復興特別所得税を含む)・住民税額の目安を試算する(所得税法30条、
 * 国税庁タックスアンサーNo.1420「退職金を受け取ったとき(退職所得)」・
 * No.2740「勤続年数が5年以下の者に対する退職手当等(短期退職手当等)」
 * (令和4年1月1日以後の支払分から適用)に基づく)。
 *
 * **確定申告との関係:** 退職所得は他の所得と合算しない分離課税で、支払者に
 * 「退職所得の受給に関する申告書」を提出していれば、その時点の源泉徴収で
 * 所得税の課税関係が完結し原則として確定申告は不要(所得税法121条2項)。
 * 住民税も他の所得(翌年度課税)とは異なり「現年分離課税」(支給された年に
 * 特別徴収で完結し、翌年度の住民税額には影響しない)である(富田林市・
 * 三鷹市等、複数の自治体公式ページで確認済み)。本モジュールはこの源泉徴収
 * されるべき額の検算、または申告書未提出(一律20.42%源泉徴収)等により
 * 還付を受けるための確定申告が必要になった場合の参考値を試算するもので、
 * 他の単体試算画面(`publicPensionIncome.ts`等)と同様`/tax-estimate`等の
 * 他の試算結果への自動反映は行わない。
 *
 * **対象範囲外:** 同一年中に2か所以上から退職金を受け取る場合・前年以前
 * 4年以内(確定拠出年金の老齢一時金がある場合は19年以内)に他の退職金を
 * 受け取っている場合の勤続年数の重複排除計算は、それぞれ個別の受給履歴に
 * 依存するため対象外とし、単一の退職金・単一の勤続年数のみを扱う。
 */

export type RetirementIncomeCategory = "GENERAL" | "SPECIFIED_OFFICER" | "SHORT_TERM";

/** 短期退職手当等について2分の1課税の適用が無くなる「収入金額-退職所得控除額」の閾値 */
const SHORT_TERM_THRESHOLD_JPY = 3_000_000;

export interface RetirementIncomeInput {
  /** 退職金の収入金額(源泉徴収前の額面) */
  incomeJpy: Decimal.Value;
  /**
   * 勤続年数。1年未満の端数は1年に切り上げて退職所得控除額を計算する
   * (例: 10年3か月なら11年として計算するため10.25を入力する)。
   */
  yearsOfService: number;
  /** 障害者になったことが直接の原因で退職したか(退職所得控除額に100万円加算) */
  isDisabilityRelated?: boolean;
  /**
   * 区分。省略時はGENERAL(一般の退職手当等。2分の1課税をそのまま適用)。
   * SPECIFIED_OFFICER: 役員等勤続年数5年以下の役員等(取締役・執行役・国会議員等)が
   * 受け取る特定役員退職手当等(2分の1課税の適用なし)。SHORT_TERM: 役員等以外の
   * 勤続年数5年以下の短期退職手当等(「収入金額-退職所得控除額」が300万円を
   * 超える部分についてのみ2分の1課税の適用なし)。区分の判定自体(役員等かどうか等)は
   * ユーザー自身の確認に委ねる。
   */
  category?: RetirementIncomeCategory;
}

export interface RetirementIncomeResult {
  category: RetirementIncomeCategory;
  /** 退職所得控除額 */
  deductionJpy: Decimal;
  /** 退職所得の金額 */
  retirementIncomeJpy: Decimal;
  /** 所得税額の目安(復興特別所得税を含む。速算表を退職所得の金額単独に適用) */
  nationalTaxJpy: Decimal;
  /** 住民税額の目安(所得割10%固定。実際は現年分離課税で支給時の特別徴収により完結する) */
  residentTaxJpy: Decimal;
  notes: string[];
}

/**
 * 退職所得控除額を計算する(所得税法30条3項)。
 * 勤続年数20年以下: 40万円×勤続年数(80万円に満たない場合は80万円)。
 * 勤続年数20年超: 800万円+70万円×(勤続年数-20年)。
 * 障害者になったことが直接の原因の退職の場合はさらに100万円を加算する。
 */
export function calculateRetirementIncomeDeductionJpy(
  yearsOfService: number,
  isDisabilityRelated = false,
): Decimal {
  if (yearsOfService <= 0) {
    throw new Error("勤続年数は0より大きい必要があります");
  }
  // 1年未満の端数は1年に切り上げる
  const years = new Decimal(Math.ceil(yearsOfService));
  const base = years.lessThanOrEqualTo(20)
    ? Decimal.max(years.times(400_000), 800_000)
    : new Decimal(8_000_000).plus(years.minus(20).times(700_000));
  return isDisabilityRelated ? base.plus(1_000_000) : base;
}

export function estimateRetirementIncome(input: RetirementIncomeInput): RetirementIncomeResult {
  const incomeJpy = new Decimal(input.incomeJpy);
  if (incomeJpy.isNegative()) {
    throw new Error("退職金の収入金額は0以上である必要があります");
  }

  const category = input.category ?? "GENERAL";
  const deductionJpy = calculateRetirementIncomeDeductionJpy(
    input.yearsOfService,
    input.isDisabilityRelated ?? false,
  );
  const excessJpy = Decimal.max(incomeJpy.minus(deductionJpy), 0);

  const notes: string[] = [];
  let retirementIncomeJpy: Decimal;

  if (excessJpy.isZero()) {
    retirementIncomeJpy = new Decimal(0);
    notes.push("収入金額が退職所得控除額以下のため、退職所得の金額は0円になる。");
  } else if (category === "SPECIFIED_OFFICER") {
    retirementIncomeJpy = excessJpy;
    notes.push(
      "役員等勤続年数5年以下の特定役員退職手当等に該当するため2分の1課税は適用せず、「収入金額-退職所得控除額」をそのまま退職所得の金額とした。",
    );
  } else if (category === "SHORT_TERM" && excessJpy.greaterThan(SHORT_TERM_THRESHOLD_JPY)) {
    retirementIncomeJpy = new Decimal(1_500_000).plus(excessJpy.minus(SHORT_TERM_THRESHOLD_JPY));
    notes.push(
      "役員等以外の勤続年数5年以下の短期退職手当等で「収入金額-退職所得控除額」が300万円を超えるため、300万円以下の部分のみ2分の1課税とし(300万円超の部分は全額)、退職所得の金額=150万円+(「収入金額-退職所得控除額」-300万円)で計算した。",
    );
  } else {
    retirementIncomeJpy = excessJpy.dividedBy(2);
    if (category === "SHORT_TERM") {
      notes.push(
        "短期退職手当等だが「収入金額-退職所得控除額」が300万円以下のため、通常どおり2分の1課税を適用した。",
      );
    }
  }

  const nationalTaxJpy = nationalIncomeTaxWithSurtaxJpy(retirementIncomeJpy);
  const residentTaxJpy = retirementIncomeJpy.times(RESIDENT_TAX_RATE);

  notes.push(
    "退職所得は他の所得と合算しない分離課税のため、所得税額は退職所得の金額単独に所得税の速算表を適用した目安(基礎控除等、他の所得控除は考慮しない)。住民税は現年分離課税(支給された年に特別徴収で完結し翌年度課税には影響しない)のため所得割10%固定の目安とした(均等割は含まない)。「退職所得の受給に関する申告書」を提出済みであれば、通常はこれらの金額が支払時に源泉徴収・特別徴収されて課税関係が完結し確定申告は不要。",
  );
  notes.push(
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値(実務上は退職所得の金額の1,000円未満切り捨て等の端数処理がある)。",
  );

  return { category, deductionJpy, retirementIncomeJpy, nationalTaxJpy, residentTaxJpy, notes };
}
