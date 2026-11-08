import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BackupService, BackupMetadata, MAX_BACKUPS } from '../services/BackupService';
import { formatDateTime as formatDateTimeUtil } from '../utils/date';
import { dialog } from '../components/dialogs';

export function BackupScreen() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<BackupMetadata | null>(null);
  const [externalBackupContent, setExternalBackupContent] = useState('');
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [restorePasswordInput, setRestorePasswordInput] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [restoreSuccessInfo, setRestoreSuccessInfo] = useState<{
    restoredVersion: number;
    finalVersion: number;
  } | null>(null);

  const backupService = new BackupService();

  const loadBackupState = useCallback(async () => {
    try {
      setIsLoading(true);
      const [list, info, savedPwd] = await Promise.all([
        backupService.listBackups(),
        backupService.getLastBackupInfo(),
        backupService.getSavedBackupPassword(),
      ]);
      setBackups(list);
      setLastTimestamp(info.lastTimestamp);
      setHasSavedPassword(Boolean(savedPwd));
      if (savedPwd && !backupPassword) {
        setBackupPassword(savedPwd);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBackupState();
    }, [loadBackupState])
  );

  const formatDateTime = (iso: string | null): string => {
    if (!iso) return 'Nenhum backup realizado';
    return formatDateTimeUtil(iso);
  };

  const handleSavePassword = async () => {
    if (backupPassword.trim().length < 4) {
      dialog.alerta({
        titulo: 'Senha curta',
        mensagem: 'Defina uma senha de backup com pelo menos 4 caracteres.',
        tipo: 'atencao',
      });
      return;
    }
    try {
      await backupService.saveBackupPassword(backupPassword.trim());
      setHasSavedPassword(true);
      dialog.alerta({
        titulo: 'Senha Configurada',
        mensagem:
          'Sua senha de backup foi salva com segurança. O backup automático diário está ativo.',
        tipo: 'sucesso',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar senha.';
      dialog.alerta({ titulo: 'Erro', mensagem: msg, tipo: 'erro' });
    }
  };

  const handleBackupNow = async () => {
    if (backupPassword.trim().length < 4) {
      dialog.alerta({
        titulo: 'Senha necessária',
        mensagem:
          'Informe uma senha de backup (mínimo 4 caracteres) para criptografar seus dados.',
        tipo: 'atencao',
      });
      return;
    }

    try {
      setIsProcessing(true);
      await backupService.saveBackupPassword(backupPassword.trim());
      setHasSavedPassword(true);
      await backupService.createBackup(backupPassword.trim(), { isAutoBackup: false });
      await loadBackupState();
      dialog.alerta({
        titulo: 'Backup Concluído',
        mensagem: 'Arquivo criptografado salvo no armazenamento interno.',
        tipo: 'sucesso',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar backup.';
      dialog.alerta({ titulo: 'Erro no Backup', mensagem: msg, tipo: 'erro' });
    } finally {
      setIsProcessing(false);
    }
  };

  const openRestoreConfirm = (item: BackupMetadata) => {
    setRestoreTarget(item);
    setRestorePasswordInput('');
    setShowRestorePassword(false);
  };

  const handleConfirmInternalRestore = async () => {
    if (!restoreTarget) return;
    if (!restorePasswordInput.trim()) {
      dialog.alerta({
        titulo: 'Senha obrigatória',
        mensagem: 'Informe a senha utilizada para criptografar este backup.',
        tipo: 'atencao',
      });
      return;
    }

    try {
      setIsProcessing(true);
      const res = await backupService.restoreBackup({
        backupIdOrUri: restoreTarget.id,
        password: restorePasswordInput.trim(),
        createSafetyBackupFirst: true,
      });
      setRestoreTarget(null);
      setRestorePasswordInput('');
      setShowRestorePassword(false);
      await loadBackupState();
      setRestoreSuccessInfo({
        restoredVersion: res.restoredSchemaVersion,
        finalVersion: res.finalSchemaVersion,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao restaurar backup.';
      dialog.alerta({ titulo: 'Falha na Restauração', mensagem: msg, tipo: 'erro' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmExternalRestore = async () => {
    if (!externalBackupContent.trim()) {
      dialog.alerta({
        titulo: 'Arquivo vazio',
        mensagem: 'Cole ou selecione o conteúdo do backup criptografado.',
        tipo: 'atencao',
      });
      return;
    }
    if (!restorePasswordInput.trim()) {
      dialog.alerta({
        titulo: 'Senha obrigatória',
        mensagem: 'Informe a senha do backup.',
        tipo: 'atencao',
      });
      return;
    }

    try {
      setIsProcessing(true);
      const res = await backupService.restoreBackup({
        rawEncryptedContent: externalBackupContent.trim(),
        password: restorePasswordInput.trim(),
        createSafetyBackupFirst: true,
      });
      setShowExternalModal(false);
      setExternalBackupContent('');
      setRestorePasswordInput('');
      setShowRestorePassword(false);
      await loadBackupState();
      setRestoreSuccessInfo({
        restoredVersion: res.restoredSchemaVersion,
        finalVersion: res.finalSchemaVersion,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao restaurar arquivo externo.';
      dialog.alerta({ titulo: 'Falha na Restauração', mensagem: msg, tipo: 'erro' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup e Segurança</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <View style={styles.statusHeaderRow}>
              <View style={styles.statusIconWrap}>
                <Feather name="shield" size={22} color="#10B981" />
              </View>
              <View style={styles.statusTextCol}>
                <Text style={styles.statusTitle}>Backup Automático Criptografado</Text>
                <Text style={styles.statusSub}>
                  {hasSavedPassword
                    ? 'Ativo • Executado automaticamente 1x ao dia'
                    : 'Pendente • Defina sua senha de backup abaixo'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Último backup realizado</Text>
                <Text style={styles.metricVal}>{formatDateTime(lastTimestamp)}</Text>
              </View>
              <View style={styles.metricItemRight}>
                <Text style={styles.metricLabel}>Rotação interna</Text>
                <Text style={styles.metricVal}>
                  {backups.length} de {MAX_BACKUPS} arquivos
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chave e Senha de Backup</Text>
            <Text style={styles.cardDesc}>
              A chave de criptografia é derivada da sua senha (SHA-256 + HMAC), permitindo restaurar seus dados mesmo após reinstalar o aplicativo.
            </Text>

            <View style={styles.inputBox}>
              <Feather name="lock" size={16} color="#60A5FA" />
              <TextInput
                style={styles.inputText}
                placeholder="Digite sua senha de backup"
                placeholderTextColor="#64748B"
                secureTextEntry={!showBackupPassword}
                value={backupPassword}
                onChangeText={setBackupPassword}
                selectionColor="#60A5FA"
              />
              <TouchableOpacity onPress={() => setShowBackupPassword((v) => !v)} activeOpacity={0.7}>
                <Feather name={showBackupPassword ? 'eye-off' : 'eye'} size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleSavePassword}
                disabled={isProcessing}>
                <Feather name="key" size={15} color="#E2E8F0" />
                <Text style={styles.secondaryBtnText}>Salvar Senha</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleBackupNow}
                disabled={isProcessing}>
                <Feather name="download-cloud" size={15} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Fazer backup agora</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.externalRestoreCard}
            onPress={() => {
              setRestorePasswordInput('');
              setShowRestorePassword(false);
              setShowExternalModal(true);
            }}
            activeOpacity={0.75}>
            <View style={styles.externalRestoreIconWrap}>
              <Feather name="folder" size={20} color="#60A5FA" />
            </View>
            <View style={styles.externalRestoreTextWrap}>
              <Text style={styles.externalRestoreTitle}>Restaurar Arquivo Externo</Text>
              <Text style={styles.externalRestoreSubtitle}>
                Importar backup criptografado (.json) de outro aparelho
              </Text>
            </View>
            <View style={styles.externalRestoreActionPill}>
              <Text style={styles.externalRestoreActionText}>Importar</Text>
              <Feather name="chevron-right" size={14} color="#60A5FA" />
            </View>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ÚLTIMOS BACKUPS INTERNOS (MÁX. {MAX_BACKUPS})</Text>
            <Text style={styles.sectionSubtitle}>
              Cópias de segurança locais salvas neste dispositivo
            </Text>
          </View>

          {backups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="hard-drive" size={32} color="#475569" />
              <Text style={styles.emptyTitle}>Nenhum backup armazenado</Text>
              <Text style={styles.emptySub}>
                Toque em "Fazer backup agora" para gerar sua primeira cópia criptografada.
              </Text>
            </View>
          ) : (
            backups.map((item) => (
              <View key={item.id} style={styles.backupItemCard}>
                <View style={styles.backupItemLeft}>
                  <View style={styles.backupBadgeRow}>
                    <Text style={styles.backupDateText}>{formatDateTime(item.createdAt)}</Text>
                    <View
                      style={[
                        styles.typeBadge,
                        item.isSafetyBackup
                          ? styles.typeBadgeSafety
                          : item.isAutoBackup
                            ? styles.typeBadgeAuto
                            : styles.typeBadgeManual,
                      ]}>
                      <Text style={styles.typeBadgeText}>
                        {item.isSafetyBackup
                          ? 'Segurança'
                          : item.isAutoBackup
                            ? 'Automático'
                            : 'Manual'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.backupFileText} numberOfLines={1}>
                    {item.fileName} • Schema v{item.schemaVersion}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.restoreBtn}
                  onPress={() => openRestoreConfirm(item)}>
                  <Feather name="rotate-ccw" size={14} color="#FFFFFF" />
                  <Text style={styles.restoreBtnText}>Restaurar</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(restoreTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRestoreTarget(null);
          setRestorePasswordInput('');
          setShowRestorePassword(false);
        }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.warningHeader}>
              <Feather name="alert-triangle" size={22} color="#F59E0B" />
              <Text style={styles.modalTitle}>Confirmar Restauração</Text>
            </View>

            <Text style={styles.modalDesc}>
              Os dados atuais serão substituídos pelo backup de{' '}
              {restoreTarget ? formatDateTime(restoreTarget.createdAt) : ''}. Um backup de segurança será criado automaticamente antes de aplicar, e se algo falhar seus dados atuais serão mantidos intactos.
            </Text>

            <Text style={styles.inputLabel}>Senha do Backup</Text>
            <View style={styles.inputBox}>
              <Feather name="key" size={16} color="#60A5FA" />
              <TextInput
                style={styles.inputText}
                placeholder="Informe a senha deste backup"
                placeholderTextColor="#64748B"
                secureTextEntry={!showRestorePassword}
                value={restorePasswordInput}
                onChangeText={setRestorePasswordInput}
                selectionColor="#60A5FA"
              />
              <TouchableOpacity onPress={() => setShowRestorePassword((v) => !v)} activeOpacity={0.7}>
                <Feather name={showRestorePassword ? 'eye-off' : 'eye'} size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setRestoreTarget(null);
                  setRestorePasswordInput('');
                  setShowRestorePassword(false);
                }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmInternalRestore}
                disabled={isProcessing}>
                <Text style={styles.confirmBtnText}>Restaurar Agora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showExternalModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowExternalModal(false);
          setRestorePasswordInput('');
          setShowRestorePassword(false);
        }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.externalModalHeader}>
              <View style={styles.externalRestoreIconWrap}>
                <Feather name="folder" size={20} color="#60A5FA" />
              </View>
              <View style={styles.externalModalHeaderTextWrap}>
                <Text style={styles.modalTitle}>Restaurar Backup Externo</Text>
                <Text style={styles.externalModalHeaderSub}>Arquivo criptografado (.json)</Text>
              </View>
            </View>

            <Text style={styles.modalDesc}>
              Cole o conteúdo JSON criptografado do arquivo externo e informe a senha para validar a integridade e restaurar.
            </Text>

            <Text style={styles.inputLabel}>Conteúdo Criptografado (.json)</Text>
            <View style={[styles.inputBox, { height: 96, alignItems: 'flex-start', paddingTop: 10 }]}>
              <Feather name="file-text" size={16} color="#60A5FA" style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.inputText, { height: 76, textAlignVertical: 'top' }]}
                placeholder='{"format":"ORCAMENTO_FACIL_ENC_V1", ...}'
                placeholderTextColor="#64748B"
                multiline
                value={externalBackupContent}
                onChangeText={setExternalBackupContent}
                selectionColor="#60A5FA"
              />
            </View>

            <Text style={styles.inputLabel}>Senha do Backup</Text>
            <View style={styles.inputBox}>
              <Feather name="lock" size={16} color="#60A5FA" />
              <TextInput
                style={styles.inputText}
                placeholder="Senha utilizada na criação do backup"
                placeholderTextColor="#64748B"
                secureTextEntry={!showRestorePassword}
                value={restorePasswordInput}
                onChangeText={setRestorePasswordInput}
                selectionColor="#60A5FA"
              />
              <TouchableOpacity onPress={() => setShowRestorePassword((v) => !v)} activeOpacity={0.7}>
                <Feather name={showRestorePassword ? 'eye-off' : 'eye'} size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowExternalModal(false);
                  setRestorePasswordInput('');
                  setShowRestorePassword(false);
                }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmRestoreBtn}
                onPress={handleConfirmExternalRestore}
                disabled={isProcessing}>
                <Feather name="rotate-ccw" size={14} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>Validar e Restaurar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(restoreSuccessInfo)}
        transparent
        animationType="fade"
        onRequestClose={() => setRestoreSuccessInfo(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successHeader}>
              <View style={styles.successIconWrap}>
                <Feather name="check" size={24} color="#10B981" />
              </View>
              <View style={styles.successHeaderTextWrap}>
                <Text style={styles.modalTitle}>Restauração Concluída!</Text>
                <Text style={styles.successSub}>Dados aplicados com sucesso</Text>
              </View>
            </View>
            <Text style={styles.modalDesc}>
              Seus dados foram validados e restaurados com sucesso (Schema v
              {restoreSuccessInfo?.restoredVersion} atualizado para v
              {restoreSuccessInfo?.finalVersion}). Um backup de segurança prévio também foi salvo para garantir a integridade dos seus dados.
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.successConfirmBtn}
                onPress={() => {
                  setRestoreSuccessInfo(null);
                  router.replace('/home' as unknown as Parameters<typeof router.replace>[0]);
                }}
                activeOpacity={0.8}>
                <Feather name="arrow-left" size={16} color="#FFFFFF" />
                <Text style={styles.successConfirmBtnText}>Voltar ao Início</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.successDismissBtn}
                onPress={() => setRestoreSuccessInfo(null)}
                activeOpacity={0.7}>
                <Text style={styles.successDismissBtnText}>Fechar e Continuar Aqui</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 36,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 16,
  },
  statusCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextCol: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricItemRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 3,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  inputBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  externalRestoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
    padding: 14,
    gap: 12,
  },
  externalRestoreIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  externalRestoreTextWrap: {
    flex: 1,
  },
  externalRestoreTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  externalRestoreSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 16,
  },
  externalRestoreActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  externalRestoreActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60A5FA',
  },
  sectionHeader: {
    marginTop: 6,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: '#64748B',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  backupItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    gap: 10,
  },
  backupItemLeft: {
    flex: 1,
    gap: 4,
  },
  backupBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backupDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeBadgeAuto: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  typeBadgeManual: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  typeBadgeSafety: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  backupFileText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  restoreBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 18,
    gap: 12,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  externalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  externalModalHeaderTextWrap: {
    flex: 1,
  },
  externalModalHeaderSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHeaderTextWrap: {
    flex: 1,
  },
  successSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalDesc: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
  },
  successActions: {
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  successConfirmBtn: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
  },
  successConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successDismissBtn: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successDismissBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 13,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  confirmRestoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
  },
});
