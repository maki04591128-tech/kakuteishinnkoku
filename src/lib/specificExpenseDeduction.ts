import { Decimal } from "decimal.js";

/**
 * 給与所得者の特定支出控除(所得税法57条の2)を試算する。
 *
 * 給与所得者本人が負担した「特定支出」の年間合計額が、給与所得控除額の1/2を
 * 超える場合、その超える部分の金額を給与所得控除に上乗せできる制度
 * (国税庁タックスアンサーNo.1415)。特定支出には次の6区分があり、いずれも
 * 給与の支払者から「特定支出に関する証明書」の交付を受けたものに限られる。
 *  - 通勤費
 *  - 転居費(転勤に伴うもの)
 *  - 研修費
 *  - 資格取得費(弁護士・公認会計士等の資格取得費用を含む。平成25年分以後)
 *  - 単身赴任者の帰宅旅費
 *  - 勤務必要経費(図書費・衣服費・交際費等。平成25年分以後追加。年間65万円が上限)
 *
 * 前提となる給与所得控除額(所得税法28条3項、令和2年分以後の速算表。国税庁
 * タックスアンサーNo.1410)は本ファイルの`employmentIncomeDeductionJpy`が
 * 計算する(他のファイルからも再利用する)。850万円超は195万円で頭打ち。
 * 子育て世帯等に対する所得金額調整控除(措置法41条の3の3。給与収入850万円超
 * 等が対象の別制度)は`src/lib/incomeAmountAdjustmentDeduction.ts`・
 * `/income-amount-adjustment-deduction`で試算できる。
 *
 * **給与所得控除の最低保障額の引上げへの対応:**
 * `employmentIncomeDeductionJpy`は課税年分(`year`)を受け取り、次の4段階の
 * 速算表を切り替える。国税庁「令和８年度税制改正(所得税の基礎控除の引上げ等
 * 関係)Ｑ＆Ａ」(令和8年5月)・「令和８年４月源泉所得税の改正のあらまし」を
 * 一次情報として確認した。
 *  - **令和6年分以前:** 最低保障額55万円(収入162.5万円以下は定額)。
 *  - **令和7年分(令和7年度税制改正、いわゆる「103万円の壁」対応):**
 *    最低保障額が65万円に引き上げられ、収入190万円以下は定額65万円、
 *    190万円超は速算表(収入×30%+8万円)へ滑らかに接続する
 *    (190万円時点の速算式の値がちょうど65万円のため段差は生じない)。
 *  - **令和8年分・令和9年分(令和8年度税制改正):** 最低保障額がさらに
 *    74万円へ引き上げられた。ただし190万円時点の速算式の値(65万円)は
 *    74万円を下回るため、単純に「190万円以下は定額74万円、190万円超は
 *    速算表」とすると収入190万円をわずかに超えた地点で控除額が74万円から
 *    65万円台へ落ち込む逆転現象が生じてしまう。これを避けるため、
 *    国税庁は収入69万1,000円以上220万円未満の範囲について、上記の原則
 *    (定額74万円/速算表)によらない专用の金額表を令和8年分・9年分限定で
 *    定めた(前掲Q&AのQ３－１①、「改正のあらまし」(2)ハ)。本実装は
 *    この専用表をそのまま反映しており、219万1,000円以上220万円未満の
 *    狭い範囲では表自体に(1,000円刻みの丸めに由来する)段差が存在する。
 *  - **令和10年分(2028年分)以後:** 令和8年度税制改正で新設された物価連動の
 *    仕組みによる最初の見直し結果として最低保障額は69万円になるが、
 *    69万円は収入203万3,334円時点の速算式の値を下回るため速算表
 *    (収入×30%+8万円、69万円未満となる場合は69万円)に統合され、
 *    令和7年分と同様に段差なく接続する(令和12年分以後のさらなる物価連動
 *    見直しは未公表のため、基礎控除(`src/lib/basicDeduction.ts`)と同様に
 *    令和10年分の数値を暫定適用する)。
 *
 * 簡略化している点:
 *  - 実務上の給与所得控除額は「年末調整等のための給与所得控除後の給与等の
 *    金額の表」による1円未満の端数処理があるが、本ツールは速算式の計算結果を
 *    そのまま使う概算値。
 *  - 特定支出各区分の該当性(証明書の要件を満たすか等)の判定はユーザー自身が
 *    行う前提で、本ツールは金額の合計と控除額の計算のみを担う。
 */

