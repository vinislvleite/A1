import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  CalculateCardInvoiceUseCase,
  CalculateCardInvoiceResult,
} from '../domain/usecases/CalculateCardInvoiceUseCase';
import {
  calculateRevolvingInterest,
  RevolvingInterestResult,
} from '../domain/usecases/CalculateRevolvingInterestUseCase';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { Transaction } from '../domain/entities/Transaction';
import { Category } from '../domain/entities/Category';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';
import { formatDate } from '../utils/date';
import { dialog } from '../components/dialogs';

const formatCurrency = (value: number): string => formatMoneyValue(value);

const formatDateShort = (ymd: string): string => formatDate(ymd);

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

const formatValueFromNumber = (num?: number): string => {
  if (!num || num <= 0) return '';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const mapCategoryIcon = (iconName?: string): keyof typeof Feather.glyphMap => {
  if (!iconName) return 'shopping-bag';
  if (iconName in Feather.glyphMap) {
    return iconName as keyof typeof Feather.glyphMap;
  }
  return 'shopping-bag';
};

export function CardDetailScreen() {
  usePrivacyMode();
  const params = useLocalSearchParams<{ id?: string }>();
  const cardId = typeof params.id === 'string' ? params.id : '';

  const [invoiceData, setInvoiceData] = useState<CalculateCardInvoiceResult | null>(null);
  const [categoriesMap, setCategoriesMap] = useState<Map<string, Category>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const [simModalVisible, setSimModalVisible] = useState(false);
  const [simBalanceText, setSimBalanceText] = useState('');
  const [simRateText, setSimRateText] = useState('12,5');
  const [simMonthsText, setSimMonthsText] = useState('6');
  const [simResult, setSimResult] = useState<RevolvingInterestResult | null>(null);

  const loadInvoice = useCallback(async () => {
    if (!cardId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const useCase = new CalculateCardInvoiceUseCase();
      const categoryRepo = new CategoryRepository();
      const [result, allCats] = await Promise.all([
        useCase.execute(cardId),
        categoryRepo.findAll(),
      ]);
      setInvoiceData(result);
      setCategoriesMap(new Map(allCats.map((c) => [c.id, c])));
      const defaultBalance = result.currentInvoiceAmount > 0 ? result.currentInvoiceAmount : 1000;
      setSimBalanceText(formatValueFromNumber(defaultBalance));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao carregar fatura do cartão.';
      dialog.alerta({ titulo: 'Erro', mensagem: msg, tipo: 'erro' });
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useFocusEffect(
    useCallback(() => {
      loadInvoice();
    }, [loadInvoice])
  );

  const handleOpenSimulator = () => {
    const defaultBalance =
      invoiceData && invoiceData.currentInvoiceAmount > 0
        ? invoiceData.currentInvoiceAmount
        : 1000;
    setSimBalanceText(formatValueFromNumber(defaultBalance));
    try {
      const initialCalc = calculateRevolvingInterest({
        balance: defaultBalance,
        monthlyRatePercent: 12.5,
        months: 6,
      });
      setSimResult(initialCalc);
    } catch {
      setSimResult(null);
    }
    setSimModalVisible(true);
  };

  const handleRunSimulation = () => {
    const parsedBalance = parseFloat(simBalanceText.replace(/\./g, '').replace(',', '.'));
    const parsedRate = parseFloat(simRateText.replace(',', '.'));
    const parsedMonths = parseInt(simMonthsText.replace(/\D/g, ''), 10);

    try {
      const result = calculateRevolvingInterest({
        balance: parsedBalance,
        monthlyRatePercent: parsedRate,
        months: parsedMonths,
      });
      setSimResult(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Verifique os valores informados.';
      dialog.alerta({ titulo: 'Dados Inválidos', mensagem: msg, tipo: 'atencao' });
    }
  };

  const renderTransactionItem = ({ item }: ListRenderItemInfo<Transaction>) => {
    const isExpense = item.type === 'despesa';
    const cat = categoriesMap.get(item.category_id);
    const catColor = cat?.color ?? (isExpense ? '#F87171' : '#34D399');
    const catIcon = cat ? mapCategoryIcon(cat.icon) : (isExpense ? 'shopping-bag' : 'arrow-down-left');

    return (
      <TouchableOpacity
        style={styles.txItem}
        activeOpacity={0.75}
        onPress={() =>
          router.push({
            pathname: '/transaction-detail',
            params: { id: item.id },
          } as unknown as Parameters<typeof router.push>[0])
        }>
        <View style={[styles.txIconBox, { backgroundColor: `${catColor}20` }]}>
          <Feather
            name={catIcon}
            size={18}
            color={catColor}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.txMeta}>
            {formatDateShort(item.date)}
            {cat?.name ? ` • ${cat.name}` : ''}
            {item.installment_total && item.installment_total > 1
              ? ` • Parcela ${item.installment_number}/${item.installment_total}`
              : ''}
          </Text>
        </View>
        <Text style={[styles.txValue, isExpense ? styles.txExpense : styles.txIncome]}>
          {isExpense ? '-' : '+'} {formatCurrency(item.value)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando fatura do cartão...</Text>
      </SafeAreaView>
    );
  }

  if (!invoiceData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cartão não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const limitUsageRatio =
    invoiceData.creditLimit > 0
      ? Math.min(1, invoiceData.usedLimit / invoiceData.creditLimit)
      : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {invoiceData.account.name}
        </Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() =>
            router.push({
              pathname: '/account-form',
              params: { id: invoiceData.account.id },
            } as unknown as Parameters<typeof router.push>[0])
          }
          activeOpacity={0.7}>
          <Feather name="edit-2" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={invoiceData.recentTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <LinearGradient
              colors={[invoiceData.account.color || '#2563EB', '#1E293B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.invoiceCard}>
              <View style={styles.invoiceCardTop}>
                <View>
                  <Text style={styles.invoiceLabel}>Fatura Atual</Text>
                  <Text style={styles.invoiceValue}>
                    {formatCurrency(invoiceData.currentInvoiceAmount)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.dueBadge,
                    invoiceData.isDueSoon ? styles.dueBadgeAlert : null,
                  ]}>
                  <Feather
                    name={invoiceData.isDueSoon ? 'alert-triangle' : 'calendar'}
                    size={13}
                    color={invoiceData.isDueSoon ? '#FEF2F2' : '#E2E8F0'}
                  />
                  <Text
                    style={[
                      styles.dueBadgeText,
                      invoiceData.isDueSoon ? styles.dueBadgeTextAlert : null,
                    ]}>
                    Venc. {formatDateShort(invoiceData.dueDate)}
                  </Text>
                </View>
              </View>

              {invoiceData.closedInvoice ? (
                <View style={styles.closedInvoiceCard}>
                  <View style={styles.closedInvoiceRow}>
                    <View>
                      <Text style={styles.closedInvoiceLabel}>Fatura Fechada</Text>
                      <Text style={styles.closedInvoiceValue}>
                        {formatCurrency(invoiceData.closedInvoice.amount)}
                      </Text>
                    </View>
                    <View style={styles.closedInvoiceDueBadge}>
                      <Feather name="calendar" size={12} color="#94A3B8" />
                      <Text style={styles.closedInvoiceDueText}>
                        Venc. {formatDateShort(invoiceData.closedInvoice.dueDate)}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {invoiceData.isDueSoon ? (
                <View style={styles.dueAlertBanner}>
                  <Feather name="bell" size={14} color="#FCA5A5" />
                  <Text style={styles.dueAlertText}>
                    {invoiceData.daysUntilDue === 0
                      ? 'Atenção: sua fatura vence hoje!'
                      : `Atenção: faltam ${invoiceData.daysUntilDue} dia(s) para o vencimento!`}
                  </Text>
                </View>
              ) : null}

              <View style={styles.limitProgressSection}>
                <View style={styles.limitLabelsRow}>
                  <Text style={styles.limitText}>
                    Disponível: {formatCurrency(invoiceData.availableLimit)}
                  </Text>
                  <Text style={styles.limitText}>
                    Limite: {formatCurrency(invoiceData.creditLimit)}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(limitUsageRatio * 100)}%`,
                        backgroundColor: limitUsageRatio >= 0.9 ? '#EF4444' : '#38BDF8',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.cyclePeriodText}>
                  Ciclo: {formatDateShort(invoiceData.cycleStartDate)} até{' '}
                  {formatDateShort(invoiceData.cycleEndDate)} (Fecha dia{' '}
                  {invoiceData.account.closing_day ?? 10})
                </Text>
              </View>

              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.cardActionButton}
                  activeOpacity={0.85}
                  onPress={handleOpenSimulator}>
                  <Feather name="percent" size={15} color="#FFFFFF" />
                  <Text style={styles.cardActionText}>Simular Rotativo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cardActionButtonSecondary}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/statement',
                      params: { accountId: invoiceData.account.id },
                    } as unknown as Parameters<typeof router.push>[0])
                  }>
                  <Feather name="file-text" size={15} color="#60A5FA" />
                  <Text style={styles.cardActionTextSecondary}>Ver Extrato</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <Text style={styles.sectionTitle}>Últimos Lançamentos no Cartão</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="credit-card" size={32} color="#475569" />
            <Text style={styles.emptyText}>Nenhum lançamento registrado neste cartão.</Text>
          </View>
        }
      />

      <Modal
        visible={simModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSimModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIcon}>
                  <Feather name="trending-down" size={18} color="#F87171" />
                </View>
                <Text style={styles.modalTitle}>Simular Crédito Rotativo</Text>
              </View>
              <TouchableOpacity onPress={() => setSimModalVisible(false)}>
                <Feather name="x" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.simFieldGroup}>
                <Text style={styles.simLabel}>Saldo Devedor</Text>
                <View style={styles.amountBox}>
                  <Text style={styles.currencyPrefix}>R$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={simBalanceText}
                    onChangeText={(txt) => setSimBalanceText(formatCurrencyInput(txt))}
                    keyboardType="numeric"
                    placeholder="0,00"
                    placeholderTextColor="#64748B"
                    selectionColor="#60A5FA"
                  />
                </View>
              </View>

              <View style={styles.simRow}>
                <View style={styles.simHalfGroup}>
                  <Text style={styles.simLabel}>Taxa Mensal (%)</Text>
                  <View style={styles.simInputBox}>
                    <Feather name="percent" size={15} color="#60A5FA" />
                    <TextInput
                      style={styles.simInputText}
                      value={simRateText}
                      onChangeText={setSimRateText}
                      keyboardType="numeric"
                      placeholder="12,5"
                      placeholderTextColor="#64748B"
                      selectionColor="#60A5FA"
                    />
                  </View>
                </View>

                <View style={styles.simHalfGroup}>
                  <Text style={styles.simLabel}>Nº de Meses</Text>
                  <View style={styles.simInputBox}>
                    <Feather name="calendar" size={15} color="#60A5FA" />
                    <TextInput
                      style={styles.simInputText}
                      value={simMonthsText}
                      onChangeText={setSimMonthsText}
                      keyboardType="number-pad"
                      placeholder="6"
                      placeholderTextColor="#64748B"
                      selectionColor="#60A5FA"
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.simCalcBtn}
                activeOpacity={0.85}
                onPress={handleRunSimulation}>
                <Feather name="activity" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.simCalcBtnText}>Calcular Juros</Text>
              </TouchableOpacity>

              {simResult ? (
                <View style={styles.simResultBox}>
                  <View style={styles.simResultRow}>
                    <Text style={styles.simResultLabel}>Juros do 1º mês</Text>
                    <Text style={styles.simResultValueWarning}>
                      {formatCurrency(simResult.firstMonthInterest)}
                    </Text>
                  </View>
                  <View style={styles.simResultRow}>
                    <Text style={styles.simResultLabel}>
                      Valor da parcela ({simResult.months}x)
                    </Text>
                    <Text style={styles.simResultValue}>
                      {formatCurrency(simResult.installmentAmount)}
                    </Text>
                  </View>
                  <View style={styles.simResultRow}>
                    <Text style={styles.simResultLabel}>Total de juros</Text>
                    <Text style={styles.simResultValueDanger}>
                      {formatCurrency(simResult.totalInterest)}
                    </Text>
                  </View>
                  <View style={[styles.simResultRow, styles.simResultRowTotal]}>
                    <Text style={styles.simResultTotalLabel}>Custo Total Pago</Text>
                    <Text style={styles.simResultTotalValue}>
                      {formatCurrency(simResult.totalPaid)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: {
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
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginHorizontal: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerBlock: {
    marginBottom: 16,
    gap: 18,
  },
  invoiceCard: {
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  invoiceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  invoiceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  closedInvoiceCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  closedInvoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closedInvoiceLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  closedInvoiceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  closedInvoiceDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closedInvoiceDueText: {
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  dueBadgeAlert: {
    backgroundColor: '#DC2626',
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  dueBadgeTextAlert: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dueAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(127, 29, 29, 0.75)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dueAlertText: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  limitProgressSection: {
    gap: 6,
  },
  limitLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  limitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  cyclePeriodText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
  },
  cardActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cardActionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: '#60A5FA',
    paddingVertical: 10,
    borderRadius: 10,
  },
  cardActionTextSecondary: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  txMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  txValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  txExpense: {
    color: '#F87171',
  },
  txIncome: {
    color: '#34D399',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  simFieldGroup: {
    marginBottom: 12,
    gap: 6,
  },
  simRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  simHalfGroup: {
    flex: 1,
    gap: 6,
  },
  simLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  simInputBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simInputText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  simInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  amountBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#60A5FA',
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  simCalcBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  simCalcBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  simResultBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  simResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simResultRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
    marginTop: 4,
  },
  simResultLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  simResultValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  simResultValueWarning: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
  },
  simResultValueDanger: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '700',
  },
  simResultTotalLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  simResultTotalValue: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: '800',
  },
});
