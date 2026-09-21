export interface ExchangeRateResult {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  updatedAt: string;
}

export interface IExchangeRateService {
  getRate: (baseCurrency: string, targetCurrency: string) => Promise<ExchangeRateResult>;
}

export class ExchangeRateService implements IExchangeRateService {
  private readonly baseUrl: string = 'https://api.exchangerate-api.com/v4/latest';

  public async getRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRateResult> {
    if (!this.baseUrl.startsWith('https://')) {
      throw new Error('Comunicação externa requer estritamente o protocolo seguro HTTPS.');
    }

    if (!baseCurrency || !targetCurrency) {
      throw new Error('Moedas base e destino são obrigatórias.');
    }

    return {
      baseCurrency,
      targetCurrency,
      rate: 1.0,
      updatedAt: new Date().toISOString(),
    };
  }
}
