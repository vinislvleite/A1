import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { Transaction } from '../domain/entities/Transaction';
import { Account } from '../domain/entities/Account';
import { Category } from '../domain/entities/Category';

const formatCurrency = (val: number): string =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (isoDate: string): string => {
  try {
    const d = new Date(isoDate);
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

export function DeleteTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transactionRepo = new TransactionRepository();
  const accountRepo = new AccountRepository();
  const categoryRepo = new CategoryRepository();

  const loadData = useCallback(async () => {
    if (!id) {
      setErrorMessage('ID da transação não fornecido.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const tx = await transactionRepo.findById(id);
      if (!tx) {
        setErrorMessage('Transação não encontrada.');
        setIsLoading(false);
        return;
      }

      setTransaction(tx);

      const [acc, cat] = await Promise.all([
        accountRepo.findById(tx.account_id),
        categoryRepo.findById(tx.category_id),
      ]);

      setAccount(acc);
      setCategory(cat);
    } catch {
      setErrorMessage('Falha ao carregar informações da transação.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmDelete = async () => {
    if (!id) return;
    try {
      setIsDeleting(true);
      await transactionRepo.delete(id);
      router.back();
    } catch (error: unknown) {
      setIsDeleting(false);
      const message = error instanceof Error ? error.message : 'Falha ao excluir transação.';
      setErrorMessage(message);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60A5FA" />
      </SafeAreaView>
    );
  }

  if (errorMessage && !transaction) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Ops!</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.errorBackButton} onPress={handleCancel}>
          <Text style={styles.errorBackButtonText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isExpense = transaction?.type === 'despesa';
  const formattedValue = transaction
    ? `${isExpense ? '- ' : '+ '}${formatCurrency(transaction.value)}`
    : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Excluir Transação</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="trash-2" size={36} color="#EF4444" />
          </View>

          <Text style={styles.title}>Confirmar Exclusão</Text>
          <Text style={styles.subtitle}>
            Tem certeza de que deseja excluir permanentemente esta transação do seu histórico?
          </Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {transaction ? (
            <View style={styles.detailsBox}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Descrição</Text>
                <Text style={styles.detailValueBold}>{transaction.description}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Valor</Text>
                <Text
                  style={[
                    styles.amountText,
                    { color: isExpense ? '#F87171' : '#10B981' },
                  ]}
                >
                  {formattedValue}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowTwoCols}>
                <View style={styles.col}>
                  <Text style={styles.detailLabel}>Conta</Text>
                  <View style={styles.inlineTag}>
                    <Feather name="credit-card" size={13} color="#60A5FA" />
                    <Text style={styles.inlineTagText}>{account?.name ?? 'Conta'}</Text>
                  </View>
                </View>

                <View style={styles.col}>
                  <Text style={styles.detailLabel}>Categoria</Text>
                  <View style={styles.inlineTag}>
                    <Feather name="tag" size={13} color="#F59E0B" />
                    <Text style={styles.inlineTagText}>{category?.name ?? 'Geral'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Data e Hora</Text>
                <Text style={styles.detailValueRegular}>{formatDateTime(transaction.date)}</Text>
              </View>

              {transaction.notes ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Observações</Text>
                    <Text style={styles.detailValueRegular}>{transaction.notes}</Text>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.warningBox}>
            <Feather name="alert-triangle" size={16} color="#F59E0B" />
            <Text style={styles.warningText}>
              Atenção: Esta ação não pode ser desfeita. O saldo da sua conta e os orçamentos da categoria serão recalculados automaticamente.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleConfirmDelete}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="trash-2" size={18} color="#FFFFFF" style={styles.deleteIcon} />
                  <Text style={styles.deleteButtonText}>Excluir Transação</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#334155',
  },
  errorBackButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerPlaceholder: {
    width: 40,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 20,
  },
  detailItem: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  detailValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  detailValueRegular: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E2E8F0',
  },
  amountText: {
    fontSize: 22,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 12,
  },
  rowTwoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  col: {
    flex: 1,
    gap: 4,
  },
  inlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    alignSelf: 'flex-start',
  },
  inlineTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    gap: 10,
    width: '100%',
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#FCD34D',
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  deleteButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    marginRight: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
  },
});
