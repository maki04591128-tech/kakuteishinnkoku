import { Decimal } from "decimal.js";

/**
 * エンジェル税制(措置法37条の13の3・37条の13の2)の、特定投資株式の売却・清算
 * による損失に関する3つの特例の試算。機能111(譲渡益控除方式、優遇措置B)が
 * 「対象外とした範囲」として明記していた次の3つの国税庁タックスアンサーを
 * 一次情報として実装した:
 *
 * - No.1531「特定投資株式が株式としての価値を失った場合の特例」— 特定株式を
 *   発行した会社が解散(合併による解散を除く)し清算が結了したこと、または
 *   破産手続開始の決定を受けたことのいずれかに該当する場合、その株式を
 *   その時に取得価額と同額で譲渡したものとみなして譲渡損失を計算できる
 *   (実際には譲渡していない株式について、みなし譲渡損失を認識する特例)。
 * - No.1532「特定投資株式に係る譲渡損失の損益の計算の特例」— その年中に
 *   特定株式を譲渡(前述のみなし譲渡を含む)したことにより生じた損失の金額が
 *   あり、その年の一般株式等に係る譲渡所得等の金額の計算上控除しきれない
 *   場合、その控除しきれない部分の金額は、その年の上場株式等に係る譲渡
 *   所得等の金額を限度としてさらに控除できる(通常、一般株式等の譲渡損失は
 *   上場株式等の譲渡所得等とは別プールで損益通算できないが、この特例が
 *   適用される特定株式の損失に限り例外的に控除できる)。
 * - No.1533「特定投資株式に係る譲渡損失の繰越控除の特例」— No.1532の適用
 *   後もなお控除しきれない金額があるときは、その年の翌年以後3年間にわたり、
 *   各年の一般株式等に係る譲渡所得等の金額、次に上場株式等に係る譲渡所得等
 *   の金額から順次控除できる(適用を受けるには、損失が生じた年分以後、
 *   一定の書類を添付した確定申告書を連続して提出することが必要)。
 *
 * 上場株式等の譲渡損失の繰越控除(機能?、`lossCarryforward.ts`)と同様、
 * 発生年が古いものから優先して適用する。ただし対象がこの特定株式の損失に
 * 限られ、通常の上場株式等の譲渡損失とはプールが異なる別制度のため、別
 * モジュール・別テーブル(`AngelTaxLossCarryforward`)として保持する。
 *
 * **対象外とした範囲(今後の課題):**
 *  - 本ツールは一般株式等・上場株式等の年間損益をそれぞれ1つのプールとして
 *    集計しており、そのうち「特定株式に係る部分」だけを自動抽出する機能は
 *    持たない。このため、その年の特定株式の譲渡等による損失の金額
 *    (`specificStockLossJpy`)と、それを含めて計算した一般株式等に係る
 *    譲渡所得等の金額(`generalStockNetGainJpy`。特定株式分の損失は既に
 *    反映されている前提)はユーザー自身が入力する値とする。
 *  - 繰越控除の残高(`AngelTaxLossCarryforward`)はDBに保存できるが、他の
 *    繰越控除機能(機能7・機能60等)にある「前年分の計算結果から自動で
 *    繰り越す」ボタンには対応しない。特定株式の損失・一般株式等の譲渡所得等
 *    の金額は上記のとおり都度入力のためDBに保存されておらず、前年分の
 *    計算結果を再現できないため(外国税額控除の試算(機能65)と同様の制約)。
 *    新たに発生した繰越損失は、この試算画面の結果を見てユーザー自身が
 *    翌年分の登録フォームへ手入力する。
 *  - 特定中小会社・特定新規中小会社の要件充足の確認、解散・破産以外の
 *    事由(私的整理等)による価値喪失は対象外(No.1531の要件どおり、
 *    解散(清算結了)・破産手続開始決定の2事由のみを対象とする)。
 */

const CARRYFORWARD_YEARS = 3;

export type AngelTaxWorthlessEvent = "DISSOLUTION" | "BANKRUPTCY";

export interface AngelTaxDeemedTransferLossInput {
  /** 価値を失った事由(解散(清算結了)・破産手続開始の決定のいずれか) */
  event: AngelTaxWorthlessEvent;
  /** その特定株式の取得価額(払込みにより取得した価額の合計額) */
  acquisitionCostJpy: Decimal.Value;
}

export interface AngelTaxDeemedTransferLossResult {
  event: AngelTaxWorthlessEvent;
  /** みなし譲渡損失の金額(取得価額と同額。譲渡価額を0円とみなす) */
  deemedTransferLossJpy: Decimal;
  notes: string[];
}

/**
 * No.1531「特定投資株式が株式としての価値を失った場合の特例」による
 * みなし譲渡損失の計算。譲渡価額を0円とみなすため、損失額は取得価額と同額になる。
 */
