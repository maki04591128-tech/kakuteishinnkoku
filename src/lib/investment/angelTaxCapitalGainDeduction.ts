import { Decimal } from "decimal.js";

/**
 * エンジェル税制(措置法37条の13・37条の13の2。実務上「優遇措置B」)の
 * 譲渡益控除方式による試算。機能110で対応した寄附金控除方式(措置法37条の13の3、
 * 優遇措置A、`donationDeduction.ts`)とは別の特例で、国税庁タックスアンサー
 * No.1530「特定投資株式の取得に要した金額の控除等の特例(エンジェル税制)」
 * (令和8年4月1日現在法令等)を一次情報として実装した。
 *
 * 優遇措置Aが取得価額を寄附金控除(所得控除)に加算するのに対し、優遇措置Bは
 * 特定株式(既存の特定中小会社株式)・設立特定株式(起業特例)の払込みによる
 * 取得価額そのものを、その年の株式等に係る譲渡所得等の金額から控除する
 * (別の所得区分の計算に作用する点が優遇措置Aと異なる)。
 *
 * **控除額の計算(No.1530による)**: 銘柄ごとに
 *   (その年中の払込取得価額の合計額 ÷ その年中に払込みにより取得した株数)
 *     × (取得株数 − その年中に譲渡・贈与した同一銘柄株式の数)
 * を計算し合計する。すなわち、その年12月31日時点で保有する部分の取得価額
 * (1株あたりの平均取得単価×年末保有株数)のみが控除対象になり、年中に
 * 譲渡・贈与した部分は対象外(その部分は通常どおりその株式自体の譲渡損益の
 * 計算に取得費として算入される)。
 *
 * **控除の順序・限度**: まずこの特例適用前の一般株式等に係る譲渡所得等の
 * 金額を限度に控除し、なお控除しきれない金額があるときは、この特例適用前の
 * 上場株式等に係る譲渡所得等の金額を限度にさらに控除する。いずれも0円が
 * 下限で、この特例により譲渡損失を作り出すことはできない。適用しきれな
 * かった金額(unusedJpy)は繰り越されず、その年は単に控除されないだけで
 * 特定株式・設立特定株式の取得価額そのものは減額されないため、将来その
 * 株式を譲渡する際の取得費には影響しない(下記の翌年以後の取得価額調整は、
 * 実際に適用を受けた金額(控除された部分)にのみ生じる)。
 *
 * **翌年以後の取得価額調整**: 特例の適用を受けた場合、原則として翌年以後の
 * その株式の取得価額から適用を受けた金額を控除する調整計算が必要になるが、
 * No.1530によれば、その適用を受けた金額(適用額)が20億円以下であるときは
 * この調整計算は不要とされている。個人投資家がこの特例で実際に適用を受ける
 * 金額が20億円を超えることは通常想定しにくいため、本ツールは20億円以下の
 * 前提で翌年以後の取得価額調整は行わない(20億円を超える場合は`notes`で
 * 注記し、調整計算自体は対象外とする)。
 *
 * **対象外とした範囲(今後の課題)**:
 *  - 特定投資株式が価値を失った場合の特例(措置法37条の13の3、国税庁
 *    タックスアンサーNo.1531)・特定投資株式に係る譲渡損失の損益通算・
 *    繰越控除の特例(措置法37条の13の2、No.1532・No.1533)は、この特例
 *    (取得時点での譲渡益控除)とは別の制度(株式売却・清算時の損失を扱う)
 *    のため対象外。
 *  - 適用要件(特定中小会社・特定新規中小会社の要件、対象者から除外される
 *    「特定株主」に該当しないこと等)は、他の税額控除と同様ユーザー自身の
 *    確認事項とし本ツールでは判定しない。
 *  - 適用を受けるには一定の書類を添付した確定申告書の提出が必要(申告要件)
 *    だが、本ツールは書類の準備状況までは確認しない。
 */

export interface AngelTaxCapitalGainDeductionStockInput {
  symbol: string;
  /** その年中に払込みにより取得した特定株式・設立特定株式の数量 */
  acquiredQuantity: Decimal.Value;
  /** その年中の払込みによる取得価額の合計額(円) */
  acquiredCostJpy: Decimal.Value;
  /** その年中に譲渡・贈与した同一銘柄株式の数量(未入力の場合は0) */
  disposedQuantitySameYear?: Decimal.Value;
}

