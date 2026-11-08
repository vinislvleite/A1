import { DatabaseManager } from '../data/database/SQLiteDatabase';
import { runMigrations } from '../data/database/migrations';
import { EncryptionStorage } from './EncryptionStorage';
import { LogService } from './LogService';
import { generateUUID } from '../utils/uuid';

export const MAX_BACKUPS = 7;
export const CURRENT_SCHEMA_VERSION = 7;
export const LAST_AUTO_BACKUP_DATE_KEY = 'backup_last_auto_date';
export const LAST_BACKUP_TIMESTAMP_KEY = 'backup_last_timestamp';
export const BACKUP_PASSWORD_STORAGE_KEY = 'orcamento_facil_backup_secret';

export interface BackupMetadata {
  id: string;
  fileName: string;
  fileUri: string;
  createdAt: string;
  schemaVersion: number;
  sizeBytes: number;
  isAutoBackup: boolean;
  isSafetyBackup?: boolean;
}

export interface EncryptedBackupEnvelope {
  format: 'ORCAMENTO_FACIL_ENC_V1';
  createdAt: string;
  schemaVersion: number;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
}

export interface BackupPlaintextPayload {
  app: 'OrcamentoFacil';
  schemaVersion: number;
  exportedAt: string;
  userId: string;
  tables: Record<string, Record<string, unknown>[]>;
}

const USER_TABLES_TO_BACKUP = [
  'categories',
  'accounts',
  'transactions',
  'tags',
  'transaction_tags',
  'budgets',
  'zero_based_allocations',
  'events',
  'daily_limits',
  'app_settings',
  'category_spending_goals',
  'recurring_bills',
  'bill_payments',
  'goals',
];

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function utf8ToBytes(str: string): number[] {
  const encoded = encodeURIComponent(str);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

function bytesToUtf8(bytes: number[]): string {
  let encoded = '';
  for (let i = 0; i < bytes.length; i++) {
    encoded += '%' + ('00' + (bytes[i] & 0xff).toString(16)).slice(-2);
  }
  return decodeURIComponent(encoded);
}

function bytesToHex(bytes: number[]): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += ('00' + (bytes[i] & 0xff).toString(16)).slice(-2);
  }
  return hex;
}

function hexToBytes(hex: string): number[] {
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new Error('Formato hexadecimal inválido no arquivo de backup.');
  }
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