export function calculateAngelTaxDeemedTransferLoss(
  input: AngelTaxDeemedTransferLossInput,
): AngelTaxDeemedTransferLossResult {
  const acquisitionCostJpy = new Decimal(input.acquisitionCostJpy);
  if (acquisitionCostJpy.isNegative()) {
    throw new Error("取得価額は0以上である必要があります");
  }

  const eventLabel =
    input.event === "DISSOLUTION"
      ? "発行会社の解散(清算結了)"
      : "発行会社の破産手続開始の決定";

  return {
    event: input.event,
    deemedTransferLossJpy: acquisitionCostJpy,
    notes: [
      `${eventLabel}により株式としての価値を失ったため、取得価額と同額(${acquisitionCostJpy.toString()}円)を譲渡価額0円によるみなし譲渡損失として認識する(国税庁タックスアンサーNo.1531)。`,
      "このみなし譲渡損失は、実際に譲渡した場合の損失と同様に扱い、No.1532(その年の一般株式等・上場株式等に係る譲渡所得等の金額からの控除)・No.1533(3年間の繰越控除)の対象にできる。",
    ],
  };
}

export interface AngelTaxCurrentYearOffsetInput {
  /**
   * その年中に特定株式の譲渡等(No.1531のみなし譲渡を含む)により生じた
   * 損失の金額の合計額(0以上で入力)
   */
  specificStockLossJpy: Decimal.Value;
  /**
   * 特定株式分の損失を含めて計算した、その年の一般株式等に係る譲渡所得等の
   * 金額(赤字の場合は負値で入力)
   */
  generalStockNetGainJpy: Decimal.Value;
  /** この特例適用前の、その年の上場株式等に係る譲渡所得等の金額(0以上で入力) */
  listedStockCapitalGainJpy: Decimal.Value;
}

export interface AngelTaxCurrentYearOffsetResult {
  /** 一般株式等に係る譲渡所得等の金額(赤字の場合は0円に切り捨て) */
  generalStockTaxableGainJpy: Decimal;
  /** 特定株式の損失のうち、一般株式等の譲渡所得等の金額の計算上控除しきれなかった部分 */
  unabsorbedSpecificStockLossJpy: Decimal;
  /** 上場株式等に係る譲渡所得等の金額から控除した額(No.1532) */
  usedAgainstListedStockJpy: Decimal;
  /** この特例控除後の、上場株式等に係る譲渡所得等の金額 */
  listedStockCapitalGainAfterJpy: Decimal;
  /** その年のうちに控除しきれず、翌年以後3年間の繰越控除(No.1533)の対象になる金額 */
  newLossForCarryforwardJpy: Decimal;
  notes: string[];
}

/**
 * No.1532「特定投資株式に係る譲渡損失の損益の計算の特例」による、その年分の
 * 控除計算。特定株式の損失は、まず一般株式等に係る譲渡所得等の金額の計算上
 * (他の一般株式等の譲渡益と)通常どおり通算されている前提(`generalStockNetGainJpy`)
 * で、なお控除しきれない部分だけがこの特例により上場株式等の譲渡所得等から
 * 控除できる。
 */
