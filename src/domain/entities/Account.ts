export type AccountType = 'corrente' | 'poupanca' | 'cartao_credito';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountDTO {
  name: string;
  type: AccountType;
  initial_balance: number;
  color: string;
  icon: string;
}

export interface UpdateAccountDTO {
  name?: string;
  type?: AccountType;
  initial_balance?: number;
  color?: string;
  icon?: string;
}
