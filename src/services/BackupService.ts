export interface BackupMetadata {
  version: number;
  createdAt: string;
  checksum: string;
}

export interface IBackupService {
  createEncryptedBackup: (destinationPath: string) => Promise<string>;
  restoreEncryptedBackup: (sourcePath: string) => Promise<boolean>;
}

export class BackupService implements IBackupService {
  public async createEncryptedBackup(destinationPath: string): Promise<string> {
    if (!destinationPath) {
      throw new Error('Caminho de destino do backup inválido.');
    }
    return destinationPath;
  }

  public async restoreEncryptedBackup(sourcePath: string): Promise<boolean> {
    if (!sourcePath) {
      throw new Error('Caminho de origem do backup inválido.');
    }
    return true;
  }
}