export function calculateAngelTaxCurrentYearOffset(
  input: AngelTaxCurrentYearOffsetInput,
): AngelTaxCurrentYearOffsetResult {
  const specificStockLossJpy = new Decimal(input.specificStockLossJpy);
  const generalStockNetGainJpy = new Decimal(input.generalStockNetGainJpy);
  const listedStockCapitalGainJpy = new Decimal(input.listedStockCapitalGainJpy);

  if (specificStockLossJpy.isNegative()) {
    throw new Error("特定株式に係る譲渡損失の金額は0以上である必要があります");
  }
  if (listedStockCapitalGainJpy.isNegative()) {
    throw new Error(
      "適用前の上場株式等に係る譲渡所得等の金額は0以上である必要があります",
    );
  }

  const generalStockTaxableGainJpy = Decimal.max(0, generalStockNetGainJpy);

  // 一般株式等の譲渡所得等の金額が赤字(またはゼロ)である部分に限り、特定株式の
  // 損失が「控除しきれなかった」とみなす。他の一般株式等の損益で吸収された部分は
  // 通常どおりその年限りで切り捨てられ、この特例による繰越・上場株式等への
  // 控除の対象にはならない。
  const generalStockLossJpy = Decimal.max(0, generalStockNetGainJpy.neg());
  const unabsorbedSpecificStockLossJpy = Decimal.min(
    specificStockLossJpy,
    generalStockLossJpy,
  );

  const usedAgainstListedStockJpy = Decimal.min(
    unabsorbedSpecificStockLossJpy,
    listedStockCapitalGainJpy,
  );
  const listedStockCapitalGainAfterJpy = listedStockCapitalGainJpy.minus(
    usedAgainstListedStockJpy,
  );
  const newLossForCarryforwardJpy = unabsorbedSpecificStockLossJpy.minus(
    usedAgainstListedStockJpy,
  );

  const notes: string[] = [
    "国税庁タックスアンサーNo.1532「特定投資株式に係る譲渡損失の損益の計算の特例」による。特定株式に係る譲渡損失は、まずその年の一般株式等に係る譲渡所得等の金額の計算上他の一般株式等の譲渡益と通算されている前提(generalStockNetGainJpyに反映済み)で、その一般株式等のプール全体が赤字になっている部分に限り、特定株式の損失が「控除しきれなかった」ものとして扱い、上場株式等に係る譲渡所得等の金額から控除できる。",
  ];
  if (usedAgainstListedStockJpy.greaterThan(0)) {
    notes.push(
      `一般株式等の譲渡所得等の金額の計算上控除しきれなかった${unabsorbedSpecificStockLossJpy.toString()}円のうち、${usedAgainstListedStockJpy.toString()}円を上場株式等に係る譲渡所得等の金額から控除した。`,
    );
  }
  if (newLossForCarryforwardJpy.greaterThan(0)) {
    notes.push(
      `${newLossForCarryforwardJpy.toString()}円はその年のうちに控除しきれなかったため、国税庁タックスアンサーNo.1533による翌年以後3年間の繰越控除の対象になる(この試算結果を翌年分の登録フォームへ手入力すること)。`,
    );
  }

  return {
    generalStockTaxableGainJpy,
    unabsorbedSpecificStockLossJpy,
    usedAgainstListedStockJpy,
    listedStockCapitalGainAfterJpy,
    newLossForCarryforwardJpy,
    notes,
  };
}

export interface AngelTaxLossCarryforwardEntry {
  /** 損失が発生した年(暦年) */
  originYear: number;
  /** 計算対象年の年初時点で残っている繰越控除可能な損失額 */
  remainingAmountJpy: Decimal.Value;
}

export interface AngelTaxLossCarryforwardUsage {
  originYear: number;
  usedAgainstGeneralStockJpy: Decimal;
  usedAgainstListedStockJpy: Decimal;
}

export interface AngelTaxLossCarryforwardExpiry {
  originYear: number;
  expiredAmountJpy: Decimal;
}

export interface AngelTaxLossCarryforwardBalance {
  originYear: number;
  remainingAmountJpy: Decimal;
}

export interface AngelTaxLossCarryforwardResult {
  currentYear: number;
  usedByOriginYear: AngelTaxLossCarryforwardUsage[];
  totalUsedAgainstGeneralStockJpy: Decimal;
  totalUsedAgainstListedStockJpy: Decimal;
  /** 繰越控除適用後の、一般株式等に係る譲渡所得等の金額 */
  generalStockTaxableGainAfterCarryforwardJpy: Decimal;
  /** 繰越控除適用後の、上場株式等に係る譲渡所得等の金額 */
  listedStockCapitalGainAfterCarryforwardJpy: Decimal;
  /** 控除期限(発生年+3年)を過ぎて当年は使用できなかった損失 */
  expiredByOriginYear: AngelTaxLossCarryforwardExpiry[];
  /** 翌年に繰り越す残高(発生年ごと。当年の新規損失を含む) */
  carryforwardToNextYear: AngelTaxLossCarryforwardBalance[];
  notes: string[];
}

/**
 * No.1533「特定投資株式に係る譲渡損失の繰越控除の特例」による繰越控除の適用結果。
 * 発生年が古いものから優先して、その年の一般株式等に係る譲渡所得等の金額
 * (`generalStockTaxableGainJpy`。特定株式以外の損益で既に計算済みの、その年の
 * 課税対象額)、次に上場株式等に係る譲渡所得等の金額(`listedStockCapitalGainJpy`。
 * その年のNo.1532による当年分の控除後の金額)の順に控除する。当年新たに発生した
 * 未控除額(`currentYearNewLossJpy`。`calculateAngelTaxCurrentYearOffset`の
 * `newLossForCarryforwardJpy`)は、発生年が最も新しいため最後に(=当年の残余
 * capacityに対してのみ)適用される。
 */
