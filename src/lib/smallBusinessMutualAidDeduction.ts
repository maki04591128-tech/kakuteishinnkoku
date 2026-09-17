import { Decimal } from "decimal.js";

/**
 * 小規模企業共済等掛金控除額を試算する(所得税法75条)。
 *
 * この控除は小規模企業共済・iDeCo(個人型確定拠出年金)・心身障害者扶養共済の
 * 掛金を対象とし、上限は無く**その年に支払った掛金の全額**がそのまま所得税・
 * 住民税共通で控除額になる(生命保険料控除や医療費控除のような速算表・
 * 足切りは存在しない)。
 *
 * iDeCoのみ、加入区分(第1号被保険者/会社員/公務員/専業主婦(主夫)等)により
 * 掛金の拠出限度額(月額)が法令で定められている。拠出限度額は掛金の
 * 引き落とし時点で運営管理機関が超過拠出を許さない仕組みのため、通常は
 * 本ツールで警告するまでもないが、年の途中で転職等により加入区分が変わった
 * 場合に旧区分の限度額のまま入力してしまう入力ミスを検知する参考情報として、
 * 選択した加入区分の年間上限額との比較を表示する。
 *
 * 簡略化している点:
 *  - 確定給付企業年金(DB)等の他制度に加入している会社員の限度額は、
 *    2024年12月の制度改正以降、各人のDB等の給付水準(他制度掛金相当額)に
 *    応じて個別に決まる(月5.5万円からDB等の相当額を控除した額、かつ
 *    iDeCo単独では月2万円が上限)ため、本ツールでは一律の金額を計算せず、
 *    「iDeCoの年間拠出限度額のお知らせ」等で個別に確認するよう促すに留める
 *    (超過判定は行わない)。
 *  - 国民年金基金の掛金・国民年金の付加保険料は、第1号被保険者の場合iDeCoと
 *    合算して年81.6万円が上限だが、本ツールはiDeCo単体の入力のみを対象とし、
 *    これらとの合算判定は行わない。
 */

export type IdecoParticipantCategory =
  | "SELF_EMPLOYED"
  | "EMPLOYEE_NO_PENSION"
  | "EMPLOYEE_DC_ONLY"
  | "EMPLOYEE_WITH_DB"
  | "PUBLIC_SERVANT"
  | "DEPENDENT_SPOUSE"
  | "UNKNOWN";

export interface SmallBusinessMutualAidDeductionInput {
  /** iDeCo(個人型確定拠出年金)の年間拠出額 */
  idecoContributionJpy: Decimal.Value;
  /** iDeCoの加入区分(年間拠出限度額の参考表示・超過警告に使用) */
  idecoParticipantCategory: IdecoParticipantCategory;
  /** 小規模企業共済の年間掛金 */
  smallBusinessMutualAidJpy: Decimal.Value;
  /** 心身障害者扶養共済の年間掛金 */
  dependentWithDisabilitiesMutualAidJpy: Decimal.Value;
}

export interface SmallBusinessMutualAidDeductionResult {
  idecoContributionJpy: Decimal;
  smallBusinessMutualAidJpy: Decimal;
  dependentWithDisabilitiesMutualAidJpy: Decimal;
  /** 小規模企業共済等掛金控除額(所得税・住民税共通、支払額の全額) */
  deductionJpy: Decimal;
  /** 選択した加入区分のiDeCo年間拠出限度額(区分がDB等併用/不明の場合はnull) */
  idecoAnnualLimitJpy: Decimal | null;
  /** idecoAnnualLimitJpyが算出できる区分で、入力額がそれを超えている場合true */
  idecoExceedsLimit: boolean;
  notes: string[];
}

const IDECO_ANNUAL_LIMIT_JPY: Record<
  Exclude<IdecoParticipantCategory, "EMPLOYEE_WITH_DB" | "UNKNOWN">,
  Decimal
> = {
  SELF_EMPLOYED: new Decimal(816_000),
  EMPLOYEE_NO_PENSION: new Decimal(276_000),
  EMPLOYEE_DC_ONLY: new Decimal(240_000),
  PUBLIC_SERVANT: new Decimal(240_000),
  DEPENDENT_SPOUSE: new Decimal(276_000),
};

