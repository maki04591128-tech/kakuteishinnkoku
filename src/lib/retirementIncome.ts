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
 * **前年以前に他の退職手当等を受け取っている場合の重複排除(所得税法施行令70条):**
 * 前年以前一定期間内に他の退職手当等(前の退職手当等)を受け取っている場合、
 * 勤続期間等のうち今回の退職手当等と重複する期間分は退職所得控除額を二重に
 * 使えないため、重複する勤続年数(1年未満切り捨て)を基に計算した控除額を
 * 今回の控除額から差し引く(国税庁タックスアンサーNo.1420、所得税法施行令70条)。
 * 対象期間は、今回がDC一時金(確定拠出年金の老齢給付金として支給される一時金。
 * 施行令72条3項7号)でなければ前年以前4年内、DC一時金であれば前年以前19年内が
 * 原則だが、令和8年度税制改正により、今回が通常の退職手当等かつ前の退職手当等が
 * 令和8年(2026年)1月1日以後に支払われたDC一時金である場合に限り、対象期間が
 * 前年以前9年内に延長された(受取順序による有利不利の解消が目的。改正前は
 * 前年以前4年内。国税庁「令和8年度税制改正による退職所得課税の見直しについて」・
 * 税理士法人山田&パートナーズ「退職所得控除の調整規定等の見直し」等、複数の
 * 一次情報・専門家解説で確認)。本モジュールはこの重複排除を、ユーザーが前の
 * 退職手当等の支給年・区分(DC一時金かどうか)・重複する勤続年数を直接入力する
 * 方式で試算する(勤続期間の開始日・終了日そのものは扱わないため、重複年数の
 * 算定はユーザー自身が行う前提)。
 *
 * **同一年中に2か所以上から退職手当等を受け取る場合(国税庁タックスアンサーNo.2735、
 * 所得税法施行令69条):** 同一年中に他の支払者からも退職手当等を受け取っている場合、
 * 退職所得控除額はそれぞれの退職手当等ごとに計算するのではなく、すべての退職手当等の
 * 収入金額を合算し、勤続年数も「最も長い勤続期間」を基礎にそれ以外の退職手当等の
 * 勤続期間のうち重複しない部分を加算した年数(1年未満切り上げ)で1回だけ計算する
 * (国税庁タックスアンサーNo.2735「同じ年に2か所以上から退職手当等の支払を受けるとき」)。
 * 本モジュールはこの合算を、ユーザーが他の退職手当等ごとに収入金額・勤続年数・
 * それまでに合算した勤続期間との重複年数を直接入力する方式で試算する(前の退職手当等の
 * 重複排除と同様、勤続期間の開始日・終了日そのものは扱わないため、重複年数の算定は
 * ユーザー自身が行う前提)。前年以前の重複排除(施行令70条)と併用する場合は、この
 * 合算後の勤続年数・収入金額を基に前年以前の重複排除を適用する。
 *
 * **機能109での対応(前の退職手当等が複数件ある場合):** 機能107時点では前の退職手当等を
 * 1件しか指定できなかったが、`priorPayments`を配列にし複数件を同時に指定できるように
 * した。各件ごとに独立して重複排除対象期間(4年内/9年内/19年内)内かどうかを判定し、
 * 対象期間内にあるものの重複勤続年数(1年未満切り捨て)の合計を基に、控除額を1回だけ
 * 計算して差し引く(所得税法施行令70条)。合計が今回の勤続年数を超える場合は今回の
 * 勤続年数を上限とする。
 *
 * **対象範囲外:** 同一年中の複数の退職手当等の区分(一般/特定役員/短期)が異なる場合の
 * 組み合わせ(例: 1件は短期退職手当等、もう1件は一般の退職手当等)は、`category`で
 * 指定した1つの区分を合算後の退職所得全体に一律適用する簡略化とし、区分ごとに按分する
 * 精緻な計算は対象外とする(`notes`に注記)。また、令和8年度税制改正の適用条件
 * (前の退職手当等・今回の退職手当等それぞれの支払時期の要件の細部)は、
 * 複数の専門家解説の間で説明に細かな揺れがあり、施行令の条文そのものでの
 * 確認ができていないため、境界年(令和7年分・8年分をまたぐケース)の判定は
 * 参考値にとどまる(`notes`に注記)。実際の申告にあたっては国税庁「確定申告書等
 * 作成コーナー」の計算結果や税理士等の確認を必ず受けること。
 */