export function calculateAngelTaxLossCarryforward(
  currentYear: number,
  generalStockTaxableGainJpy: Decimal.Value,
  listedStockCapitalGainJpy: Decimal.Value,
  currentYearNewLossJpy: Decimal.Value,
  entries: AngelTaxLossCarryforwardEntry[],
): AngelTaxLossCarryforwardResult {
  const generalCapacity = new Decimal(generalStockTaxableGainJpy);
  const listedCapacity = new Decimal(listedStockCapitalGainJpy);
  const newLoss = new Decimal(currentYearNewLossJpy);

  if (generalCapacity.isNegative()) {
    throw new Error("一般株式等に係る譲渡所得等の金額は0以上である必要があります");
  }
  if (listedCapacity.isNegative()) {
    throw new Error("上場株式等に係る譲渡所得等の金額は0以上である必要があります");
  }
  if (newLoss.isNegative()) {
    throw new Error("当年新たに発生した未控除額は0以上である必要があります");
  }

  const allEntries: AngelTaxLossCarryforwardEntry[] = [
    ...entries,
    ...(newLoss.greaterThan(0)
      ? [{ originYear: currentYear, remainingAmountJpy: newLoss }]
      : []),
  ];

  const sorted = allEntries
    .map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: new Decimal(e.remainingAmountJpy),
    }))
    .filter((e) => e.remainingAmountJpy.greaterThan(0))
    .sort((a, b) => a.originYear - b.originYear);

  const expiredByOriginYear: AngelTaxLossCarryforwardExpiry[] = [];
  const usable: AngelTaxLossCarryforwardEntry[] = [];

  for (const e of sorted) {
    // originYear の損失は originYear+1 〜 originYear+3 の3年間のみ控除に使える
    if (currentYear > e.originYear + CARRYFORWARD_YEARS) {
      expiredByOriginYear.push({
        originYear: e.originYear,
        expiredAmountJpy: e.remainingAmountJpy,
      });
    } else {
      usable.push(e);
    }
  }

  let availableGeneral = generalCapacity;
  let availableListed = listedCapacity;
  const usedByOriginYear: AngelTaxLossCarryforwardUsage[] = [];
  const carryforwardToNextYear: AngelTaxLossCarryforwardBalance[] = [];

  for (const e of usable) {
    const remainingAmountJpy = new Decimal(e.remainingAmountJpy);
    const usedAgainstGeneralStockJpy = Decimal.min(remainingAmountJpy, availableGeneral);
    availableGeneral = availableGeneral.minus(usedAgainstGeneralStockJpy);
    const afterGeneral = remainingAmountJpy.minus(usedAgainstGeneralStockJpy);

    const usedAgainstListedStockJpy = Decimal.min(afterGeneral, availableListed);
    availableListed = availableListed.minus(usedAgainstListedStockJpy);
    const afterListed = afterGeneral.minus(usedAgainstListedStockJpy);

    if (usedAgainstGeneralStockJpy.greaterThan(0) || usedAgainstListedStockJpy.greaterThan(0)) {
      usedByOriginYear.push({
        originYear: e.originYear,
        usedAgainstGeneralStockJpy,
        usedAgainstListedStockJpy,
      });
    }
    if (afterListed.greaterThan(0)) {
      carryforwardToNextYear.push({
        originYear: e.originYear,
        remainingAmountJpy: afterListed,
      });
    }
  }

  const totalUsedAgainstGeneralStockJpy = usedByOriginYear.reduce(
    (sum, u) => sum.plus(u.usedAgainstGeneralStockJpy),
    new Decimal(0),
  );
  const totalUsedAgainstListedStockJpy = usedByOriginYear.reduce(
    (sum, u) => sum.plus(u.usedAgainstListedStockJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "国税庁タックスアンサーNo.1533「特定投資株式に係る譲渡損失の繰越控除の特例」による。発生年が古いものから優先して、その年の一般株式等に係る譲渡所得等の金額、次に上場株式等に係る譲渡所得等の金額の順に控除する(いずれも0円が下限)。",
    "この特例の適用を受けるには、損失が生じた年分以後、一般株式等・上場株式等の譲渡がなかった年分も含めて、一定の書類を添付した確定申告書を連続して提出する必要がある(未提出の年があると繰越控除は受けられない)。",
  ];
  if (expiredByOriginYear.length > 0) {
    notes.push(
      `控除期限(発生年の翌年以後3年)を過ぎたため、${expiredByOriginYear
        .map((e) => `${e.originYear}年分 ${e.expiredAmountJpy.toString()}円`)
        .join(" / ")}は当年使用できなかった。`,
    );
  }

  return {
    currentYear,
    usedByOriginYear,
    totalUsedAgainstGeneralStockJpy,
    totalUsedAgainstListedStockJpy,
    generalStockTaxableGainAfterCarryforwardJpy: generalCapacity.minus(
      totalUsedAgainstGeneralStockJpy,
    ),
    listedStockCapitalGainAfterCarryforwardJpy: listedCapacity.minus(
      totalUsedAgainstListedStockJpy,
    ),
    expiredByOriginYear,
    carryforwardToNextYear: carryforwardToNextYear.sort(
      (a, b) => a.originYear - b.originYear,
    ),
    notes,
  };
}
