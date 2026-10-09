"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { TotalTaxEstimateForm } from "./TotalTaxEstimateForm";
import { getTaxEstimatePageData } from "@/lib/taxEstimatePageData";
import type { TaxEstimatePageData } from "@/lib/taxEstimatePageData.types";

export function TaxEstimatePageContent() {
  const searchParams = useSearchParams();
  const yearParam = Number(searchParams.get("year")) || null;

  const [data, setData] = useState<TaxEstimatePageData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getTaxEstimatePageData(yearParam);
      setData(result);
    });
  }, [yearParam]);

  if (!data) {
    return <TaxEstimatePageSkeleton />;
  }

  const {
    year,
    defaultOtherComprehensiveIncomeJpy,
    defaultCryptoMiscIncomeJpy,
    defaultInvestmentTaxableGainJpy,
    defaultNonListedInvestmentTaxableGainJpy,
    defaultFuturesTaxableGainJpy,
    defaultDividendIncomeJpy,
    defaultAvailableListedStockLossForDividendJpy,
    registeredIncomeDeductions,
    totalRegisteredIncomeTaxDeductionJpy,
    incomeDeductionNotes,
    registeredEmploymentIncome,
    registeredResidentTaxAdjustmentDeductionJpy,
    registeredMortgageDeduction,
    registeredDonationTaxCreditJpy,
    registeredDonationTaxCreditResidentTaxJpy,
    registeredForeignTaxCredit,
    registeredDistributionAdjustedForeignTaxCreditJpy,
    registeredEarthquakeRenovationDeductionJpy,
    registeredEnergySavingRenovationDeductionJpy,
    registeredBarrierFreeRenovationDeductionJpy,
    registeredMultiHouseholdRenovationDeductionJpy,
    registeredDurabilityImprovementRenovationDeductionJpy,
    registeredChildRearingRenovationDeductionJpy,
    registeredCertifiedHousingConstructionCreditJpy,
  } = data;

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10"
      aria-busy={isPending}
    >
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          所得税・住民税の概算合計税額試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          暗号資産の雑所得・株式等(上場株式等・一般株式等)の譲渡所得等・配当所得・
          先物取引に係る雑所得等を合算し、その年の所得税・復興特別所得税・住民税の
          概算合計額を試算する。株式等・配当・先物取引の各金額はこの年の集計値を
          初期値として表示している。上場株式等と一般株式等(非上場株式)は別プールの
          申告分離課税で損益通算はできない。
        </p>
      </header>

      <TotalTaxEstimateForm
        defaultOtherComprehensiveIncomeJpy={defaultOtherComprehensiveIncomeJpy}
        defaultCryptoMiscIncomeJpy={defaultCryptoMiscIncomeJpy}
        defaultInvestmentTaxableGainJpy={defaultInvestmentTaxableGainJpy}
        defaultNonListedInvestmentTaxableGainJpy={defaultNonListedInvestmentTaxableGainJpy}
        defaultFuturesTaxableGainJpy={defaultFuturesTaxableGainJpy}
        defaultDividendIncomeJpy={defaultDividendIncomeJpy}
        defaultAvailableListedStockLossForDividendJpy={
          defaultAvailableListedStockLossForDividendJpy
        }
        registeredIncomeDeductions={registeredIncomeDeductions}
        totalRegisteredIncomeTaxDeductionJpy={totalRegisteredIncomeTaxDeductionJpy}
        incomeDeductionNotes={incomeDeductionNotes}
        defaultResidentTaxAdjustmentDeductionJpy={
          registeredResidentTaxAdjustmentDeductionJpy ?? 0
        }
        registeredResidentTaxAdjustmentDeductionJpy={registeredResidentTaxAdjustmentDeductionJpy}
        defaultMortgageDeductionNationalTaxCreditJpy={
          registeredMortgageDeduction?.nationalTaxCreditJpy ?? 0
        }
        defaultMortgageDeductionResidentTaxCreditJpy={
          registeredMortgageDeduction?.residentTaxCreditJpy ?? 0
        }
        registeredMortgageDeduction={registeredMortgageDeduction}
        defaultDonationTaxCreditJpy={registeredDonationTaxCreditJpy ?? 0}
        registeredDonationTaxCreditJpy={registeredDonationTaxCreditJpy}
        defaultDonationTaxCreditResidentTaxJpy={registeredDonationTaxCreditResidentTaxJpy ?? 0}
        registeredDonationTaxCreditResidentTaxJpy={registeredDonationTaxCreditResidentTaxJpy}
        defaultForeignTaxCreditNationalTaxCreditJpy={
          registeredForeignTaxCredit?.nationalTaxCreditJpy ?? 0
        }
        defaultForeignTaxCreditResidentTaxCreditJpy={
          registeredForeignTaxCredit?.residentTaxCreditJpy ?? 0
        }
        registeredForeignTaxCredit={registeredForeignTaxCredit}
        defaultDistributionAdjustedForeignTaxCreditJpy={
          registeredDistributionAdjustedForeignTaxCreditJpy ?? 0
        }
        registeredDistributionAdjustedForeignTaxCreditJpy={
          registeredDistributionAdjustedForeignTaxCreditJpy
        }
        defaultEarthquakeRenovationDeductionJpy={registeredEarthquakeRenovationDeductionJpy ?? 0}
        registeredEarthquakeRenovationDeductionJpy={registeredEarthquakeRenovationDeductionJpy}
        defaultEnergySavingRenovationDeductionJpy={
          registeredEnergySavingRenovationDeductionJpy ?? 0
        }
        registeredEnergySavingRenovationDeductionJpy={
          registeredEnergySavingRenovationDeductionJpy
        }
        defaultBarrierFreeRenovationDeductionJpy={
          registeredBarrierFreeRenovationDeductionJpy ?? 0
        }
        registeredBarrierFreeRenovationDeductionJpy={
          registeredBarrierFreeRenovationDeductionJpy
        }
        defaultMultiHouseholdRenovationDeductionJpy={
          registeredMultiHouseholdRenovationDeductionJpy ?? 0
        }
        registeredMultiHouseholdRenovationDeductionJpy={
          registeredMultiHouseholdRenovationDeductionJpy
        }
        defaultDurabilityImprovementRenovationDeductionJpy={
          registeredDurabilityImprovementRenovationDeductionJpy ?? 0
        }
        registeredDurabilityImprovementRenovationDeductionJpy={
          registeredDurabilityImprovementRenovationDeductionJpy
        }
        defaultChildRearingRenovationDeductionJpy={
          registeredChildRearingRenovationDeductionJpy ?? 0
        }
        registeredChildRearingRenovationDeductionJpy={
          registeredChildRearingRenovationDeductionJpy
        }
        defaultCertifiedHousingConstructionCreditJpy={
          registeredCertifiedHousingConstructionCreditJpy ?? 0
        }
        registeredCertifiedHousingConstructionCreditJpy={
          registeredCertifiedHousingConstructionCreditJpy
        }
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「給与所得等の課税所得金額」は、本ツールが管理していない給与所得等について、
          各種所得控除(基礎控除・社会保険料控除等)を差し引いた後の金額を入力する
          (源泉徴収票の「給与所得控除後の金額」から更に所得控除を差し引いた額に相当)。
          {registeredEmploymentIncome !== null ? (
            <>
              <Link href="/employment-income" className="underline">
                /employment-income
              </Link>
              で登録済みの{year}年分の給与収入(¥
              {registeredEmploymentIncome.grossSalaryJpy.toLocaleString("ja-JP")})から計算した
              給与所得金額(¥{registeredEmploymentIncome.employmentIncomeJpy.toLocaleString("ja-JP")})
              を基礎とする。
            </>
          ) : (
            <>
              <Link href="/employment-income" className="underline">
                /employment-income
              </Link>
              で給与収入を登録していない場合、実際の給与収入額とは無関係な仮の値(500万円)を
              基礎とする(登録すると実際の給与収入から計算した給与所得金額に切り替わる)。
            </>
          )}
          医療費控除・生命保険料控除・小規模企業共済等掛金控除(iDeCo等)・社会保険料控除の
          各試算画面で「この試算結果を◯年分の所得控除として登録する」を実行済みの場合、
          その合計額(所得税ベース)を上記の基礎額から差し引いた額を初期値として表示する。
          基礎控除等それ以外の所得控除は引き続き含まれないため、実際の金額は自分で確認して
          上書きすること。
        </p>
        <p>
          住民税の調整控除(税額控除)は`/resident-tax-adjustment-deduction`で「この
          試算結果を◯年分の住民税の調整控除として登録する」を実行済みの場合、その
          控除額を初期値として表示する。住民税所得割のみが対象(所得税に対応する
          控除は無い)で、住宅ローン控除・外国税額控除より先に住民税所得割額から
          差し引く。
        </p>
        <p>
          住宅ローン控除(税額控除)は`/mortgage-deduction`で「この試算結果を◯年分の
          住宅ローン控除として登録する」を実行済みの場合、所得税分・住民税分それぞれの
          控除額を初期値として表示する。ここで求まる合計税額から直接差し引くため、控除額が
          合計税額を上回っても0円が下限(還付は生じない)。ふるさと納税の上限額の試算は
          住宅ローン控除適用前の住民税所得割額を基準にしており、住宅ローン控除による
          変動は含めていない。
        </p>
        <p>
          政党等・認定NPO法人等・公益社団法人等寄附金特別控除(税額控除)は
          <Link href={`/donation-tax-credit?year=${year}`} className="underline">
            /donation-tax-credit
          </Link>
          で「この年分の寄附金特別控除として登録する」を実行済みの場合、その控除額を
          初期値として表示する。所得税のみの制度(住民税分は無い)のため、住宅ローン控除
          適用後の所得税額からのみ差し引く。
        </p>
        <p>
          住宅耐震改修特別控除(税額控除)は
          <Link href={`/earthquake-renovation-deduction?year=${year}`} className="underline">
            /earthquake-renovation-deduction
          </Link>
          で「この試算結果を◯年分の住宅耐震改修特別控除として登録する」を実行済みの場合、
          その控除額を初期値として表示する。住民税に相当する控除は無いため、寄附金特別控除
          適用後の所得税額からのみ差し引く。
        </p>
        <p>
          多世帯同居改修工事の住宅特定改修特別税額控除(税額控除)は
          <Link href={`/multi-household-renovation-deduction?year=${year}`} className="underline">
            /multi-household-renovation-deduction
          </Link>
          で「この試算結果を◯年分の多世帯同居改修工事に係る住宅特定改修特別税額控除として
          登録する」を実行済みの場合、その控除額を初期値として表示する。住民税に相当する
          控除は無いため、バリアフリー改修工事の住宅特定改修特別税額控除適用後の所得税額
          からのみ差し引く。
        </p>
        <p>
          認定住宅等新築等特別税額控除(税額控除)は
          <Link href={`/certified-housing-construction-credit?year=${year}`} className="underline">
            /certified-housing-construction-credit
          </Link>
          で「この試算結果を◯年分の認定住宅等新築等特別税額控除として登録する」を
          実行済みの場合、その控除額を初期値として表示する。住民税に相当する控除は
          無いため、子育て対応改修工事の住宅特定改修特別税額控除適用後の所得税額
          からのみ差し引く。
        </p>
        <p>
          外国税額控除(税額控除)は`/foreign-tax-credit`で「この年分の外国税額控除として
          登録する」を実行済みの場合、所得税・復興特別所得税から控除される額と住民税から
          控除される額(実際の控除順序である所得税→復興特別所得税→住民税の順に振り分けた
          金額)を初期値として表示する。住宅ローン控除・寄附金特別控除・住宅耐震改修特別控除を
          適用した後の税額からさらに差し引くため、控除額の合計が合計税額を上回っても0円が下限
          (還付は生じない)。
        </p>
        <p>
          分配時調整外国税相当額控除(税額控除)は
          <Link href={`/distribution-adjusted-foreign-tax-credit?year=${year}`} className="underline">
            /distribution-adjusted-foreign-tax-credit
          </Link>
          で「この年分の分配時調整外国税相当額控除として登録する」を実行済みの場合、その
          控除額を初期値として表示する。外国税額控除と異なり控除限度額の計算・繰越は無く、
          外国税額控除適用後の所得税額(復興特別所得税を含む)からのみ差し引く(住民税分は
          本ツールでは試算しない)。
        </p>
        <p>
          住民税所得割は10%固定の概算であり、調整控除は`/resident-tax-adjustment-deduction`で
          登録した場合のみ税額控除として反映する(未登録の場合は含まない)。均等割(定額部分。
          標準税率は年5,000円程度だが自治体の超過課税により異なる場合がある)は
          住所情報から自動算出できないため、住民税決定通知書等で確認した金額を
          入力した場合のみ合計住民税額に加算する(未入力の場合は含まれない)。
          源泉徴収税額(給与・配当・特定口座内の譲渡益等)と予定納税額
          (所得税・復興特別所得税の第1期・第2期の納付済み合計額)を入力すると、
          その年の税額との差額として納付・還付見込み額を試算できる。予定納税は
          所得税・復興特別所得税のみの制度で住民税には存在しないため、住民税分の
          納付・還付見込み額には反映されない。延滞税・加算税や予定納税の減額申請等は
          考慮していないため、実際の納付額・還付額とは異なる概算値である点に注意する。
          特に特定口座(源泉徴収あり)分の住民税相当額は、確定申告時にその場で
          還付されるのではなく翌年度の住民税に反映される形で精算される。
        </p>
        <p>
          本ツールの計算結果は概算であり、実際の申告内容は国税庁「確定申告書等作成
          コーナー」の計算結果や税理士等の専門家の確認を受けること。
        </p>
      </div>
    </div>
  );
}

export function TaxEstimatePageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <p className="text-sm text-neutral-500">読み込み中…</p>
    </div>
  );
}
