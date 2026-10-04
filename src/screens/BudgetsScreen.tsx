import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  StatusBar,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  CalculateBudgetProgressUseCase,
  CategoryBudgetProgress,
  MonthlyBudgetProgressSummary,
} from '../domain/usecases/CalculateBudgetProgressUseCase';
import { BudgetRepository } from '../data/repositories/BudgetRepository';

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

const mapCategoryIcon = (iconName: string): keyof typeof Feather.glyphMap => {
  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    coffee: 'coffee',
    navigation: 'navigation',
    smile: 'smile',
    home: 'home',
    activity: 'activity',
    book: 'book',
    'dollar-sign': 'dollar-sign',
    briefcase: 'briefcase',
    shopping: 'shopping-bag',
    grid: 'grid',
  };
  return iconMap[iconName] ?? 'grid';
};

const getProgressBarColor = (percentage: number): string => {
  if (percentage > 90) return '#EF4444';
  if (percentage >= 60) return '#F59E0B';
  return '#10B981';
};

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function BudgetsScreen() {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<MonthlyBudgetProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<CategoryBudgetProgress | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const budgetUseCase = new CalculateBudgetProgressUseCase();
  const budgetRepo = new BudgetRepository();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await budgetUseCase.execute(currentMonth, currentYear, true);
      setSummary(res);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os orçamentos.');
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const openEditModal = (item: CategoryBudgetProgress) => {
    setSelectedCategory(item);
    setLimitInput(
      item.limitValue > 0
        ? item.limitValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : ''
    );
  };

  const handleSaveBudget = async () => {
    if (!selectedCategory) return;
    const parsedVal = parseCurrencyValue(limitInput);

    if (parsedVal <= 0) {
      Alert.alert('Atenção', 'Informe um valor limite maior que zero.');
      return;
    }

    setIsSaving(true);
    try {
      await budgetRepo.setCategoryBudget(
        selectedCategory.categoryId,
        currentMonth,
        currentYear,
        parsedVal
      );
      setSelectedCategory(null);
      await loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar orçamento.';
      Alert.alert('Erro', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    Alert.alert('Remover Limite', 'Deseja remover o orçamento desta categoria?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await budgetRepo.delete(budgetId);
            loadData();
          } catch {
            Alert.alert('Erro', 'Falha ao remover orçamento.');
          }
        },
      },
    ]);
  };

  const renderBudgetItem = ({ item }: ListRenderItemInfo<CategoryBudgetProgress>) => {
    const hasBudget = item.limitValue > 0;
    const barColor = getProgressBarColor(item.percentageSpent);
    const clampedProgress = Math.min(100, Math.max(0, item.percentageSpent));

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.budgetCard}
          activeOpacity={0.75}
          onPress={() => openEditModal(item)}>
          <View style={styles.cardTopRow}>
            <View style={styles.categoryLeft}>
              <View
                style={[
                  styles.categoryIconBadge,
                  { backgroundColor: `${item.categoryColor}25` },
                ]}>
                <Feather
                  name={mapCategoryIcon(item.categoryIcon)}
                  size={18}
                  color={item.categoryColor || '#60A5FA'}
                />
              </View>
              <View>
                <Text style={styles.categoryNameText}>{item.categoryName}</Text>
                <Text style={styles.categorySpentSub}>
                  Gasto: {formatCurrency(item.spentValue)}
                </Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              {hasBudget ? (
                <View style={styles.limitBadge}>
                  <Text style={[styles.percentageBadgeText, { color: barColor }]}>
                    {item.percentageSpent}%
                  </Text>
                </View>
              ) : (
                <View style={styles.noBudgetBadge}>
                  <Text style={styles.noBudgetText}>Sem limite</Text>
                </View>
              )}
            </View>
          </View>

          {hasBudget ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${clampedProgress}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressLabelsRow}>
                <Text style={styles.limitLabel}>
                  Limite: {formatCurrency(item.limitValue)}
                </Text>
                <Text
                  style={[
                    styles.remainingLabel,
                    item.isExceeded ? styles.exceededText : null,
                  ]}>
                  {item.isExceeded
                    ? `Excedeu ${formatCurrency(Math.abs(item.remainingValue))}`
                    : `Resta ${formatCurrency(item.remainingValue)}`}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.defineActionRow}>
              <Text style={styles.definePromptText}>Toque para definir o limite mensal</Text>
              <Feather name="plus-circle" size={16} color="#60A5FA" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => {
    if (!summary) return null;
    const overallColor = getProgressBarColor(summary.overallPercentage);
    const clampedOverall = Math.min(100, Math.max(0, summary.overallPercentage));

    return (
      <View style={styles.headerWrapper}>
        <View style={styles.monthSelectorBar}>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={handlePrevMonth}
            activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth - 1]} de {currentYear}
          </Text>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={handleNextMonth}
            activeOpacity={0.7}>
            <Feather name="chevron-right" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryCardTitle}>Orçamento Geral do Mês</Text>
            <View style={styles.summaryPercentagePill}>
              <Text style={styles.summaryPercentageText}>
                {summary.overallPercentage}%
              </Text>
            </View>
          </View>

          <View style={styles.summaryMetrics}>
            <View>
              <Text style={styles.summarySpentLabel}>Total Gasto</Text>
              <Text style={styles.summarySpentValue}>
                {formatCurrency(summary.totalSpent)}
              </Text>
            </View>
            <View style={styles.metricsDivider} />
            <View>
              <Text style={styles.summaryBudgetedLabel}>Limite Total</Text>
              <Text style={styles.summaryBudgetedValue}>
                {formatCurrency(summary.totalBudgeted)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryProgressTrack}>
            <View
              style={[
                styles.summaryProgressFill,
                { width: `${clampedOverall}%`, backgroundColor: overallColor },
              ]}
            />
          </View>
        </LinearGradient>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Limites por Categoria</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>&lt;60%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>60-90%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>&gt;90%</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
        <Text style={styles.navTitle}>Orçamentos</Text>
        <View style={styles.navPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Calculando orçamentos...</Text>
        </View>
      ) : (
        <FlatList
          data={summary?.categories ?? []}
          keyExtractor={(item) => item.categoryId}
          renderItem={renderBudgetItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={Boolean(selectedCategory)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCategory(null)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedCategory(null)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconBadge,
                  { backgroundColor: `${selectedCategory?.categoryColor}25` },
                ]}>
                <Feather
                  name={mapCategoryIcon(selectedCategory?.categoryIcon ?? 'grid')}
                  size={20}
                  color={selectedCategory?.categoryColor || '#60A5FA'}
                />
              </View>
              <View>
                <Text style={styles.modalCategoryTitle}>
                  {selectedCategory?.categoryName}
                </Text>
                <Text style={styles.modalMonthSub}>
                  {MONTH_NAMES[currentMonth - 1]} de {currentYear}
                </Text>
              </View>
            </View>

            <View style={styles.modalSpentInfoRow}>
              <Text style={styles.modalSpentLabel}>Gasto atual no mês:</Text>
              <Text style={styles.modalSpentValue}>
                {formatCurrency(selectedCategory?.spentValue ?? 0)}
              </Text>
            </View>

            <Text style={styles.inputFieldLabel}>Limite Mensal Desejado</Text>
            <View style={styles.amountInputBox}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={limitInput}
                onChangeText={(text) => {
                  const formatted = formatCurrencyInput(text);
                  setLimitInput(formatted);
                }}
                placeholder="0,00"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                autoFocus
                selectionColor="#60A5FA"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnSaveModal}
                disabled={isSaving}
                onPress={handleSaveBudget}
                activeOpacity={0.85}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnSaveModalText}>Salvar Limite</Text>
                )}
              </TouchableOpacity>

              {selectedCategory?.budgetId ? (
                <TouchableOpacity
                  style={styles.btnDeleteBudget}
                  onPress={() => {
                    const idToDelete = selectedCategory.budgetId;
                    setSelectedCategory(null);
                    handleDeleteBudget(idToDelete);
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.btnDeleteBudgetText}>Remover Limite</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.btnCancelModal}
                onPress={() => setSelectedCategory(null)}
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
  navPlaceholder: {
    width: 38,
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
  headerWrapper: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryCardTitle: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  summaryPercentagePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  summaryPercentageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricsDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  summarySpentLabel: {
    fontSize: 11,
    color: '#BFDBFE',
    marginBottom: 2,
  },
  summarySpentValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryBudgetedLabel: {
    fontSize: 11,
    color: '#BFDBFE',
    marginBottom: 2,
  },
  summaryBudgetedValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  cardWrapper: {
    marginBottom: 10,
  },
  budgetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categorySpentSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  limitBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  percentageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noBudgetBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noBudgetText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  progressContainer: {
    gap: 6,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  remainingLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  exceededText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  defineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.15)',
  },
  definePromptText: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: '500',
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalMonthSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalSpentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalSpentLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  modalSpentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
  },
  amountInputBox: {
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
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#60A5FA',
  },
  amountInput: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 70,
    padding: 0,
  },
  modalActions: {
    marginTop: 8,
    gap: 8,
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
  btnDeleteBudget: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  btnDeleteBudgetText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  btnCancelModal: {
    borderRadius: 12,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelModalText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
});