const IDECO_CATEGORY_LABEL: Record<IdecoParticipantCategory, string> = {
  SELF_EMPLOYED: "自営業者等(国民年金第1号被保険者)",
  EMPLOYEE_NO_PENSION: "会社員(企業年金なし)",
  EMPLOYEE_DC_ONLY: "会社員(企業型確定拠出年金のみ加入)",
  EMPLOYEE_WITH_DB: "会社員(確定給付企業年金(DB)等に加入)",
  PUBLIC_SERVANT: "公務員等",
  DEPENDENT_SPOUSE: "専業主婦(主夫)等(国民年金第3号被保険者)",
  UNKNOWN: "未選択",
};

export function idecoParticipantCategoryLabel(category: IdecoParticipantCategory): string {
  return IDECO_CATEGORY_LABEL[category];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateSmallBusinessMutualAidDeduction(
  input: SmallBusinessMutualAidDeductionInput,
): SmallBusinessMutualAidDeductionResult {
  const idecoContributionJpy = new Decimal(input.idecoContributionJpy);
  const smallBusinessMutualAidJpy = new Decimal(input.smallBusinessMutualAidJpy);
  const dependentWithDisabilitiesMutualAidJpy = new Decimal(
    input.dependentWithDisabilitiesMutualAidJpy,
  );

  requireNonNegative(idecoContributionJpy, "iDeCoの年間拠出額");
  requireNonNegative(smallBusinessMutualAidJpy, "小規模企業共済の年間掛金");
  requireNonNegative(
    dependentWithDisabilitiesMutualAidJpy,
    "心身障害者扶養共済の年間掛金",
  );

  const deductionJpy = idecoContributionJpy
    .plus(smallBusinessMutualAidJpy)
    .plus(dependentWithDisabilitiesMutualAidJpy);

  const idecoAnnualLimitJpy =
    input.idecoParticipantCategory === "EMPLOYEE_WITH_DB" ||
    input.idecoParticipantCategory === "UNKNOWN"
      ? null
      : IDECO_ANNUAL_LIMIT_JPY[input.idecoParticipantCategory];

  const idecoExceedsLimit =
    idecoAnnualLimitJpy !== null && idecoContributionJpy.greaterThan(idecoAnnualLimitJpy);

  const notes: string[] = [
    "小規模企業共済等掛金控除は上限が無く、その年に支払った掛金の全額がそのまま所得税・住民税共通の控除額になる。",
    "対象はiDeCo(個人型確定拠出年金)・小規模企業共済・心身障害者扶養共済の掛金。国民年金基金の掛金・国民年金の付加保険料は本ツールでは対象外(別途社会保険料控除等の対象になる場合がある)。",
  ];

  if (input.idecoParticipantCategory === "EMPLOYEE_WITH_DB") {
    notes.push(
      "確定給付企業年金(DB)等に加入している会社員のiDeCo拠出限度額は、勤務先のDB等の給付水準により個人ごとに異なるため本ツールでは自動判定していない。運営管理機関から通知される「拠出限度額のお知らせ」等で確認すること。",
    );
  } else if (idecoAnnualLimitJpy !== null) {
    notes.push(
      `選択した加入区分(${IDECO_CATEGORY_LABEL[input.idecoParticipantCategory]})のiDeCo年間拠出限度額は${idecoAnnualLimitJpy.toNumber().toLocaleString("ja-JP")}円。掛金は運営管理機関側で限度額を超えて拠出できない仕組みのため、超過表示は年の途中で加入区分が変わった場合の入力確認用の参考情報。`,
    );
  }
  if (idecoExceedsLimit) {
    notes.push(
      "入力されたiDeCoの年間拠出額が選択した加入区分の限度額を超えている。年の途中で加入区分(転職・退職等)が変わった場合は、実際の拠出額・区分をiDeCoの年間取引報告書で確認すること。",
    );
  }

  return {
    idecoContributionJpy,
    smallBusinessMutualAidJpy,
    dependentWithDisabilitiesMutualAidJpy,
    deductionJpy,
    idecoAnnualLimitJpy,
    idecoExceedsLimit,
    notes,
  };
}
