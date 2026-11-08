import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { Transaction } from '../domain/entities/Transaction';
import { Category } from '../domain/entities/Category';
import { Account } from '../domain/entities/Account';
import { DeleteTransactionModal } from '../components/DeleteTransactionModal';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';

export interface TransactionDetailScreenProps {
  id: string;
}

const formatCurrency = (val: number): string => formatMoneyValue(val);

const formatDateTime = (isoDate: string): string => {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return isoDate;
  }
};

export function TransactionDetailScreen({ id }: TransactionDetailScreenProps) {
  usePrivacyMode();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);

  const transactionRepo = new TransactionRepository();
  const categoryRepo = new CategoryRepository();
  const accountRepo = new AccountRepository();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const tx = await transactionRepo.findById(id);
      if (!tx) {
        Alert.alert('Erro', 'Transação não encontrada.');
        router.back();
        return;
      }

      const [cat, acc] = await Promise.all([
        categoryRepo.findById(tx.category_id),
        accountRepo.findById(tx.account_id),
      ]);

      setTransaction(tx);
      setCategory(cat);
      setAccount(acc);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes da transação.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleConfirmPending = async () => {
    if (!transaction) return;
    try {
      setIsActionLoading(true);
      const updated = await transactionRepo.confirmTransaction(transaction.id);
      setTransaction(updated);
    } catch {
      Alert.alert('Erro', 'Não foi possível confirmar a transação.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisableRecurrence = async () => {
    if (!transaction) return;
    try {
      setIsActionLoading(true);
      await transactionRepo.disableRecurrence(transaction.id);
      const updated = await transactionRepo.findById(transaction.id);
      if (updated) {
        setTransaction(updated);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível desativar a recorrência.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (scope?: 'single' | 'future') => {
    if (!transaction) return;
    try {
      setIsDeleting(true);
      if (transaction.installment_group_id) {
        await transactionRepo.deleteInstallmentGroup(transaction.id, scope ?? 'single');
      } else {
        await transactionRepo.delete(transaction.id);
      }
      setShowDeleteModal(false);
      router.back();
    } catch {
      setIsDeleting(false);
      Alert.alert('Erro', 'Falha ao excluir transação.');
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
  };

  const handleShare = async () => {
    if (!transaction) return;
    try {
      if (transaction.attachment_uri) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          const rawUri = transaction.attachment_uri;
          const shareUri = rawUri.startsWith('file://') || rawUri.startsWith('content://')
            ? rawUri
            : `file://${rawUri}`;
          const lower = shareUri.toLowerCase();
          const mimeType = lower.endsWith('.png')
            ? 'image/png'
            : lower.endsWith('.webp')
            ? 'image/webp'
            : lower.endsWith('.pdf')
            ? 'application/pdf'
            : 'image/jpeg';
          await Sharing.shareAsync(shareUri, {
            mimeType,
            dialogTitle: 'Compartilhar comprovante',
          });
          return;
        }
      }

      const isIncome = transaction.type === 'receita';
      const formattedVal = `${isIncome ? '+' : '-'} ${formatCurrency(transaction.value)}`;
      const message = [
        'Detalhes da Transação - Orçamento Fácil',
        `Descrição: ${transaction.description}`,
        `Valor: ${formattedVal}`,
        `Categoria: ${category?.name ?? 'Geral'}`,
        `Conta: ${account?.name ?? 'Conta'}`,
        `Data: ${formatDateTime(transaction.date)}`,
        transaction.notes ? `Observações: ${transaction.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await Share.share({ message });
    } catch {
      return;
    }
  };

  if (isLoading || !transaction) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando detalhes...</Text>
      </SafeAreaView>
    );
  }

  const isIncome = transaction.type === 'receita';
  const isPending = transaction.status === 'pendente';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Detalhes da Transação</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.heroCard,
            transaction.color_label
              ? { borderLeftWidth: 5, borderLeftColor: transaction.color_label }
              : null,
          ]}>
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.typePill,
                isIncome ? styles.typePillIncome : styles.typePillExpense,
              ]}>
              <Text
                style={[
                  styles.typePillText,
                  isIncome ? styles.typePillTextIncome : styles.typePillTextExpense,
                ]}>
                {isIncome ? 'Receita' : 'Despesa'}
              </Text>
            </View>

            {transaction.is_extra_income ? (
              <View style={styles.extraIncomeBadge}>
                <Feather name="trending-up" size={13} color="#34D399" />
                <Text style={styles.extraIncomeBadgeText}>Renda Extra</Text>
              </View>
            ) : null}

            {transaction.is_recurring ? (
              <View style={styles.recurringBadge}>
                <Feather name="repeat" size={13} color="#60A5FA" />
                <Text style={styles.recurringBadgeText}>Recorrente</Text>
              </View>
            ) : null}

            {transaction.installment_number && transaction.installment_total ? (
              <View style={styles.installmentBadge}>
                <Feather name="layers" size={13} color="#A78BFA" />
                <Text style={styles.installmentBadgeText}>
                  Parcela {transaction.installment_number}/{transaction.installment_total}
                </Text>
              </View>
            ) : null}

            {transaction.color_label ? (
              <View
                style={[
                  styles.colorLabelDot,
                  { backgroundColor: transaction.color_label },
                ]}
              />
            ) : null}
          </View>

          <Text style={[styles.heroAmount, isIncome ? styles.amountIncome : styles.amountExpense]}>
            {isIncome ? '+ ' : '- '}
            {formatCurrency(transaction.value)}
          </Text>

          <Text style={styles.heroDescription}>{transaction.description}</Text>

          {isPending ? (
            <TouchableOpacity
              testID="btn-confirm-pending-detail"
              style={styles.btnConfirmPendingHero}
              onPress={handleConfirmPending}
              disabled={isActionLoading}
              activeOpacity={0.85}>
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <Text style={styles.btnConfirmPendingHeroText}>
                Confirmar Transação Agora
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailItem}>
            <View
              style={[
                styles.detailIconBox,
                { backgroundColor: category?.color ? `${category.color}20` : '#1E293B' },
              ]}>
              <Feather
                name={(category?.icon as keyof typeof Feather.glyphMap) ?? 'tag'}
                size={18}
                color={category?.color ?? '#FBBF24'}
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimaryText}>{category?.name ?? 'Geral'}</Text>
              {category?.description ? (
                <Text style={styles.detailSecondaryText} numberOfLines={1}>
                  {category.description}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailItem}>
            <View style={[styles.detailIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.14)' }]}>
              <Feather name="credit-card" size={18} color="#60A5FA" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimaryText}>{account?.name ?? 'Conta'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailItem}>
            <View style={[styles.detailIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.12)' }]}>
              <Feather name="calendar" size={18} color="#94A3B8" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimaryText}>{formatDateTime(transaction.date)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailItem}>
            <View
              style={[
                styles.detailIconBox,
                {
                  backgroundColor: isPending
                    ? 'rgba(245, 158, 11, 0.16)'
                    : 'rgba(16, 185, 129, 0.16)',
                },
              ]}>
              <Feather
                name={isPending ? 'clock' : 'check-circle'}
                size={18}
                color={isPending ? '#F59E0B' : '#10B981'}
              />
            </View>
            <View style={styles.detailContent}>
              <Text
                style={[
                  styles.detailPrimaryText,
                  { color: isPending ? '#F59E0B' : '#10B981' },
                ]}>
                {isPending ? 'Pendente' : 'Confirmada'}
              </Text>
            </View>
          </View>

          {transaction.is_extra_income && transaction.income_source ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailItem}>
                <View style={[styles.detailIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.16)' }]}>
                  <Feather name="briefcase" size={18} color="#10B981" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailPrimaryText}>{transaction.income_source}</Text>
                  <Text style={styles.detailSecondaryText}>Origem de renda extra</Text>
                </View>
              </View>
            </>
          ) : null}

          {transaction.is_recurring ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailItem}>
                <View style={[styles.detailIconBox, { backgroundColor: 'rgba(96, 165, 250, 0.16)' }]}>
                  <Feather name="repeat" size={18} color="#60A5FA" />
                </View>
                <View style={styles.detailContentRow}>
                  <Text style={styles.detailPrimaryText}>
                    {transaction.recurrence_day
                      ? `Todo dia ${transaction.recurrence_day}`
                      : 'Recorrência mensal'}
                  </Text>
                  <TouchableOpacity
                    testID="btn-disable-recurrence"
                    style={styles.btnDisableRecurrence}
                    onPress={handleDisableRecurrence}
                    disabled={isActionLoading}
                    activeOpacity={0.75}>
                    <Text style={styles.btnDisableRecurrenceText}>Desativar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {transaction.tags && transaction.tags.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>TAGS</Text>
            <View style={styles.tagsWrap}>
              {transaction.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {transaction.notes ? (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>OBSERVAÇÕES</Text>
            <View style={styles.notesCard}>
              <Feather name="file-text" size={18} color="#60A5FA" style={styles.notesIcon} />
              <Text style={styles.notesText}>{transaction.notes}</Text>
            </View>
          </View>
        ) : null}

        {transaction.attachment_uri ? (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>COMPROVANTE ANEXADO</Text>
            <TouchableOpacity
              style={styles.attachmentCard}
              onPress={() => setShowImageZoom(true)}
              activeOpacity={0.85}>
              <Image source={{ uri: transaction.attachment_uri }} style={styles.attachmentImage} />
              <View style={styles.attachmentOverlay}>
                <Feather name="maximize-2" size={16} color="#FFFFFF" />
                <Text style={styles.attachmentOverlayText}>Toque para ampliar</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.btnShare}
            onPress={handleShare}
            activeOpacity={0.8}>
            <Feather name="share-2" size={18} color="#FFFFFF" style={styles.actionBtnIcon} />
            <Text style={styles.btnShareText}>
              {transaction.attachment_uri ? 'Compartilhar Comprovante' : 'Compartilhar Transação'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnEdit}
            onPress={() =>
              router.push({
                pathname: '/transaction-form',
                params: { id: transaction.id },
              } as unknown as Parameters<typeof router.push>[0])
            }
            activeOpacity={0.85}>
            <Feather name="edit-3" size={18} color="#FFFFFF" style={styles.actionBtnIcon} />
            <Text style={styles.btnEditText}>Editar Transação</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnDelete}
            onPress={handleDelete}
            disabled={isDeleting}
            activeOpacity={0.8}>
            {isDeleting ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <Feather name="trash-2" size={18} color="#EF4444" style={styles.actionBtnIcon} />
                <Text style={styles.btnDeleteText}>Excluir Transação</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {transaction.attachment_uri ? (
        <Modal
          visible={showImageZoom}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImageZoom(false)}>
          <View style={styles.zoomModalBackdrop}>
            <SafeAreaView style={styles.zoomModalHeader}>
              <TouchableOpacity
                style={styles.zoomCloseBtn}
                onPress={() => setShowImageZoom(false)}
                activeOpacity={0.7}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.zoomTitle}>Comprovante</Text>
              <TouchableOpacity
                style={styles.zoomCloseBtn}
                onPress={handleShare}
                activeOpacity={0.7}>
                <Feather name="share-2" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </SafeAreaView>
            <View style={styles.zoomImageContainer}>
              <Image
                source={{ uri: transaction.attachment_uri }}
                style={styles.zoomImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      ) : null}

      <DeleteTransactionModal
        visible={showDeleteModal}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        transaction={
          transaction
            ? {
                id: transaction.id,
                description: transaction.description,
                value: transaction.value,
                type: transaction.type,
                accountName: account?.name,
                categoryName: category?.name,
                date: transaction.date,
                installment_group_id: transaction.installment_group_id,
                installment_number: transaction.installment_number,
                installment_total: transaction.installment_total,
              }
            : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navPlaceholder: {
    width: 38,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  typePill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePillExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  typePillIncome: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  typePillTextExpense: {
    color: '#F87171',
  },
  typePillTextIncome: {
    color: '#4ADE80',
  },
  extraIncomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  extraIncomeBadgeText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  recurringBadgeText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },
  installmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  installmentBadgeText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '600',
  },
  colorLabelDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  amountIncome: {
    color: '#4ADE80',
  },
  amountExpense: {
    color: '#F87171',
  },
  heroDescription: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E2E8F0',
    textAlign: 'center',
  },
  btnConfirmPendingHero: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnConfirmPendingHeroText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 4,
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  detailContent: {
    flex: 1,
    justifyContent: 'center',
  },
  detailContentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailPrimaryText: {
    fontSize: 15,
    color: '#F1F5F9',
    fontWeight: '600',
  },
  detailSecondaryText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  btnDisableRecurrence: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  btnDisableRecurrenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F87171',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipText: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '600',
  },
  notesCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    alignItems: 'flex-start',
  },
  notesIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  attachmentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#0F172A',
  },
  attachmentOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  attachmentOverlayText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  actionBtnIcon: {
    marginRight: 8,
  },
  btnShare: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnShareText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnEdit: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEditText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDelete: {
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeleteText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  zoomModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  zoomModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  zoomCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  zoomImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  zoomImage: {
    width: '100%',
    height: '100%',
  },
});
