import { DatabaseManager } from './SQLiteDatabase';
import { UserRepository } from '../repositories/UserRepository';
import { AccountRepository } from '../repositories/AccountRepository';
import { CategoryRepository } from '../repositories/CategoryRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { BudgetRepository } from '../repositories/BudgetRepository';
import { GoalRepository } from '../repositories/GoalRepository';
import { CreateTransactionDTO } from '../../domain/entities/Transaction';

export async function seedDemoUser(): Promise<boolean> {
  const dbManager = DatabaseManager.getInstance();
  const previousUser = dbManager.getActiveUserId();
  const userRepository = new UserRepository(dbManager);

  let user = await userRepository.findByEmail('teste@orcamentofacil.com');
  if (!user) {
    user = await userRepository.createUser({
      name: 'Vinicius Leite',
      email: 'teste@orcamentofacil.com',
      username: 'vinileite',
      password: 'Teste123!',
    });
  } else if (!user.username) {
    await dbManager.executeQuery('UPDATE users SET username = ? WHERE id = ?;', ['vinileite', user.id]);
    user.username = 'vinileite';
  }

  await dbManager.setActiveUser(user.id);

  const accountRepository = new AccountRepository(dbManager);
  const existingAccounts = await accountRepository.findAll();
  if (existingAccounts.length > 0) {
    await dbManager.setActiveUser(previousUser);
    return false;
  }

  const categoryRepository = new CategoryRepository(dbManager);
  const transactionRepository = new TransactionRepository(dbManager);
  const budgetRepository = new BudgetRepository(dbManager);
  const goalRepository = new GoalRepository(dbManager);

  const contaCorrente = await accountRepository.create({
    name: 'Conta Corrente',
    type: 'corrente',
    initial_balance: 1500.0,
    color: '#3B82F6',
    icon: 'credit-card',
  });

  const poupanca = await accountRepository.create({
    name: 'Poupança',
    type: 'poupanca',
    initial_balance: 5000.0,
    color: '#10B981',
    icon: 'dollar-sign',
  });

  const nubank = await accountRepository.create({
    name: 'Cartão Nubank',
    type: 'cartao_credito',
    initial_balance: 0.0,
    color: '#8B5CF6',
    icon: 'credit-card',
  });

  const catAlimentacao = await categoryRepository.create({
    name: 'Alimentação',
    description: 'Supermercado, restaurantes e delivery',
    color: '#F59E0B',
    icon: 'coffee',
    is_custom: false,
  });

  const catTransporte = await categoryRepository.create({
    name: 'Transporte',
    description: 'Combustível, ônibus e viagens',
    color: '#3B82F6',
    icon: 'navigation',
    is_custom: false,
  });

  const catLazer = await categoryRepository.create({
    name: 'Lazer',
    description: 'Cinema, passeios e diversão',
    color: '#EC4899',
    icon: 'smile',
    is_custom: false,
  });

  const catMoradia = await categoryRepository.create({
    name: 'Moradia',
    description: 'Aluguel, contas de luz e água',
    color: '#10B981',
    icon: 'home',
    is_custom: false,
  });

  const catSaude = await categoryRepository.create({
    name: 'Saúde',
    description: 'Farmácia, exames e consultas',
    color: '#EF4444',
    icon: 'activity',
    is_custom: false,
  });

  const catEducacao = await categoryRepository.create({
    name: 'Educação',
    description: 'Cursos, livros e faculdade',
    color: '#8B5CF6',
    icon: 'book',
    is_custom: false,
  });

  const catSalario = await categoryRepository.create({
    name: 'Salário',
    description: 'Salário mensal e benefícios',
    color: '#22C55E',
    icon: 'dollar-sign',
    is_custom: false,
  });

  const catFreelance = await categoryRepository.create({
    name: 'Freelance',
    description: 'Projetos extras e consultorias',
    color: '#6366F1',
    icon: 'briefcase',
    is_custom: false,
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const getDate = (daysAgo: number, hours: number, minutes: number): string => {
    const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const transactionsData: CreateTransactionDTO[] = [
    {
      account_id: contaCorrente.id,
      category_id: catAlimentacao.id,
      value: 42.5,
      type: 'despesa',
      description: 'Almoço Restaurante',
      date: getDate(0, 12, 30),
      is_recurring: false,
      tags: ['almoço', 'trabalho'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catFreelance.id,
      value: 1200.0,
      type: 'receita',
      description: 'Projeto Web Freelance',
      date: getDate(0, 9, 15),
      is_recurring: false,
      tags: ['freela', 'cliente'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catTransporte.id,
      value: 22.8,
      type: 'despesa',
      description: 'Transporte por Aplicativo',
      date: getDate(1, 18, 40),
      is_recurring: false,
      tags: ['transporte', 'volta'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catAlimentacao.id,
      value: 185.4,
      type: 'despesa',
      description: 'Supermercado Semanal',
      date: getDate(2, 16, 20),
      is_recurring: false,
      tags: ['mercado', 'casa'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catLazer.id,
      value: 58.0,
      type: 'despesa',
      description: 'Cinema e Pipoca',
      date: getDate(3, 20, 10),
      is_recurring: false,
      tags: ['cinema', 'fimdesemana'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catMoradia.id,
      value: 119.9,
      type: 'despesa',
      description: 'Internet Fibra Óptica',
      date: getDate(4, 10, 0),
      is_recurring: true,
      recurrence_day: 5,
      tags: ['contas', 'moradia'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catTransporte.id,
      value: 180.0,
      type: 'despesa',
      description: 'Combustível Posto Shell',
      date: getDate(5, 17, 30),
      is_recurring: false,
      tags: ['carro', 'gasolina'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catSaude.id,
      value: 84.6,
      type: 'despesa',
      description: 'Farmácia Drogasil',
      date: getDate(6, 11, 45),
      is_recurring: false,
      tags: ['saúde', 'medicamento'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catEducacao.id,
      value: 149.0,
      type: 'despesa',
      description: 'Curso Online TypeScript',
      date: getDate(7, 14, 0),
      is_recurring: false,
      tags: ['estudo', 'carreira'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catAlimentacao.id,
      value: 95.0,
      type: 'despesa',
      description: 'Jantar Pizzaria',
      date: getDate(8, 21, 15),
      is_recurring: false,
      tags: ['jantar', 'família'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catSalario.id,
      value: 4800.0,
      type: 'receita',
      description: 'Salário Mensal',
      date: getDate(9, 8, 0),
      is_recurring: true,
      recurrence_day: 5,
      tags: ['salario', 'empresa'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catMoradia.id,
      value: 1400.0,
      type: 'despesa',
      description: 'Aluguel do Mês',
      date: getDate(9, 9, 0),
      is_recurring: true,
      recurrence_day: 5,
      tags: ['moradia', 'fixo'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catTransporte.id,
      value: 34.2,
      type: 'despesa',
      description: 'Uber Reunião Cliente',
      date: getDate(10, 15, 30),
      is_recurring: false,
      tags: ['trabalho', 'uber'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catFreelance.id,
      value: 650.0,
      type: 'receita',
      description: 'Freela Identidade Visual',
      date: getDate(11, 16, 45),
      is_recurring: false,
      tags: ['freela', 'design'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catEducacao.id,
      value: 120.0,
      type: 'despesa',
      description: 'Livros de Arquitetura de Software',
      date: getDate(12, 13, 10),
      is_recurring: false,
      tags: ['livros', 'estudo'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catLazer.id,
      value: 110.0,
      type: 'despesa',
      description: 'Parque de Diversões Ingresso',
      date: getDate(13, 11, 0),
      is_recurring: false,
      tags: ['lazer', 'fimdesemana'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catAlimentacao.id,
      value: 28.0,
      type: 'despesa',
      description: 'Café da Tarde',
      date: getDate(14, 16, 30),
      is_recurring: false,
      tags: ['café', 'lanche'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catTransporte.id,
      value: 250.0,
      type: 'despesa',
      description: 'Manutenção e Troca de Óleo',
      date: getDate(15, 10, 30),
      is_recurring: false,
      tags: ['carro', 'manutencao'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catSaude.id,
      value: 150.0,
      type: 'despesa',
      description: 'Consulta Odontológica',
      date: getDate(16, 14, 0),
      is_recurring: false,
      tags: ['saude', 'dentista'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catLazer.id,
      value: 45.9,
      type: 'despesa',
      description: 'Assinaturas de Streaming',
      date: getDate(17, 9, 30),
      is_recurring: true,
      recurrence_day: 15,
      tags: ['lazer', 'streaming'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catAlimentacao.id,
      value: 320.0,
      type: 'despesa',
      description: 'Supermercado do Mês',
      date: getDate(18, 18, 0),
      is_recurring: false,
      tags: ['mercado', 'compras'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catTransporte.id,
      value: 50.0,
      type: 'despesa',
      description: 'Recarga Cartão Transporte',
      date: getDate(19, 8, 15),
      is_recurring: false,
      tags: ['transporte', 'onibus'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catAlimentacao.id,
      value: 36.5,
      type: 'despesa',
      description: 'Padaria Café da Manhã',
      date: getDate(20, 8, 45),
      is_recurring: false,
      tags: ['padaria', 'lanche'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catSaude.id,
      value: 120.0,
      type: 'despesa',
      description: 'Mensalidade Academia',
      date: getDate(21, 19, 0),
      is_recurring: true,
      recurrence_day: 10,
      tags: ['saude', 'treino'],
      status: 'confirmada',
    },
    {
      account_id: poupanca.id,
      category_id: catSalario.id,
      value: 42.15,
      type: 'receita',
      description: 'Rendimento da Poupança',
      date: getDate(22, 10, 0),
      is_recurring: false,
      tags: ['investimento', 'juros'],
      status: 'confirmada',
    },
    {
      account_id: contaCorrente.id,
      category_id: catMoradia.id,
      value: 164.3,
      type: 'despesa',
      description: 'Conta de Energia Elétrica',
      date: getDate(23, 11, 20),
      is_recurring: true,
      recurrence_day: 20,
      tags: ['moradia', 'luz'],
      status: 'confirmada',
    },
    {
      account_id: poupanca.id,
      category_id: catSalario.id,
      value: 500.0,
      type: 'receita',
      description: 'Depósito Reserva de Emergência',
      date: getDate(25, 14, 30),
      is_recurring: false,
      tags: ['economia', 'meta'],
      status: 'confirmada',
    },
    {
      account_id: nubank.id,
      category_id: catAlimentacao.id,
      value: 78.9,
      type: 'despesa',
      description: 'Hamburgueria com Amigos',
      date: getDate(27, 21, 30),
      is_recurring: false,
      tags: ['alimentacao', 'fimdesemana'],
      status: 'confirmada',
    },
  ];

  for (const tx of transactionsData) {
    await transactionRepository.create(tx);
  }

  await budgetRepository.create({
    category_id: catAlimentacao.id,
    month: currentMonth,
    year: currentYear,
    limit_value: 800.0,
    period_type: 'mensal',
  });

  await budgetRepository.create({
    category_id: catLazer.id,
    month: currentMonth,
    year: currentYear,
    limit_value: 300.0,
    period_type: 'mensal',
  });

  const fourMonthsLater = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
  await goalRepository.create({
    name: 'Viagem',
    target_value: 3000.0,
    deadline: fourMonthsLater.toISOString().slice(0, 10),
    current_value: 850.0,
  });

  await dbManager.setActiveUser(previousUser);
  return true;
}

export async function seedDatabase(): Promise<boolean> {
  return seedDemoUser();
}

export async function resetAndSeedDatabase(): Promise<boolean> {
  const dbManager = DatabaseManager.getInstance();
  try {
    await dbManager.executeQuery('DELETE FROM transactions;');
  } catch {}
  try {
    await dbManager.executeQuery('DELETE FROM budgets;');
  } catch {}
  try {
    await dbManager.executeQuery('DELETE FROM goals;');
  } catch {}
  try {
    await dbManager.executeQuery('DELETE FROM accounts;');
  } catch {}
  try {
    await dbManager.executeQuery('DELETE FROM categories;');
  } catch {}
  try {
    await dbManager.executeQuery('DELETE FROM users;');
  } catch {}
  return seedDemoUser();
}
