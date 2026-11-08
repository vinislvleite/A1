import { DatabaseManager } from '../src/data/database/SQLiteDatabase';
import { generateUUID } from '../src/utils/uuid';

export interface Seed10kResult {
  transactionCount: number;
  accountCount: number;
  billCount: number;
  eventCount: number;
  tagCount: number;
}

export async function seed10kTestDatabase(
  dbManager: DatabaseManager,
  userId: string = 'user-perf-10k'
): Promise<Seed10kResult> {
  if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_TEST_SEED !== 'true') {
    throw new Error('Seed de testes bloqueado em ambiente de produção.');
  }

  await dbManager.setActiveUser(userId);
  const rawDb = await dbManager.getUserDatabase();
  if (!rawDb) {
    throw new Error('Falha ao abrir banco de dados para seed de testes.');
  }

  const accounts = [
    { id: 'acc_corrente_1', name: 'Conta Corrente Principal', type: 'corrente', balance: 15000.0, limit: 0, closing: 0, due: 0 },
    { id: 'acc_cartao_1', name: 'Cartão de Crédito Black', type: 'cartao_credito', balance: 0.0, limit: 12000.0, closing: 10, due: 17 },
    { id: 'acc_poupanca_1', name: 'Reserva Poupança', type: 'poupanca', balance: 25000.0, limit: 0, closing: 0, due: 0 },
  ];

  for (const acc of accounts) {
    await dbManager.executeQuery(
      'INSERT OR REPLACE INTO accounts (id, name, type, initial_balance, credit_limit, closing_day, due_day, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [acc.id, acc.name, acc.type, acc.balance, acc.limit, acc.closing, acc.due, '#2563EB', 'credit-card', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    );
  }

  const categories = [
    { id: 'cat_alim', name: 'Alimentação' },
    { id: 'cat_transp', name: 'Transporte' },
    { id: 'cat_moradia', name: 'Moradia' },
    { id: 'cat_lazer', name: 'Lazer' },
    { id: 'cat_saude', name: 'Saúde' },
    { id: 'cat_salario', name: 'Salário' },
    { id: 'cat_freela', name: 'Freela' },
  ];

  for (const cat of categories) {
    await dbManager.executeQuery(
      'INSERT OR IGNORE INTO categories (id, name, color, icon, is_custom) VALUES (?, ?, ?, ?, ?);',
      [cat.id, cat.name, '#10B981', 'grid', 0]
    );
  }

  const events = [
    { id: 'event_ferias', name: 'Férias 2026', limit: 8000.0, start: '2026-07-01', end: '2026-07-20' },
    { id: 'event_reforma', name: 'Reforma Casa', limit: 15000.0, start: '2026-03-01', end: '2026-06-30' },
  ];

  for (const ev of events) {
    await dbManager.executeQuery(
      'INSERT OR REPLACE INTO events (id, name, limit_value, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?);',
      [ev.id, ev.name, ev.limit, ev.start, ev.end, '2026-01-01T00:00:00.000Z']
    );
  }

  const recurringBills = [
    { id: 'bill_aluguel', name: 'Aluguel Apartamento', value: 2200.0, due: 10, cat: 'cat_moradia', acc: 'acc_corrente_1' },
    { id: 'bill_internet', name: 'Fibra Óptica', value: 129.9, due: 15, cat: 'cat_moradia', acc: 'acc_corrente_1' },
    { id: 'bill_academia', name: 'Academia', value: 110.0, due: 5, cat: 'cat_saude', acc: 'acc_cartao_1' },
  ];

  for (const bill of recurringBills) {
    await dbManager.executeQuery(
      'INSERT OR REPLACE INTO recurring_bills (id, name, value, due_day, reminder_days_before, category_id, account_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [bill.id, bill.name, bill.value, bill.due, 3, bill.cat, bill.acc, 1, '2026-01-01T00:00:00.000Z']
    );
  }

  const tagList = [
    { id: 'tag_urgente', name: 'urgente' },
    { id: 'tag_fixo', name: 'fixo' },
    { id: 'tag_trabalho', name: 'trabalho' },
    { id: 'tag_pessoal', name: 'pessoal' },
    { id: 'tag_viagem', name: 'viagem' },
    { id: 'tag_essencial', name: 'essencial' },
    { id: 'tag_superfluo', name: 'superfluo' },
  ];

  for (const t of tagList) {
    await dbManager.executeQuery(
      'INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?);',
      [t.id, t.name]
    );
  }

  const TOTAL_TRANSACTIONS = 10000;
  const BATCH_SIZE = 500;

  await rawDb.executeSql('BEGIN TRANSACTION;');

  try {
    for (let batchStart = 0; batchStart < TOTAL_TRANSACTIONS; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_TRANSACTIONS);
      for (let i = batchStart; i < batchEnd; i++) {
        const txId = `seed_tx_${i.toString().padStart(6, '0')}`;
        const dayOfMonth = (Math.floor(i / 3) % 28) + 1;
        const monthNum = (Math.floor(i / 7) % 12) + 1;
        const yearNum = 2026;
        const dateIso = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}T12:00:00.000Z`;

        const accountId = i % 3 === 1 ? 'acc_cartao_1' : i % 3 === 2 ? 'acc_poupanca_1' : 'acc_corrente_1';
        const isIncome = accountId === 'acc_cartao_1' ? false : (i % 10 === 0);
        const type = isIncome ? 'receita' : 'despesa';
        const categoryId = isIncome ? (i % 20 === 0 ? 'cat_freela' : 'cat_salario') : categories[i % 5].id;
        const value = isIncome ? 1500.0 + (i % 500) : 10.0 + (i % 250);

        let recurrenceParentId: string | null = null;
        let isRecurring = 0;
        let recurrenceDay: number | null = null;
        if (i < 1500) {
          isRecurring = i % 10 === 0 ? 1 : 0;
          recurrenceDay = 15;
          if (!isRecurring) {
            recurrenceParentId = `seed_parent_${Math.floor(i / 10)}`;
          }
        }

        let installmentGroupId: string | null = null;
        let installmentNumber: number | null = null;
        let installmentTotal: number | null = null;
        if (i >= 1500 && i < 3500) {
          const groupIdx = Math.floor((i - 1500) / 4);
          installmentGroupId = `seed_grp_${groupIdx}`;
          installmentNumber = ((i - 1500) % 4) + 1;
          installmentTotal = 4;
        }

        const isExtraIncome = isIncome && categoryId === 'cat_freela' ? 1 : 0;
        const incomeSource = isExtraIncome ? 'Consultoria Técnica' : null;
        const eventId = i >= 3500 && i < 4500 ? (i % 2 === 0 ? 'event_ferias' : 'event_reforma') : null;
        const status = i >= 4500 && i < 5000 ? 'pendente' : 'confirmada';
        const colorLabel = i % 4 === 0 ? '#3B82F6' : i % 4 === 1 ? '#10B981' : null;

        await rawDb.executeSql(
          `INSERT INTO transactions (
            id, account_id, category_id, value, type, description, date,
            recurrence_parent_id, is_recurring, recurrence_day,
            installment_group_id, installment_number, installment_total,
            is_extra_income, income_source, color_label, event_id, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            txId,
            accountId,
            categoryId,
            value,
            type,
            `Lançamento de teste seed #${i}`,
            dateIso,
            recurrenceParentId,
            isRecurring,
            recurrenceDay,
            installmentGroupId,
            installmentNumber,
            installmentTotal,
            isExtraIncome,
            incomeSource,
            colorLabel,
            eventId,
            status,
            dateIso,
            dateIso,
          ]
        );

        const assignedTag = tagList[i % tagList.length];
        await rawDb.executeSql(
          'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?);',
          [txId, assignedTag.id]
        );
      }
    }
    await rawDb.executeSql('COMMIT;');
  } catch (err) {
    await rawDb.executeSql('ROLLBACK;');
    throw err;
  }

  return {
    transactionCount: TOTAL_TRANSACTIONS,
    accountCount: accounts.length,
    billCount: recurringBills.length,
    eventCount: events.length,
    tagCount: tagList.length,
  };
}