export interface SpecificExpenseDeductionInput {
  /**
   * 課税年分(西暦)。給与所得控除の最低保障額の引上げ(令和7年分65万円、
   * 令和8年分・9年分74万円、令和10年分以後69万円)を`employmentIncomeDeductionJpy`
   * に反映するために使う。省略時は令和6年分以前(最低保障額55万円)を適用する。
   */
  year?: number;
  /** その年の給与収入金額 */
  salaryIncomeJpy: Decimal.Value;
  /** 通勤費 */
  commutingExpenseJpy: Decimal.Value;
  /** 転居費(転勤に伴うもの) */
  relocationExpenseJpy: Decimal.Value;
  /** 研修費 */
  trainingExpenseJpy: Decimal.Value;
  /** 資格取得費 */
  qualificationExpenseJpy: Decimal.Value;
  /** 単身赴任者の帰宅旅費 */
  returningHomeExpenseJpy: Decimal.Value;
  /** 勤務必要経費(図書費・衣服費・交際費等。年間65万円が上限) */
  jobRelatedExpenseJpy: Decimal.Value;
}

export interface SpecificExpenseDeductionResult {
  salaryIncomeJpy: Decimal;
  /** 給与所得控除額(速算表による概算) */
  employmentIncomeDeductionJpy: Decimal;
  /** 特定支出控除の適用判定基準額(給与所得控除額の1/2) */
  thresholdJpy: Decimal;
  /** 勤務必要経費(65万円の上限適用後) */
  cappedJobRelatedExpenseJpy: Decimal;
  /** 特定支出の合計額(勤務必要経費は上限適用後) */
  totalSpecificExpenseJpy: Decimal;
  /** 特定支出控除額(特定支出の合計額が基準額を超える部分) */
  specificExpenseDeductionJpy: Decimal;
  /** 特定支出控除適用後の給与所得金額(0円が下限) */
  adjustedEmploymentIncomeJpy: Decimal;
  notes: string[];
}

