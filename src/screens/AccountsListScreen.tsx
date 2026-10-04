import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { CalculateBalanceUseCase, AccountBalanceDetail } from '../domain/usecases/CalculateBalanceUseCase';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { TransactionRepository } from '../data/repositories/TransactionRepository';

const formatCurrency = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCurrencyInput = (rawText: string): string => {
  const cleanDigits = rawText.replace(/\D/g, '').slice(0, 12);
  if (!cleanDigits) return '';
  const cents = parseInt(cleanDigits, 10);
  if (cents === 0) return '';
  const amount = cents / 100;
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrencyValue = (formattedText: string): number => {
  const cleanDigits = formattedText.replace(/\D/g, '');
  if (!cleanDigits) return 0;
  return parseInt(cleanDigits, 10) / 100;
};

const getAccountTypeLabel = (type: string): string => {
  switch (type) {
    case 'poupanca':
      return 'Poupança';
    case 'cartao_credito':
      return 'Cartão de Crédito';
    case 'corrente':
    default:
      return 'Conta Corrente';
  }
};

const mapAccountIcon = (iconName: string): keyof typeof Feather.glyphMap => {
  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    'credit-card': 'credit-card',
    'dollar-sign': 'dollar-sign',
    briefcase: 'briefcase',
    award: 'award',
    shield: 'shield',
    folder: 'folder',
    archive: 'archive',
    'pie-chart': 'pie-chart',
    layers: 'layers',
    home: 'home',
  };
  return iconMap[iconName] ?? 'credit-card';
};

