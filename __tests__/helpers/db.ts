import { DatabaseManager } from '../../src/data/database/SQLiteDatabase';


const sqliteMock = require('react-native-sqlite-storage') as {
  resetAllDatabases: () => void;
  openedDatabaseNames: string[];
};

export const TEST_USER_ID = 'user-sprint2';


export async function setupUserDatabase(userId: string = TEST_USER_ID): Promise<DatabaseManager> {
  const manager = DatabaseManager.getInstance();
  const fallbackSpy = jest.spyOn(manager, 'createMockDatabaseAdapter');
  await manager.setActiveUser(userId);
  await manager.getUserDatabase();
  if (fallbackSpy.mock.calls.length > 0) {
    throw new Error(
      'DatabaseManager caiu no fallback em memória: as migrations falharam no SQLite real.'
    );
  }
  fallbackSpy.mockRestore();
  return manager;
}

export function openedDatabases(): string[] {
  return [...sqliteMock.openedDatabaseNames];
}

export async function tableColumns(table: string): Promise<string[]> {
  const res = await DatabaseManager.getInstance().executeQuery(`PRAGMA table_info(${table});`);
  const cols: string[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    cols.push(String((res.rows.item(i) as { name: string }).name));
  }
  return cols;
}


export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00.000Z`;
}
