
import BetterSqlite3 from 'better-sqlite3';

type Param = string | number | boolean | null;

interface Rows {
  length: number;
  item: (i: number) => Record<string, unknown>;
  raw: () => Record<string, unknown>[];
}

interface ResultSet {
  rows: Rows;
  rowsAffected: number;
  insertId?: number;
}

const databases = new Map<string, BetterSqlite3.Database>();
export const openedDatabaseNames: string[] = [];

export function resetAllDatabases(): void {
  for (const db of databases.values()) {
    db.close();
  }
  databases.clear();
  openedDatabaseNames.length = 0;
}

function normalizeParams(params: Param[]): (string | number | null)[] {
  return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p));
}

function toResultSet(rowsArr: Record<string, unknown>[], changes = 0, insertId?: number): ResultSet {
  return {
    rows: { length: rowsArr.length, item: (i) => rowsArr[i], raw: () => rowsArr },
    rowsAffected: changes,
    insertId,
  };
}

function createAdapter(db: BetterSqlite3.Database) {
  return {
    executeSql: async (sql: string, params: Param[] = []): Promise<[ResultSet]> => {
      const trimmed = sql.trim();

      if (/^PRAGMA\s+\w+\s*=/i.test(trimmed)) {
        db.exec(trimmed);
        return [toResultSet([])];
      }
      const stmt = db.prepare(trimmed);
      const bound = normalizeParams(params);
      if (stmt.reader) {
        return [toResultSet(stmt.all(...bound) as Record<string, unknown>[])];
      }
      const info = stmt.run(...bound);
      return [toResultSet([], info.changes, Number(info.lastInsertRowid))];
    },
    transaction: async () => {},
    readTransaction: async () => {},
    close: async () => {},
  };
}

const SQLite = {
  enablePromise: (_enable: boolean): void => {},
  openDatabase: async (options: { name: string; location: string }) => {
    let db = databases.get(options.name);
    if (!db) {
      db = new BetterSqlite3(':memory:');
      databases.set(options.name, db);
    }
    openedDatabaseNames.push(options.name);
    return createAdapter(db);
  },
  deleteDatabase: async (options: { name: string; location: string }) => {
    const db = databases.get(options.name);
    if (db) {
      db.close();
      databases.delete(options.name);
    }
  },
};

export default SQLite;
module.exports = SQLite;
module.exports.default = SQLite;
module.exports.resetAllDatabases = resetAllDatabases;
module.exports.openedDatabaseNames = openedDatabaseNames;
