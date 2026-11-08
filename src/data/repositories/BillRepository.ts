import { DatabaseManager } from '../database/SQLiteDatabase';
import { RecurringBill, BillPayment } from '../../domain/entities/RecurringBill';

export class BillRepository {
  private dbManager = DatabaseManager.getInstance();

  private mapRowToBill(row: Record<string, unknown>): RecurringBill {
    return {
      id: String(row.id),
      name: String(row.name),
      value: Number(row.value),
      due_day: Number(row.due_day),
      reminder_days_before: Number(row.reminder_days_before ?? 3),
      category_id: String(row.category_id),
      account_id: row.account_id ? String(row.account_id) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      is_active: row.is_active === undefined ? true : Boolean(Number(row.is_active)),
      created_at: String(row.created_at),
    };
  }

  private mapRowToPayment(row: Record<string, unknown>): BillPayment {
    return {
      id: String(row.id),
      bill_id: String(row.bill_id),
      month: Number(row.month),
      year: Number(row.year),
      paid_at: String(row.paid_at),
      transaction_id: row.transaction_id ? String(row.transaction_id) : undefined,
    };
  }

  public async create(bill: RecurringBill): Promise<void> {
    await this.dbManager.executeQuery(
      `INSERT INTO recurring_bills (
        id, name, value, due_day, reminder_days_before, category_id, account_id, notes, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        bill.id,
        bill.name,
        bill.value,
        bill.due_day,
        bill.reminder_days_before,
        bill.category_id,
        bill.account_id ?? null,
        bill.notes ?? null,
        bill.is_active ? 1 : 0,
        bill.created_at,
      ]
    );
  }

  public async update(bill: RecurringBill): Promise<void> {
    await this.dbManager.executeQuery(
      `UPDATE recurring_bills SET
        name = ?, value = ?, due_day = ?, reminder_days_before = ?, category_id = ?, account_id = ?, notes = ?, is_active = ?
      WHERE id = ?;`,
      [
        bill.name,
        bill.value,
        bill.due_day,
        bill.reminder_days_before,
        bill.category_id,
        bill.account_id ?? null,
        bill.notes ?? null,
        bill.is_active ? 1 : 0,
        bill.id,
      ]
    );
  }

  public async delete(id: string): Promise<void> {
    await this.dbManager.executeQuery('DELETE FROM recurring_bills WHERE id = ?;', [id]);
  }

  public async findById(id: string): Promise<RecurringBill | null> {
    const result = await this.dbManager.executeQuery(
      'SELECT * FROM recurring_bills WHERE id = ?;',
      [id]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToBill(result.rows.item(0) as Record<string, unknown>);
  }

  public async findAllActive(): Promise<RecurringBill[]> {
    const result = await this.dbManager.executeQuery(
      'SELECT * FROM recurring_bills WHERE is_active = 1 ORDER BY due_day ASC;'
    );
    const list: RecurringBill[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      list.push(this.mapRowToBill(result.rows.item(i) as Record<string, unknown>));
    }
    return list;
  }

  public async findAll(): Promise<RecurringBill[]> {
    const result = await this.dbManager.executeQuery(
      'SELECT * FROM recurring_bills ORDER BY due_day ASC;'
    );
    const list: RecurringBill[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      list.push(this.mapRowToBill(result.rows.item(i) as Record<string, unknown>));
    }
    return list;
  }

  public async markBillPaid(payment: BillPayment): Promise<void> {
    await this.dbManager.executeQuery(
      `INSERT OR REPLACE INTO bill_payments (
        id, bill_id, month, year, paid_at, transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?);`,
      [
        payment.id,
        payment.bill_id,
        payment.month,
        payment.year,
        payment.paid_at,
        payment.transaction_id ?? null,
      ]
    );
  }

  public async unmarkBillPaid(billId: string, month: number, year: number): Promise<void> {
    await this.dbManager.executeQuery(
      'DELETE FROM bill_payments WHERE bill_id = ? AND month = ? AND year = ?;',
      [billId, month, year]
    );
  }

  public async findPayment(billId: string, month: number, year: number): Promise<BillPayment | null> {
    const result = await this.dbManager.executeQuery(
      'SELECT * FROM bill_payments WHERE bill_id = ? AND month = ? AND year = ?;',
      [billId, month, year]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToPayment(result.rows.item(0) as Record<string, unknown>);
  }

  public async findPaymentsByMonth(month: number, year: number): Promise<BillPayment[]> {
    const result = await this.dbManager.executeQuery(
      'SELECT * FROM bill_payments WHERE month = ? AND year = ?;',
      [month, year]
    );
    const list: BillPayment[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      list.push(this.mapRowToPayment(result.rows.item(i) as Record<string, unknown>));
    }
    return list;
  }
}
