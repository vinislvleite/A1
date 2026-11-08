import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { Migration } from './migration_001_initial';
import { CREATE_TAGS_TABLE, CREATE_TRANSACTION_TAGS_TABLE } from '../schema';

const safeAddColumn = async (db: SQLiteDatabase, sql: string): Promise<void> => {
  try {
    await db.executeSql(sql);
  } catch {
    return;
  }
};

export const migration004Sprint2BlockA: Migration = {
  version: 4,
  name: 'sprint2_block_a_transactions_and_categories',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN recurrence_parent_id TEXT;');
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN installment_group_id TEXT;');
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN installment_number INTEGER;');
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN installment_total INTEGER;');
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN is_extra_income INTEGER NOT NULL DEFAULT 0;');
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN income_source TEXT;');
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN color_label TEXT;');
    await safeAddColumn(db, "ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmada';");
    await safeAddColumn(db, 'ALTER TABLE categories ADD COLUMN description TEXT;');

    await db.executeSql(CREATE_TAGS_TABLE);
    await db.executeSql(CREATE_TRANSACTION_TAGS_TABLE);

    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_parent ON transactions(recurrence_parent_id);');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_installment_group ON transactions(installment_group_id);');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_extra_income ON transactions(is_extra_income);');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON transaction_tags(tag_id);');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transaction_tags_tx ON transaction_tags(transaction_id);');

    try {
      const [res] = await db.executeSql('SELECT id, tags FROM transactions;');
      if (res && res.rows) {
        for (let i = 0; i < res.rows.length; i++) {
          const row = res.rows.item(i) as { id: string; tags?: string };
          if (!row.tags) continue;
          let parsed: string[] = [];
          try {
            parsed = JSON.parse(row.tags) as string[];
          } catch {
            parsed = [];
          }
          for (const rawTag of parsed) {
            const cleanTag = String(rawTag).trim().toLowerCase();
            if (!cleanTag) continue;
            const tagId = `tag_${cleanTag.replace(/[^a-z0-9_-]/g, '_')}`;
            await db.executeSql('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?);', [tagId, cleanTag]);
            const [tagRes] = await db.executeSql('SELECT id FROM tags WHERE name = ?;', [cleanTag]);
            const resolvedTagId =
              tagRes && tagRes.rows && tagRes.rows.length > 0
                ? String((tagRes.rows.item(0) as { id: string }).id)
                : tagId;
            await db.executeSql(
              'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?);',
              [row.id, resolvedTagId]
            );
          }
        }
      }
    } catch {
      return;
    }
  },
  down: async (_db: SQLiteDatabase): Promise<void> => {},
};