export function AccountsListScreen() {
  const [totalBalance, setTotalBalance] = useState(0);
  const [accounts, setAccounts] = useState<AccountBalanceDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjustDetail, setAdjustDetail] = useState<AccountBalanceDetail | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  const balanceUseCase = new CalculateBalanceUseCase();
  const accountRepo = new AccountRepository();
  const transactionRepo = new TransactionRepository();

  const handleSaveAdjustment = async () => {
    if (!adjustDetail) return;
    const parsed = parseCurrencyValue(adjustValue);

    setIsAdjusting(true);
    try {
      await accountRepo.adjustBalance(adjustDetail.account.id, parsed);
      setAdjustDetail(null);
      await loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao ajustar saldo.';
      Alert.alert('Erro', message);
    } finally {
      setIsAdjusting(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const summary = await balanceUseCase.execute();
      setTotalBalance(summary.totalBalance);
      setAccounts(summary.accounts);
    } catch {
      Alert.alert('Erro', 'Falha ao carregar lista de contas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDeleteAccount = (detail: AccountBalanceDetail) => {
    Alert.alert(
      'Excluir Conta',
      `Deseja realmente excluir a conta "${detail.account.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const linkedTransactions = await transactionRepo.findByAccountId(detail.account.id);
              if (linkedTransactions.length > 0) {
                Alert.alert(
                  'Ação Bloqueada',
                  `Não é possível excluir esta conta porque ela possui ${linkedTransactions.length} transação(ões) vinculada(s). Exclua ou transfira as transações primeiro.`
                );
                return;
              }

              await accountRepo.delete(detail.account.id);
              loadData();
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Falha ao excluir conta.';
              Alert.alert('Erro', message);
            }
          },
        },
      ]
    );
  };

  const renderAccountItem = ({ item }: ListRenderItemInfo<AccountBalanceDetail>) => {
    const isNegative = item.currentBalance < 0;

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.accountCard}
          activeOpacity={0.75}
          onPress={() =>
            router.push({
              pathname: '/account-form',
              params: { id: item.account.id },
            } as unknown as Parameters<typeof router.push>[0])
          }>
          <View style={styles.accountCardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${item.account.color}25` },
                ]}>
                <Feather
                  name={mapAccountIcon(item.account.icon)}
                  size={20}
                  color={item.account.color || '#60A5FA'}
                />
              </View>
              <View style={styles.nameContainer}>
                <Text style={styles.accountName} numberOfLines={1}>
                  {item.account.name}
                </Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {getAccountTypeLabel(item.account.type)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.cardHeaderRight}>
              <TouchableOpacity
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  setAdjustDetail(item);
                  setAdjustValue(
                    item.currentBalance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  );
                }}>
                <Feather name="sliders" size={15} color="#60A5FA" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() =>
                  router.push({
                    pathname: '/account-form',
                    params: { id: item.account.id },
                  } as unknown as Parameters<typeof router.push>[0])
                }>
                <Feather name="edit-2" size={15} color="#94A3B8" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleDeleteAccount(item)}>
                <Feather name="trash-2" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Saldo atual</Text>
              <Text
                style={[
                  styles.accountBalanceText,
                  isNegative ? styles.balanceNegative : styles.balancePositive,
                ]}>
                {formatCurrency(item.currentBalance)}
              </Text>
            </View>

            <View style={styles.statsSummary}>
              <Text style={styles.statsText}>
                Inicial: {formatCurrency(item.account.initial_balance)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.totalCard}>
        <View style={styles.totalHeaderRow}>
          <Text style={styles.totalLabel}>Saldo Total Consolidado</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{accounts.length} contas</Text>
          </View>
        </View>

        <Text style={styles.totalValue}>{formatCurrency(totalBalance)}</Text>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionButton}
            activeOpacity={0.8}
            onPress={() =>
              router.push('/transfer' as unknown as Parameters<typeof router.push>[0])
            }>
            <Feather name="repeat" size={14} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Transferir</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            activeOpacity={0.8}
            onPress={() =>
              router.push('/account-form' as unknown as Parameters<typeof router.push>[0])
            }>
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Nova Conta</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Suas Contas</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Minhas Contas</Text>
        <TouchableOpacity
          style={styles.navAddBtn}
          onPress={() =>
            router.push('/account-form' as unknown as Parameters<typeof router.push>[0])
          }
          activeOpacity={0.7}>
          <Feather name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Atualizando saldos...</Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.account.id}
          renderItem={renderAccountItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="credit-card" size={40} color="#64748B" />
              <Text style={styles.emptyTitle}>Nenhuma conta cadastrada</Text>
              <Text style={styles.emptySubtitle}>
                Cadastre sua primeira conta corrente, poupança ou cartão.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={Boolean(adjustDetail)}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustDetail(null)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAdjustDetail(null)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Ajustar Saldo Manual</Text>
            <Text style={styles.modalSubtitle}>
              Conta: <Text style={styles.boldText}>{adjustDetail?.account.name}</Text>
            </Text>
            <Text style={styles.modalNotice}>
              O saldo será atualizado sem criar uma transação comum de receita ou despesa.
            </Text>

            <View style={styles.modalAmountBox}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.modalAmountInput}
                value={adjustValue}
                onChangeText={(text) => {
                  const formatted = formatCurrencyInput(text);
                  setAdjustValue(formatted);
                }}
                placeholder="0,00"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                selectionColor="#60A5FA"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnSaveModal}
                disabled={isAdjusting}
                onPress={handleSaveAdjustment}
                activeOpacity={0.85}>
                {isAdjusting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnSaveModalText}>Salvar Ajuste</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnCancelModal}
                onPress={() => setAdjustDetail(null)}
                activeOpacity={0.7}>
                <Text style={styles.btnCancelModalText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  totalCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
  },
  totalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  totalBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 10,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitleRow: {
    marginTop: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  cardWrapper: {
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  accountCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  accountBalanceText: {
    fontSize: 18,
    fontWeight: '700',
  },
  balancePositive: {
    color: '#4ADE80',
  },
  balanceNegative: {
    color: '#EF4444',
  },
  statsSummary: {
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  boldText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalNotice: {
    fontSize: 12,
    color: '#60A5FA',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  modalAmountBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#60A5FA',
  },
  modalAmountInput: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 70,
    padding: 0,
  },
  modalActions: {
    marginTop: 8,
    gap: 10,
  },
  btnSaveModal: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnCancelModal: {
    borderRadius: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelModalText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
});