export interface AngelTaxCapitalGainDeductionInput {
  stocks: AngelTaxCapitalGainDeductionStockInput[];
  /** この特例適用前の、一般株式等に係る譲渡所得等の金額(赤字の場合は0円として入力) */
  generalStockCapitalGainJpy: Decimal.Value;
  /** この特例適用前の、上場株式等に係る譲渡所得等の金額(赤字の場合は0円として入力) */
  listedStockCapitalGainJpy: Decimal.Value;
}

export interface AngelTaxCapitalGainDeductionStockResult {
  symbol: string;
  acquiredQuantity: Decimal;
  heldQuantity: Decimal;
  averageUnitCostJpy: Decimal;
  /** 限度額適用前の、この銘柄分の控除対象額(平均取得単価×年末保有株数) */
  deductionBeforeLimitJpy: Decimal;
}

export interface AngelTaxCapitalGainDeductionResult {
  stocks: AngelTaxCapitalGainDeductionStockResult[];
  /** 限度額適用前の控除対象額の合計 */
  totalDeductionBeforeLimitJpy: Decimal;
  /** 一般株式等の譲渡所得等の金額から控除した額 */
  usedAgainstGeneralStockJpy: Decimal;
  /** 上場株式等の譲渡所得等の金額から控除した額 */
  usedAgainstListedStockJpy: Decimal;
  /** 実際に適用された控除額の合計(=適用額) */
  totalUsedJpy: Decimal;
  /** その年の譲渡所得等の金額が不足し適用しきれなかった額(繰越されず、株式の取得費にも影響しない) */
  unusedJpy: Decimal;
  /** 控除適用後の一般株式等に係る譲渡所得等の金額 */
  generalStockCapitalGainAfterDeductionJpy: Decimal;
  /** 控除適用後の上場株式等に係る譲渡所得等の金額 */
  listedStockCapitalGainAfterDeductionJpy: Decimal;
  /** 適用額(totalUsedJpy)が20億円を超え、翌年以後の取得価額調整計算(本ツールでは対象外)が必要になるかどうか */
  exceedsAdjustmentExemptionThreshold: boolean;
  notes: string[];
}