function sha256Bytes(msgBytes: number[]): number[] {
  const words: number[] = [];
  for (let i = 0; i < msgBytes.length; i++) {
    words[i >> 2] |= (msgBytes[i] & 0xff) << (24 - (i % 4) * 8);
  }
  const bitLength = msgBytes.length * 8;
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Array<number>(64);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) {
      w[t] = words[i + t] | 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[t] + w[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const out: number[] = [];
  const hs = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (const val of hs) {
    out.push((val >>> 24) & 0xff);
    out.push((val >>> 16) & 0xff);
    out.push((val >>> 8) & 0xff);
    out.push(val & 0xff);
  }
  return out;
}

function hmacSha256(keyBytes: number[], dataBytes: number[]): number[] {
  const blockSize = 64;
  let normalizedKey = [...keyBytes];
  if (normalizedKey.length > blockSize) {
    normalizedKey = sha256Bytes(normalizedKey);
  }
  while (normalizedKey.length < blockSize) {
    normalizedKey.push(0);
  }

  const oKeyPad: number[] = [];
  const iKeyPad: number[] = [];
  for (let i = 0; i < blockSize; i++) {
    oKeyPad.push(normalizedKey[i] ^ 0x5c);
    iKeyPad.push(normalizedKey[i] ^ 0x36);
  }

  const innerHash = sha256Bytes(iKeyPad.concat(dataBytes));
  return sha256Bytes(oKeyPad.concat(innerHash));
}

export function deriveBackupKeys(
  password: string,
  saltHex: string,
  iterations: number = 600
): { encKey: number[]; macKey: number[] } {
  const pwdBytes = utf8ToBytes(password);
  const saltBytes = hexToBytes(saltHex);

  let derived = sha256Bytes(pwdBytes.concat(saltBytes));
  for (let i = 0; i < iterations; i++) {
    derived = sha256Bytes(derived.concat(pwdBytes).concat(saltBytes));
  }

  const encKey = hmacSha256(derived, utf8ToBytes('enc_key_v1'));
  const macKey = hmacSha256(derived, utf8ToBytes('mac_key_v1'));
  return { encKey, macKey };
}

function xorKeystream(dataBytes: number[], encKey: number[], ivHex: string): number[] {
  const ivBytes = hexToBytes(ivHex);
  const out = new Array<number>(dataBytes.length);
  let blockIndex = 0;
  let offset = 0;

  while (offset < dataBytes.length) {
    const counterBytes = [
      (blockIndex >>> 24) & 0xff,
      (blockIndex >>> 16) & 0xff,
      (blockIndex >>> 8) & 0xff,
      blockIndex & 0xff,
    ];
    const keystreamBlock = hmacSha256(encKey, ivBytes.concat(counterBytes));
    const chunkLen = Math.min(32, dataBytes.length - offset);
    for (let i = 0; i < chunkLen; i++) {
      out[offset + i] = dataBytes[offset + i] ^ keystreamBlock[i];
    }
    offset += chunkLen;
    blockIndex++;
  }
  return out;
}

export function encryptBackupPayload(
  payload: BackupPlaintextPayload,
  password: string
): EncryptedBackupEnvelope {
  if (!password || password.trim().length < 4) {
    throw new Error('A senha de backup deve ter pelo menos 4 caracteres.');
  }

  const saltHex = bytesToHex(sha256Bytes(utf8ToBytes(generateUUID() + Date.now().toString())));
  const ivHex = bytesToHex(sha256Bytes(utf8ToBytes(generateUUID() + Math.random().toString()))).slice(0, 32);
  const { encKey, macKey } = deriveBackupKeys(password, saltHex);

  const plaintextJson = JSON.stringify(payload);
  const plaintextBytes = utf8ToBytes(plaintextJson);
  const cipherBytes = xorKeystream(plaintextBytes, encKey, ivHex);
  const ciphertextHex = bytesToHex(cipherBytes);

  const authData = utf8ToBytes(
    `ORCAMENTO_FACIL_ENC_V1|${payload.schemaVersion}|${saltHex}|${ivHex}|${ciphertextHex}`
  );
  const macHex = bytesToHex(hmacSha256(macKey, authData));

  return {
    format: 'ORCAMENTO_FACIL_ENC_V1',
    createdAt: payload.exportedAt,
    schemaVersion: payload.schemaVersion,
    salt: saltHex,
    iv: ivHex,
    ciphertext: ciphertextHex,
    mac: macHex,
  };
}

export function decryptBackupEnvelope(
  rawEnvelopeOrJson: string | EncryptedBackupEnvelope,
  password: string
): BackupPlaintextPayload {
  let envelope: EncryptedBackupEnvelope;
  if (typeof rawEnvelopeOrJson === 'string') {
    try {
      envelope = JSON.parse(rawEnvelopeOrJson) as EncryptedBackupEnvelope;
    } catch {
      throw new Error('Arquivo de backup corrompido ou formato JSON inválido.');
    }
  } else {
    envelope = rawEnvelopeOrJson;
  }

  if (
    !envelope ||
    envelope.format !== 'ORCAMENTO_FACIL_ENC_V1' ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.mac !== 'string' ||
    typeof envelope.schemaVersion !== 'number'
  ) {
    throw new Error('Arquivo de backup corrompido ou cabeçalho inválido.');
  }

  const { encKey, macKey } = deriveBackupKeys(password, envelope.salt);
  const authData = utf8ToBytes(
    `ORCAMENTO_FACIL_ENC_V1|${envelope.schemaVersion}|${envelope.salt}|${envelope.iv}|${envelope.ciphertext}`
  );
  const expectedMac = bytesToHex(hmacSha256(macKey, authData));

  if (expectedMac !== envelope.mac) {
    throw new Error('Senha de backup incorreta ou arquivo adulterado.');
  }

  const cipherBytes = hexToBytes(envelope.ciphertext);
  const plainBytes = xorKeystream(cipherBytes, encKey, envelope.iv);

  let decodedJson = '';
  try {
    decodedJson = bytesToUtf8(plainBytes);
  } catch {
    throw new Error('Falha ao decodificar conteúdo do backup (dados corrompidos).');
  }

  let parsed: BackupPlaintextPayload;
  try {
    parsed = JSON.parse(decodedJson) as BackupPlaintextPayload;
  } catch {
    throw new Error('Conteúdo interno do backup está corrompido.');
  }

  if (
    !parsed ||
    parsed.app !== 'OrcamentoFacil' ||
    typeof parsed.schemaVersion !== 'number' ||
    typeof parsed.tables !== 'object' ||
    parsed.tables === null
  ) {
    throw new Error('Estrutura interna do backup é inválida.');
  }

  return parsed;
}

interface StoredBackupRecord {
  metadata: BackupMetadata;
  encryptedContent: string;
}

export class BackupService {
  private static memoryBackups = new Map<string, StoredBackupRecord[]>();
  private dbManager = DatabaseManager.getInstance();

  public static clearAllBackupsForTest(): void {
    BackupService.memoryBackups.clear();
  }

  private getUserBackupBucket(): StoredBackupRecord[] {
    const userId = this.dbManager.getActiveUserId() || 'default';
    let bucket = BackupService.memoryBackups.get(userId);
    if (!bucket) {
      bucket = [];
      BackupService.memoryBackups.set(userId, bucket);
    }
    return bucket;
  }

  private setUserBackupBucket(records: StoredBackupRecord[]): void {
    const userId = this.dbManager.getActiveUserId() || 'default';
    BackupService.memoryBackups.set(userId, records);
  }

  public async saveBackupPassword(password: string): Promise<void> {
    if (!password || password.trim().length < 4) {
      throw new Error('A senha de backup deve ter pelo menos 4 caracteres.');
    }
    const userId = this.dbManager.getActiveUserId() || 'default';
    await EncryptionStorage.setItem(`${BACKUP_PASSWORD_STORAGE_KEY}_${userId}`, {
      password: password.trim(),
    });
  }

  public async getSavedBackupPassword(): Promise<string | null> {
    try {
      const userId = this.dbManager.getActiveUserId() || 'default';
      const item = await EncryptionStorage.getItem<{ password?: string }>(
        `${BACKUP_PASSWORD_STORAGE_KEY}_${userId}`
      );
      return item?.password ?? null;
    } catch {
      return null;
    }
  }

  public async getLastBackupInfo(): Promise<{
    lastTimestamp: string | null;
    lastAutoDate: string | null;
    backupCount: number;
  }> {
    let lastTimestamp: string | null = null;
    let lastAutoDate: string | null = null;

    try {
      const tsRes = await this.dbManager.executeQuery(
        'SELECT key, value FROM app_settings WHERE key = ?;',
        [LAST_BACKUP_TIMESTAMP_KEY]
      );
      if (tsRes.rows.length > 0) {
        lastTimestamp = (tsRes.rows.item(0) as { value?: string }).value ?? null;
      }

      const autoRes = await this.dbManager.executeQuery(
        'SELECT key, value FROM app_settings WHERE key = ?;',
        [LAST_AUTO_BACKUP_DATE_KEY]
      );
      if (autoRes.rows.length > 0) {
        lastAutoDate = (autoRes.rows.item(0) as { value?: string }).value ?? null;
      }
    } catch {}

    const bucket = this.getUserBackupBucket();
    return {
      lastTimestamp,
      lastAutoDate,
      backupCount: bucket.length,
    };
  }

  public async listBackups(): Promise<BackupMetadata[]> {
    const bucket = this.getUserBackupBucket();
    return [...bucket]
      .sort((a, b) => b.metadata.createdAt.localeCompare(a.metadata.createdAt))
      .map((r) => ({ ...r.metadata }));
  }

  public getBackupEncryptedContent(backupIdOrUri: string): string | null {
    const bucket = this.getUserBackupBucket();
    const found = bucket.find(
      (b) =>
        b.metadata.id === backupIdOrUri ||
        b.metadata.fileUri === backupIdOrUri ||
        b.metadata.fileName === backupIdOrUri
    );
    return found ? found.encryptedContent : null;
  }

  public async exportDatabaseTables(): Promise<{
    schemaVersion: number;
    tables: Record<string, Record<string, unknown>[]>;
  }> {
    let schemaVersion = CURRENT_SCHEMA_VERSION;
    try {
      const vRes = await this.dbManager.executeQuery('PRAGMA user_version;');
      if (vRes.rows.length > 0) {
        const v = (vRes.rows.item(0) as { user_version?: number }).user_version;
        if (typeof v === 'number' && v > 0) {
          schemaVersion = v;
        }
      }
    } catch {}

    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const table of USER_TABLES_TO_BACKUP) {
      try {
        const res = await this.dbManager.executeQuery(`SELECT * FROM ${table};`);
        const rows: Record<string, unknown>[] = [];
        for (let i = 0; i < res.rows.length; i++) {
          rows.push({ ...(res.rows.item(i) as Record<string, unknown>) });
        }
        tables[table] = rows;
      } catch {
        tables[table] = [];
      }
    }

    return { schemaVersion, tables };
  }

  public async createBackup(
    password: string,
    options?: {
      isAutoBackup?: boolean;
      isSafetyBackup?: boolean;
      customCreatedAt?: string;
    }
  ): Promise<{ metadata: BackupMetadata; encryptedContent: string }> {
    try {
      if (!password || password.trim().length < 4) {
        throw new Error('Informe uma senha de backup válida (mínimo 4 caracteres).');
      }

      const { schemaVersion, tables } = await this.exportDatabaseTables();
      const createdAt = options?.customCreatedAt ?? new Date().toISOString();
      const userId = this.dbManager.getActiveUserId() || 'default';

      const payload: BackupPlaintextPayload = {
        app: 'OrcamentoFacil',
        schemaVersion,
        exportedAt: createdAt,
        userId,
        tables,
      };

      const envelope = encryptBackupPayload(payload, password.trim());
      const encryptedContent = JSON.stringify(envelope);

      const id = generateUUID();
      const safeTimestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 14);
      const fileName = `backup_orcamentofacil_${safeTimestamp}_${id.slice(0, 6)}.enc.json`;
      const fileUri = `internal://backups/${userId}/${fileName}`;

      const metadata: BackupMetadata = {
        id,
        fileName,
        fileUri,
        createdAt,
        schemaVersion,
        sizeBytes: encryptedContent.length,
        isAutoBackup: Boolean(options?.isAutoBackup),
        isSafetyBackup: Boolean(options?.isSafetyBackup),
      };

      const bucket = this.getUserBackupBucket();
      bucket.push({ metadata, encryptedContent });

      bucket.sort((a, b) => b.metadata.createdAt.localeCompare(a.metadata.createdAt));
      while (bucket.length > MAX_BACKUPS) {
        bucket.pop();
      }
      this.setUserBackupBucket(bucket);

      await this.dbManager.executeQuery(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
        [LAST_BACKUP_TIMESTAMP_KEY, createdAt]
      );

      if (options?.isAutoBackup) {
        const ymd = createdAt.substring(0, 10);
        await this.dbManager.executeQuery(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
          [LAST_AUTO_BACKUP_DATE_KEY, ymd]
        );
      }

      return { metadata, encryptedContent };
    } catch (error: unknown) {
      const rawMsg = error instanceof Error ? error.message : 'Erro desconhecido no backup';
      await LogService.getInstance().logCriticalError(
        'BACKUP_CREATE_FAILED',
        `Falha ao gerar backup criptografado: ${rawMsg}`
      );
      throw error;
    }
  }

  public async runDailyAutoBackupIfNeeded(
    passwordOverride?: string,
    referenceDate: Date = new Date()
  ): Promise<{ executed: boolean; metadata?: BackupMetadata; reason?: string }> {
    try {
      const todayYmd = referenceDate.toISOString().substring(0, 10);
      const info = await this.getLastBackupInfo();

      if (info.lastAutoDate === todayYmd) {
        return { executed: false, reason: 'already_done_today' };
      }

      const password = passwordOverride ?? (await this.getSavedBackupPassword());
      if (!password) {
        return { executed: false, reason: 'no_backup_password' };
      }

      const { metadata } = await this.createBackup(password, {
        isAutoBackup: true,
        customCreatedAt: referenceDate.toISOString(),
      });

      return { executed: true, metadata };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha no backup diário';
      await LogService.getInstance().logCriticalError(
        'AUTO_BACKUP_DAILY_FAILED',
        `Falha na rotina de backup diário: ${msg}`
      );
      return { executed: false, reason: 'error' };
    }
  }

  private validatePayloadIntegrity(payload: BackupPlaintextPayload): void {
    if (payload.schemaVersion < 1 || payload.schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Versão de schema do backup (${payload.schemaVersion}) incompatível com a versão atual (${CURRENT_SCHEMA_VERSION}).`
      );
    }

    for (const [tableName, rows] of Object.entries(payload.tables)) {
      if (!Array.isArray(rows)) {
        throw new Error(`Tabela "${tableName}" inválida no arquivo de backup.`);
      }
      for (const row of rows) {
        if (typeof row !== 'object' || row === null) {
          throw new Error(`Registro inválido na tabela "${tableName}".`);
        }
        if (tableName === 'accounts' && (!row.id || !row.name || !row.type)) {
          throw new Error('Registro de conta bancária inválido no backup.');
        }
        if (
          tableName === 'transactions' &&
          (!row.id || !row.account_id || !row.category_id || typeof row.value !== 'number')
        ) {
          throw new Error('Registro de transação inválido ou corrompido no backup.');
        }
      }
    }
  }

  private async applyTablesToDatabase(
    tables: Record<string, Record<string, unknown>[]>,
    schemaVersion: number
  ): Promise<void> {
    await this.dbManager.executeQuery('BEGIN TRANSACTION;');
    try {
      const reverseOrder = [...USER_TABLES_TO_BACKUP].reverse();
      for (const table of reverseOrder) {
        await this.dbManager.executeQuery(`DELETE FROM ${table};`);
      }

      for (const table of USER_TABLES_TO_BACKUP) {
        const rows = tables[table];
        if (!rows || rows.length === 0) continue;

        for (const row of rows) {
          const cols = Object.keys(row).filter((k) => row[k] !== undefined);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const values = cols.map((c) => {
            const v = row[c];
            if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
              return v;
            }
            return JSON.stringify(v);
          });

          await this.dbManager.executeQuery(
            `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders});`,
            values
          );
        }
      }

      await this.dbManager.executeQuery(`PRAGMA user_version = ${schemaVersion};`);
      await this.dbManager.executeQuery('COMMIT;');
    } catch (err: unknown) {
      await this.dbManager.executeQuery('ROLLBACK;');
      throw err;
    }
  }

  public async restoreBackup(params: {
    backupIdOrUri?: string;
    rawEncryptedContent?: string;
    password: string;
    createSafetyBackupFirst?: boolean;
    simulateMidRestoreFailure?: boolean;
  }): Promise<{
    restoredSchemaVersion: number;
    finalSchemaVersion: number;
    safetyBackupId?: string;
  }> {
    let rawContent = params.rawEncryptedContent ?? null;
    if (!rawContent && params.backupIdOrUri) {
      rawContent = this.getBackupEncryptedContent(params.backupIdOrUri);
    }

    if (!rawContent) {
      throw new Error('Arquivo de backup não encontrado.');
    }

    let decrypted: BackupPlaintextPayload;
    try {
      decrypted = decryptBackupEnvelope(rawContent, params.password.trim());
      this.validatePayloadIntegrity(decrypted);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha na validação do backup';
      await LogService.getInstance().logCriticalError(
        'BACKUP_RESTORE_VALIDATION_FAILED',
        `Falha ao validar backup para restauração: ${msg}`
      );
      throw error;
    }

    const previousSnapshot = await this.exportDatabaseTables();

    let safetyBackupId: string | undefined;
    if (params.createSafetyBackupFirst !== false) {
      const safety = await this.createBackup(params.password.trim(), {
        isSafetyBackup: true,
      });
      safetyBackupId = safety.metadata.id;
    }

    try {
      if (params.simulateMidRestoreFailure) {
        await this.dbManager.executeQuery('BEGIN TRANSACTION;');
        await this.dbManager.executeQuery('DELETE FROM transactions;');
        await this.dbManager.executeQuery('DELETE FROM accounts;');
        throw new Error('Falha simulada durante a escrita da restauração.');
      }

      await this.applyTablesToDatabase(decrypted.tables, decrypted.schemaVersion);

      if (decrypted.schemaVersion < CURRENT_SCHEMA_VERSION) {
        const targetDb =
          (await this.dbManager.getDatabase()) ?? this.dbManager.createMockDatabaseAdapter();
        await runMigrations(targetDb);
      }

      const vRes = await this.dbManager.executeQuery('PRAGMA user_version;');
      const finalSchemaVersion =
        vRes.rows.length > 0
          ? Number((vRes.rows.item(0) as { user_version?: number }).user_version ?? CURRENT_SCHEMA_VERSION)
          : CURRENT_SCHEMA_VERSION;

      return {
        restoredSchemaVersion: decrypted.schemaVersion,
        finalSchemaVersion,
        safetyBackupId,
      };
    } catch (error: unknown) {
      try {
        await this.applyTablesToDatabase(
          previousSnapshot.tables,
          previousSnapshot.schemaVersion
        );
      } catch {}

      const msg = error instanceof Error ? error.message : 'Falha durante a restauração';
      await LogService.getInstance().logCriticalError(
        'BACKUP_RESTORE_ATOMIC_ROLLBACK',
        `Restauração falhou e rollback foi executado: ${msg}`
      );
      throw error;
    }
  }
}