export type RetirementIncomeCategory = "GENERAL" | "SPECIFIED_OFFICER" | "SHORT_TERM";

/** 短期退職手当等について2分の1課税の適用が無くなる「収入金額-退職所得控除額」の閾値 */
const SHORT_TERM_THRESHOLD_JPY = 3_000_000;

/** 令和8年度税制改正(重複排除対象期間の4年内→9年内への延長)の施行日の年分 */
const DC_LOOKBACK_EXTENSION_START_YEAR = 2026;

/** 前の退職手当等の区分。DC_LUMP_SUM: 確定拠出年金の老齢給付金として支給される一時金(施行令72条3項7号)。 */
export type RetirementPaymentKind = "REGULAR" | "DC_LUMP_SUM";

/** 同一年中の複数退職手当等を合算する際、区分の簡略化を注記するための表示ラベル */
const CATEGORY_NOTE_LABELS: Record<RetirementIncomeCategory, string> = {
  GENERAL: "一般の退職手当等",
  SPECIFIED_OFFICER: "特定役員退職手当等",
  SHORT_TERM: "短期退職手当等",
};

export interface PriorRetirementPaymentInput {
  /** 前の退職手当等の支給を受けた年(西暦)。今回の支給年より前である必要がある。 */
  paymentYear: number;
  /** 前の退職手当等の区分 */
  kind: RetirementPaymentKind;
  /**
   * 今回の勤続期間等のうち、前の退職手当等の勤続期間等と重複する年数
   * (1年未満は切り捨てて計算するため実数のまま入力してよい。例: 6年7か月→6.58)。
   */
  overlappingYearsOfService: number;
}

export interface SamePeriodRetirementPaymentInput {
  /** 同一年中に他の支払者から受け取った退職手当等の収入金額(源泉徴収前の額面) */
  incomeJpy: Decimal.Value;
  /** その支払者との勤続年数(1年未満の端数はそのまま入力してよい) */
  yearsOfService: number;
  /**
   * これまでに合算した勤続期間(今回の退職手当等、及び`samePeriodPayments`配列内で
   * より前に指定した他の退職手当等の合計)と重複する年数(1年未満切り捨てで計算する
   * ため実数のまま入力してよい)。
   */
  overlappingYearsOfService: number;
}

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
  /** 今回の退職手当等がDC一時金(確定拠出年金の老齢給付金として支給される一時金)か。省略時はfalse。 */
  isDefinedContributionLumpSum?: boolean;
  /**
   * 今回の退職手当等の支給を受けた年(西暦)。前の退職手当等との重複排除の
   * 対象期間判定(4年内/9年内/19年内)に使用する。`priorPayments`を指定する場合は必須。
   */
  paymentYear?: number;
  /**
   * 前年以前に重複する勤続期間等がある他の退職手当等(前の退職手当等)を受け取っている
   * 場合の情報。2件以上ある場合は配列で全て指定する(機能109)。各件ごとに独立して
   * 重複排除対象期間(4年内/9年内/19年内)内かどうかを判定し、対象期間内にあるものの
   * 重複勤続年数(1年未満切り捨て)の合計を基に控除額を1回だけ計算する。
   */
  priorPayments?: PriorRetirementPaymentInput[];
  /**
   * 同一年中に他の支払者からも退職手当等を受け取っている場合の情報(国税庁タックス
   * アンサーNo.2735)。指定した場合、収入金額・勤続年数を合算した上で退職所得控除額・
   * 退職所得の金額を1回だけ計算する。
   */
  samePeriodPayments?: SamePeriodRetirementPaymentInput[];
}

export interface RetirementIncomeResult {
  category: RetirementIncomeCategory;
  /** 同一年中の他の退職手当等と合算した収入金額(`samePeriodPayments`未指定ならincomeJpyと同じ) */
  combinedIncomeJpy: Decimal;
  /** 同一年中の他の退職手当等の勤続期間を合算した勤続年数(`samePeriodPayments`未指定ならyearsOfServiceと同じ、1年未満切り上げ前の実数) */
  combinedYearsOfService: number;
  /** 退職所得控除額(同一年中の合算・前の退職手当等との重複排除後) */
  deductionJpy: Decimal;
  /** 重複排除により減額された退職所得控除額(対象外の場合は0) */
  overlapDeductionReductionJpy: Decimal;
  /** 退職所得の金額 */
  retirementIncomeJpy: Decimal;
  /** 所得税額の目安(復興特別所得税を含む。速算表を退職所得の金額単独に適用) */
  nationalTaxJpy: Decimal;
  /** 住民税額の目安(所得割10%固定。実際は現年分離課税で支給時の特別徴収により完結する) */
  residentTaxJpy: Decimal;
  notes: string[];
}