const ADJUSTMENT_EXEMPTION_THRESHOLD_JPY = new Decimal(2_000_000_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateAngelTaxCapitalGainDeduction(
  input: AngelTaxCapitalGainDeductionInput,
): AngelTaxCapitalGainDeductionResult {
  const generalStockCapitalGainJpy = new Decimal(input.generalStockCapitalGainJpy);
  const listedStockCapitalGainJpy = new Decimal(input.listedStockCapitalGainJpy);
  requireNonNegative(generalStockCapitalGainJpy, "適用前の一般株式等に係る譲渡所得等の金額");
  requireNonNegative(listedStockCapitalGainJpy, "適用前の上場株式等に係る譲渡所得等の金額");

  const stocks: AngelTaxCapitalGainDeductionStockResult[] = input.stocks.map((s) => {
    const acquiredQuantity = new Decimal(s.acquiredQuantity);
    const acquiredCostJpy = new Decimal(s.acquiredCostJpy);
    const disposedQuantitySameYear = new Decimal(s.disposedQuantitySameYear ?? 0);

    requireNonNegative(acquiredQuantity, `取得数量(${s.symbol})`);
    requireNonNegative(acquiredCostJpy, `取得価額の合計額(${s.symbol})`);
    requireNonNegative(disposedQuantitySameYear, `年中に譲渡・贈与した数量(${s.symbol})`);
    if (disposedQuantitySameYear.greaterThan(acquiredQuantity)) {
      throw new Error(
        `年中に譲渡・贈与した数量(${s.symbol})はその年中に取得した数量を超えることはできません`,
      );
    }

    const averageUnitCostJpy = acquiredQuantity.isZero()
      ? new Decimal(0)
      : acquiredCostJpy.dividedBy(acquiredQuantity);
    const heldQuantity = acquiredQuantity.minus(disposedQuantitySameYear);
    const deductionBeforeLimitJpy = averageUnitCostJpy.times(heldQuantity);

    return {
      symbol: s.symbol,
      acquiredQuantity,
      heldQuantity,
      averageUnitCostJpy,
      deductionBeforeLimitJpy,
    };
  });

  const totalDeductionBeforeLimitJpy = stocks.reduce(
    (sum, s) => sum.plus(s.deductionBeforeLimitJpy),
    new Decimal(0),
  );

  const usedAgainstGeneralStockJpy = Decimal.min(
    totalDeductionBeforeLimitJpy,
    generalStockCapitalGainJpy,
  );
  const remainingAfterGeneral = totalDeductionBeforeLimitJpy.minus(usedAgainstGeneralStockJpy);
  const usedAgainstListedStockJpy = Decimal.min(remainingAfterGeneral, listedStockCapitalGainJpy);
  const totalUsedJpy = usedAgainstGeneralStockJpy.plus(usedAgainstListedStockJpy);
  const unusedJpy = totalDeductionBeforeLimitJpy.minus(totalUsedJpy);

  const generalStockCapitalGainAfterDeductionJpy = generalStockCapitalGainJpy.minus(
    usedAgainstGeneralStockJpy,
  );
  const listedStockCapitalGainAfterDeductionJpy = listedStockCapitalGainJpy.minus(
    usedAgainstListedStockJpy,
  );

  const exceedsAdjustmentExemptionThreshold = totalUsedJpy.greaterThan(
    ADJUSTMENT_EXEMPTION_THRESHOLD_JPY,
  );

  const notes: string[] = [
    "国税庁タックスアンサーNo.1530「特定投資株式の取得に要した金額の控除等の特例(エンジェル税制)」(措置法37条の13・37条の13の2、実務上「優遇措置B」)による概算値。取得価額を寄附金控除に加算する優遇措置A(措置法37条の13の3、`/donation-deduction`)とは別の特例で、同一銘柄について両方を重複適用することはできない。",
    "銘柄ごとに、払込取得価額の合計額をその年中の取得株数で除した平均取得単価に、年末時点の保有株数(取得株数から年中に譲渡・贈与した数量を差し引いた数量)を乗じた金額のみが控除対象になる。年中に譲渡・贈与した部分の取得価額は、通常どおりその株式自体の譲渡損益の計算に取得費として算入される。",
    "控除は、まずこの特例適用前の一般株式等に係る譲渡所得等の金額を限度に控除し、控除しきれない金額があるときは上場株式等に係る譲渡所得等の金額を限度にさらに控除する。いずれも0円が下限で、この特例による損失の創出はできない。",
    "その年の譲渡所得等の金額が不足し適用しきれなかった金額(unusedJpy)は繰り越されない。ただし特定株式・設立特定株式の取得価額そのものが減額されるわけではないため、将来その株式を譲渡する際の取得費には影響しない(不利益は生じない)。",
    "特例の適用を受けた場合、原則として翌年以後のその株式の取得価額から適用を受けた金額を控除する調整計算が必要だが、適用を受けた金額(totalUsedJpy)が20億円以下であればこの調整計算は不要(No.1530)。本ツールは20億円以下の前提で翌年以後の取得価額調整は試算しない。",
    "特定投資株式が価値を失った場合の特例(措置法37条の13の3、No.1531)・特定投資株式に係る譲渡損失の損益通算及び繰越控除の特例(措置法37条の13の2、No.1532・No.1533)は、株式の売却・清算による損失を扱う別制度のため対象外。特定中小会社・特定新規中小会社の要件充足や「特定株主」に該当しないことの確認、適用に必要な添付書類の準備は、他の税額控除と同様ユーザー自身の確認事項とする。",
    "他の試算画面(一時所得・総合課税の譲渡所得等・国外転出時課税制度等)と同様にDBへの登録機能を持たない単体の試算画面のため、実際の申告では対象年の一般株式等・上場株式等の譲渡所得等の金額からこの控除額を差し引いたうえで、`/tax-estimate`等へ手入力で反映すること。",
  ];
  if (exceedsAdjustmentExemptionThreshold) {
    notes.push(
      `適用を受けた金額の合計が20億円(${ADJUSTMENT_EXEMPTION_THRESHOLD_JPY.toString()}円)を超えたため、翌年以後の取得価額調整計算が必要になるが、本ツールでは対象外(税理士・税務署に確認すること)。`,
    );
  }
  if (unusedJpy.greaterThan(0)) {
    notes.push(
      `控除対象額のうち${unusedJpy.toString()}円は、その年の一般株式等・上場株式等の譲渡所得等の金額が不足したため適用できなかった。`,
    );
  }

  return {
    stocks,
    totalDeductionBeforeLimitJpy,
    usedAgainstGeneralStockJpy,
    usedAgainstListedStockJpy,
    totalUsedJpy,
    unusedJpy,
    generalStockCapitalGainAfterDeductionJpy,
    listedStockCapitalGainAfterDeductionJpy,
    exceedsAdjustmentExemptionThreshold,
    notes,
  };
}
