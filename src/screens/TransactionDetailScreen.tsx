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
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { Transaction } from '../domain/entities/Transaction';
import { Category } from '../domain/entities/Category';
import { Account } from '../domain/entities/Account';
import { DeleteTransactionModal } from '../components/DeleteTransactionModal';

export interface TransactionDetailScreenProps {
  id: string;
}

const formatCurrency = (val: number): string =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await transactionRepo.delete(id);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Detalhes da Transação</Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() =>
            router.push({
              pathname: '/transaction-form',
              params: { id: transaction.id },
            } as unknown as Parameters<typeof router.push>[0])
          }
          activeOpacity={0.7}>
          <Feather name="edit-2" size={18} color="#60A5FA" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.typeBadge,
                isIncome ? styles.typeBadgeIncome : styles.typeBadgeExpense,
              ]}>
              <Feather
                name={isIncome ? 'arrow-down-left' : 'arrow-up-right'}
                size={12}
                color={isIncome ? '#4ADE80' : '#F87171'}
              />
              <Text
                style={[
                  styles.typeBadgeText,
                  isIncome ? styles.typeBadgeTextIncome : styles.typeBadgeTextExpense,
                ]}>
                {isIncome ? 'Receita' : 'Despesa'}
              </Text>
            </View>

            {transaction.is_recurring ? (
              <View style={styles.recurringBadge}>
                <Feather name="repeat" size={11} color="#60A5FA" />
                <Text style={styles.recurringBadgeText}>Gasto Fixo Mensal</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.heroAmount, isIncome ? styles.amountIncome : styles.amountExpense]}>
            {isIncome ? '+ ' : '- '}
            {formatCurrency(transaction.value)}
          </Text>

          <Text style={styles.heroDescription}>{transaction.description}</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View
                style={[
                  styles.detailIconBox,
                  { backgroundColor: category?.color ? `${category.color}20` : '#334155' },
                ]}>
                <Feather
                  name={(category?.icon as keyof typeof Feather.glyphMap) ?? 'tag'}
                  size={18}
                  color={category?.color ?? '#FBBF24'}
                />
              </View>
              <Text style={styles.detailLabel}>Categoria</Text>
            </View>
            <Text style={styles.detailValue}>{category?.name ?? 'Geral'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIconBox}>
                <Feather name="credit-card" size={18} color="#60A5FA" />
              </View>
              <Text style={styles.detailLabel}>Conta</Text>
            </View>
            <Text style={styles.detailValue}>{account?.name ?? 'Conta'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIconBox}>
                <Feather name="calendar" size={18} color="#60A5FA" />
              </View>
              <Text style={styles.detailLabel}>Data e Hora</Text>
            </View>
            <Text style={styles.detailValue}>{formatDateTime(transaction.date)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIconBox}>
                <Feather name="check-circle" size={18} color="#10B981" />
              </View>
              <Text style={styles.detailLabel}>Status</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Confirmada</Text>
            </View>
          </View>

          {transaction.is_recurring ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <View style={styles.detailIconBox}>
                    <Feather name="repeat" size={18} color="#60A5FA" />
                  </View>
                  <Text style={styles.detailLabel}>Recorrência</Text>
                </View>
                <Text style={styles.detailValue}>
                  {transaction.recurrence_day
                    ? `Todo dia ${transaction.recurrence_day}`
                    : 'Mensal'}
                </Text>
              </View>
            </>
          ) : null}
        </View>

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
            <Text style={styles.btnShareText}>Compartilhar Transação</Text>
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
    paddingHorizontal: 18,
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
    gap: 8,
    marginBottom: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeIncome: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  typeBadgeExpense: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  typeBadgeTextIncome: {
    color: '#4ADE80',
  },
  typeBadgeTextExpense: {
    color: '#F87171',
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  recurringBadgeText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  amountIncome: {
    color: '#4ADE80',
  },
  amountExpense: {
    color: '#F87171',
  },
  heroDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
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