/** 勤務必要経費(図書費・衣服費・交際費等)の年間上限額 */
const JOB_RELATED_EXPENSE_MAX_JPY = new Decimal(650_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/** 給与所得控除の最低保障額が65万円に引き上げられた年分(令和7年度税制改正) */
const EMPLOYMENT_DEDUCTION_REFORM_START_YEAR = 2025;

/** 中間区分の速算表(220万円超660万円以下。年分を問わず共通) */
function midBracketDeductionJpy(income: Decimal): Decimal | null {
  if (income.lessThanOrEqualTo(3_600_000)) {
    return income.times(0.3).plus(80_000);
  }
  if (income.lessThanOrEqualTo(6_600_000)) {
    return income.times(0.2).plus(440_000);
  }
  if (income.lessThanOrEqualTo(8_500_000)) {
    return income.times(0.1).plus(1_100_000);
  }
  return null;
}

/**
 * 給与所得控除額の速算表(所得税法28条3項)。課税年分(`year`)により令和6年分
 * 以前・令和7年分・令和8年分/9年分・令和10年分以後の4段階の表を切り替える
 * (詳細は本ファイル冒頭のコメント参照)。`year`省略時は令和6年分以前(最低
 * 保障額55万円)を適用する。給与所得控除額が収入金額を超えて所得がマイナスに
 * なることは無いよう、収入金額自体を上限としてクランプする。
 */
export function employmentIncomeDeductionJpy(
  salaryIncomeJpy: Decimal.Value,
  year?: number,
): Decimal {
  const income = new Decimal(salaryIncomeJpy);
  requireNonNegative(income, "給与収入金額");

  const taxYear = year ?? 0;
  const midBracket = midBracketDeductionJpy(income);

  let deduction: Decimal;
  if (taxYear >= 2028) {
    // 令和10年分以後: 最低保障額69万円は速算表(収入×30%+8万円)に統合される
    deduction = midBracket ?? new Decimal(1_950_000);
    if (income.lessThanOrEqualTo(2_200_000)) {
      deduction = Decimal.max(deduction, 690_000);
    }
  } else if (taxYear >= 2026) {
    // 令和8年分・9年分: 収入69万1,000円以上220万円未満は専用の金額表
    if (income.lessThan(2_191_000)) {
      deduction = new Decimal(740_000);
    } else if (income.lessThan(2_193_000)) {
      deduction = income.minus(1_451_000);
    } else if (income.lessThan(2_196_000)) {
      deduction = income.minus(1_453_000);
    } else if (income.lessThan(2_200_000)) {
      deduction = income.minus(1_456_000);
    } else {
      deduction = midBracket ?? new Decimal(1_950_000);
    }
  } else if (taxYear >= EMPLOYMENT_DEDUCTION_REFORM_START_YEAR) {
    // 令和7年分: 最低保障額65万円(収入190万円以下)。190万円超は速算表と段差なく接続する
    deduction = income.lessThanOrEqualTo(1_900_000)
      ? new Decimal(650_000)
      : (midBracket ?? new Decimal(1_950_000));
  } else {
    // 令和6年分以前: 最低保障額55万円(収入162.5万円以下)
    if (income.lessThanOrEqualTo(1_625_000)) {
      deduction = new Decimal(550_000);
    } else if (income.lessThanOrEqualTo(1_800_000)) {
      deduction = income.times(0.4).minus(100_000);
    } else {
      deduction = midBracket ?? new Decimal(1_950_000);
    }
  }

  return Decimal.min(deduction, income);
}

export function estimateSpecificExpenseDeduction(
  input: SpecificExpenseDeductionInput,
): SpecificExpenseDeductionResult {
  const salaryIncomeJpy = new Decimal(input.salaryIncomeJpy);
  const commutingExpenseJpy = new Decimal(input.commutingExpenseJpy);
  const relocationExpenseJpy = new Decimal(input.relocationExpenseJpy);
  const trainingExpenseJpy = new Decimal(input.trainingExpenseJpy);
  const qualificationExpenseJpy = new Decimal(input.qualificationExpenseJpy);
  const returningHomeExpenseJpy = new Decimal(input.returningHomeExpenseJpy);
  const jobRelatedExpenseJpy = new Decimal(input.jobRelatedExpenseJpy);

  requireNonNegative(salaryIncomeJpy, "給与収入金額");
  requireNonNegative(commutingExpenseJpy, "通勤費");
  requireNonNegative(relocationExpenseJpy, "転居費");
  requireNonNegative(trainingExpenseJpy, "研修費");
  requireNonNegative(qualificationExpenseJpy, "資格取得費");
  requireNonNegative(returningHomeExpenseJpy, "単身赴任者の帰宅旅費");
  requireNonNegative(jobRelatedExpenseJpy, "勤務必要経費");

  const cappedJobRelatedExpenseJpy = Decimal.min(jobRelatedExpenseJpy, JOB_RELATED_EXPENSE_MAX_JPY);

  const totalSpecificExpenseJpy = commutingExpenseJpy
    .plus(relocationExpenseJpy)
    .plus(trainingExpenseJpy)
    .plus(qualificationExpenseJpy)
    .plus(returningHomeExpenseJpy)
    .plus(cappedJobRelatedExpenseJpy);

  const employmentDeduction = employmentIncomeDeductionJpy(salaryIncomeJpy, input.year);
  const thresholdJpy = employmentDeduction.dividedBy(2);

  const specificExpenseDeductionJpy = Decimal.max(0, totalSpecificExpenseJpy.minus(thresholdJpy));

  const adjustedEmploymentIncomeJpy = Decimal.max(
    0,
    salaryIncomeJpy.minus(employmentDeduction).minus(specificExpenseDeductionJpy),
  );

  const notes: string[] = [
    "給与の支払者から「特定支出に関する証明書」の交付を受けた特定支出のみが対象(国税庁タックスアンサーNo.1415)。証明書が無い支出は含めないこと。",
    "勤務必要経費(図書費・衣服費・交際費等)は年間65万円が上限(上限超過分は特定支出の合計額に算入しない)。",
    "給与所得控除額は速算表による概算値。実際の申告では「給与所得控除後の給与等の金額の表」の1円単位の値と若干異なる場合がある。",
    "給与所得控除の最低保障額は令和7年分65万円・令和8年分及び令和9年分74万円・令和10年分以後69万円へ段階的に引き上げられている(課税年分を指定していない場合は引上げ前の55万円を適用)。",
    "子育て世帯等に対する所得金額調整控除(措置法41条の3の3。給与収入850万円超等が対象)は別制度のため本試算には含まれない(/income-amount-adjustment-deductionで試算)。",
  ];

  return {
    salaryIncomeJpy,
    employmentIncomeDeductionJpy: employmentDeduction,
    thresholdJpy,
    cappedJobRelatedExpenseJpy,
    totalSpecificExpenseJpy,
    specificExpenseDeductionJpy,
    adjustedEmploymentIncomeJpy,
    notes,
  };
}