/**
 * 前の退職手当等との重複排除の対象期間(年数)を判定する(所得税法施行令70条)。
 * - 今回がDC一時金の場合: 前年以前19年内(施行令72条3項7号に掲げる一時金)。
 * - 今回が通常の退職手当等かつ前がDC一時金の場合: 令和8年(2026年)1月1日以後に
 *   支払われたDC一時金については前年以前9年内(令和8年度税制改正。改正前は4年内)。
 * - それ以外(通常の退職手当等同士): 前年以前4年内。
 */
export function resolveOverlapDeductionLookbackYears(
  isCurrentDefinedContributionLumpSum: boolean,
  priorPaymentKind: RetirementPaymentKind,
  priorPaymentYear: number,
): number {
  if (isCurrentDefinedContributionLumpSum) {
    return 19;
  }
  if (priorPaymentKind === "DC_LUMP_SUM") {
    return priorPaymentYear >= DC_LOOKBACK_EXTENSION_START_YEAR ? 9 : 4;
  }
  return 4;
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
  const notes: string[] = [];

  let combinedIncomeJpy = incomeJpy;
  let combinedYearsOfService = input.yearsOfService;

  const samePeriodPayments = input.samePeriodPayments ?? [];
  if (samePeriodPayments.length > 0) {
    for (const payment of samePeriodPayments) {
      const paymentIncomeJpy = new Decimal(payment.incomeJpy);
      if (paymentIncomeJpy.isNegative()) {
        throw new Error("同一年中の他の退職手当等の収入金額は0以上である必要があります");
      }
      if (payment.yearsOfService <= 0) {
        throw new Error("同一年中の他の退職手当等の勤続年数は0より大きい必要があります");
      }
      if (payment.overlappingYearsOfService < 0) {
        throw new Error("同一年中の他の退職手当等と重複する勤続年数は0以上である必要があります");
      }
      if (payment.overlappingYearsOfService > payment.yearsOfService) {
        throw new Error("同一年中の他の退職手当等と重複する勤続年数がその退職手当等の勤続年数を超えています");
      }
      const nonOverlappingYears = Math.max(
        0,
        payment.yearsOfService - Math.floor(payment.overlappingYearsOfService),
      );
      combinedIncomeJpy = combinedIncomeJpy.plus(paymentIncomeJpy);
      combinedYearsOfService += nonOverlappingYears;
    }
    notes.push(
      `同一年中に他の支払者からも退職手当等を受け取っているため、収入金額を合算(合計${combinedIncomeJpy.toNumber().toLocaleString("ja-JP")}円)し、勤続年数も重複しない期間を加算した年数(合計${combinedYearsOfService}年)で退職所得控除額・退職所得の金額を1回だけ計算した(国税庁タックスアンサーNo.2735、所得税法施行令69条)。`,
    );
    if (category !== "GENERAL") {
      notes.push(
        `区分「${CATEGORY_NOTE_LABELS[category]}」は合算後の退職所得全体に一律適用する簡略化とした。同一年中の退職手当等ごとに区分(一般/特定役員/短期)が異なる場合の按分計算は対象外のため、実際の申告にあたっては国税庁「確定申告書等作成コーナー」の計算結果や税理士等の確認を必ず受けること。`,
      );
    }
  }

  const baseDeductionJpy = calculateRetirementIncomeDeductionJpy(
    combinedYearsOfService,
    input.isDisabilityRelated ?? false,
  );

  let overlapDeductionReductionJpy = new Decimal(0);

  const priorPayments = input.priorPayments ?? [];
  if (priorPayments.length > 0) {
    if (input.paymentYear === undefined) {
      throw new Error("前の退職手当等を指定する場合は今回の支給年(paymentYear)も指定してください");
    }

    let totalOverlapYearsFloor = 0;
    let includedCount = 0;

    for (const priorPayment of priorPayments) {
      const gapYears = input.paymentYear - priorPayment.paymentYear;
      if (gapYears <= 0) {
        throw new Error(
          "前の退職手当等の支給年は今回の支給年より前である必要があります(同一年中に2か所以上から受け取る場合は対象範囲外)",
        );
      }
      if (priorPayment.overlappingYearsOfService < 0) {
        throw new Error("重複する勤続年数は0以上である必要があります");
      }
      if (priorPayment.overlappingYearsOfService > combinedYearsOfService) {
        throw new Error("重複する勤続年数が今回の勤続年数を超えています");
      }

      const lookbackYears = resolveOverlapDeductionLookbackYears(
        input.isDefinedContributionLumpSum ?? false,
        priorPayment.kind,
        priorPayment.paymentYear,
      );

      if (gapYears <= lookbackYears) {
        const overlapYearsFloor = Math.floor(priorPayment.overlappingYearsOfService);
        totalOverlapYearsFloor += overlapYearsFloor;
        includedCount += 1;
        notes.push(
          `前の退職手当等(${priorPayment.paymentYear}年、${priorPayment.kind === "DC_LUMP_SUM" ? "DC一時金" : "通常の退職手当等"})の支給年が今回の重複排除対象期間(前年以前${lookbackYears}年内)に含まれるため、重複する勤続年数(1年未満切り捨て。${priorPayment.overlappingYearsOfService}年→${overlapYearsFloor}年)を重複排除の対象に含めた。`,
        );
        if (
          !(input.isDefinedContributionLumpSum ?? false) &&
          priorPayment.kind === "DC_LUMP_SUM" &&
          priorPayment.paymentYear >= DC_LOOKBACK_EXTENSION_START_YEAR - 1 &&
          priorPayment.paymentYear <= DC_LOOKBACK_EXTENSION_START_YEAR + 1
        ) {
          notes.push(
            "令和8年度税制改正(重複排除対象期間の4年内→9年内への延長)の適用条件の細部(前の退職手当等・今回の退職手当等それぞれの支払時期の要件)は、施行令の条文そのものでは確認できておらず複数の専門家解説の間で説明に細かな揺れがあるため、令和7年分・8年分をまたぐ境界年の判定は参考値にとどまる。実際の申告にあたっては国税庁「確定申告書等作成コーナー」の計算結果や税理士等の確認を必ず受けること。",
          );
        }
      } else {
        notes.push(
          `前の退職手当等(${priorPayment.paymentYear}年)の支給年は重複排除の対象期間(前年以前${lookbackYears}年内)の外のため、重複排除は適用しない。`,
        );
      }
    }

    const combinedYearsFloor = Math.floor(combinedYearsOfService);
    const cappedOverlapYearsFloor = Math.min(totalOverlapYearsFloor, combinedYearsFloor);
    if (cappedOverlapYearsFloor > 0) {
      overlapDeductionReductionJpy = calculateRetirementIncomeDeductionJpy(cappedOverlapYearsFloor, false);
    }
    if (cappedOverlapYearsFloor < totalOverlapYearsFloor) {
      notes.push(
        `重複排除対象期間内にある前の退職手当等の重複勤続年数の合計(${totalOverlapYearsFloor}年)が今回の勤続年数(${combinedYearsFloor}年)を超えるため、今回の勤続年数を上限として控除額を計算した。`,
      );
    }
    if (includedCount > 0) {
      notes.push(
        includedCount > 1
          ? `重複排除対象期間内にある前の退職手当等が${includedCount}件あるため、それぞれの重複勤続年数(1年未満切り捨て)の合計(${cappedOverlapYearsFloor}年)を基に計算した控除額${overlapDeductionReductionJpy.toNumber().toLocaleString("ja-JP")}円を今回の退職所得控除額から1回だけ差し引いた(所得税法施行令70条)。`
          : `重複する勤続年数を基に計算した控除額${overlapDeductionReductionJpy.toNumber().toLocaleString("ja-JP")}円を今回の退職所得控除額から差し引いた(所得税法施行令70条)。`,
      );
    }
  }

  const deductionJpy = Decimal.max(baseDeductionJpy.minus(overlapDeductionReductionJpy), 0);
  const excessJpy = Decimal.max(combinedIncomeJpy.minus(deductionJpy), 0);

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

  return {
    category,
    combinedIncomeJpy,
    combinedYearsOfService,
    deductionJpy,
    overlapDeductionReductionJpy,
    retirementIncomeJpy,
    nationalTaxJpy,
    residentTaxJpy,
    notes,
  };
}
