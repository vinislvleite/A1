export interface RevolvingInstallmentItem {
  monthNumber: number;
  installment: number;
  interest: number;
  principal: number;
  remainingBalance: number;
}

export interface RevolvingInterestResult {
  balance: number;
  monthlyRatePercent: number;
  months: number;
  firstMonthInterest: number;
  installmentAmount: number;
  totalPaid: number;
  totalInterest: number;
  schedule: RevolvingInstallmentItem[];
}

export function calculateRevolvingInterest(params: {
  balance: number;
  monthlyRatePercent: number;
  months: number;
}): RevolvingInterestResult {
  const balance = Number(params.balance);
  const monthlyRatePercent = Number(params.monthlyRatePercent);
  const months = Math.trunc(Number(params.months));

  if (!Number.isFinite(balance) || balance <= 0) {
    throw new Error('O saldo devedor deve ser maior que zero.');
  }
  if (!Number.isFinite(monthlyRatePercent) || monthlyRatePercent < 0) {
    throw new Error('A taxa mensal não pode ser negativa.');
  }
  if (!Number.isFinite(months) || months < 1 || months > 120) {
    throw new Error('O número de meses deve estar entre 1 e 120.');
  }

  const rate = monthlyRatePercent / 100;
  const firstMonthInterest = Number((balance * rate).toFixed(2));

  let installmentAmount = 0;
  if (rate === 0) {
    installmentAmount = Number((balance / months).toFixed(2));
  } else {
    const factor = Math.pow(1 + rate, months);
    const rawPmt = balance * ((rate * factor) / (factor - 1));
    installmentAmount = Number(rawPmt.toFixed(2));
  }

  const totalPaid = Number((installmentAmount * months).toFixed(2));
  const totalInterest = Number(Math.max(0, totalPaid - balance).toFixed(2));

  const schedule: RevolvingInstallmentItem[] = [];
  let remaining = balance;

  for (let m = 1; m <= months; m++) {
    const interest = Number((remaining * rate).toFixed(2));
    const principal =
      m === months
        ? Number(remaining.toFixed(2))
        : Number(Math.max(0, installmentAmount - interest).toFixed(2));
    remaining = Number(Math.max(0, remaining - principal).toFixed(2));

    schedule.push({
      monthNumber: m,
      installment: installmentAmount,
      interest,
      principal,
      remainingBalance: remaining,
    });
  }

  return {
    balance: Number(balance.toFixed(2)),
    monthlyRatePercent,
    months,
    firstMonthInterest,
    installmentAmount,
    totalPaid,
    totalInterest,
    schedule,
  };
}

export class CalculateRevolvingInterestUseCase {
  public execute(params: {
    balance: number;
    monthlyRatePercent: number;
    months: number;
  }): RevolvingInterestResult {
    return calculateRevolvingInterest(params);
  }
}
