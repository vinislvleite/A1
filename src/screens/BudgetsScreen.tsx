import React, { useState, useCallback, useRef } from 'react';
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
  ScrollView,
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
import {
  CategorySpendingGoalsUseCase,
  CategorySpendingGoalProgress,
} from '../domain/usecases/CategorySpendingGoalsUseCase';
import { BudgetRepository } from '../data/repositories/BudgetRepository';
import { BudgetMode, BudgetPeriod } from '../domain/entities/Budget';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';

const formatCurrency = (value: number): string => formatMoneyValue(value);

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

const VALID_CATEGORY_ICONS = new Set<string>([
  'coffee', 'shopping-bag', 'shopping-cart', 'package', 'navigation', 'truck',
  'map-pin', 'compass', 'send', 'globe', 'home', 'key', 'tool', 'tv', 'wifi',
  'zap', 'phone', 'smartphone', 'film', 'music', 'camera', 'headphones',
  'smile', 'feather', 'sun', 'moon', 'star', 'activity', 'heart', 'shield',
  'umbrella', 'book', 'book-open', 'briefcase', 'award', 'clipboard',
  'file-text', 'layers', 'dollar-sign', 'credit-card', 'tag', 'gift',
  'percent', 'trending-up', 'trending-down', 'pie-chart', 'user', 'users',
  'bell', 'calendar', 'clock', 'grid',
]);

const mapCategoryIcon = (iconName?: string): keyof typeof Feather.glyphMap => {
  if (!iconName) return 'grid';
  if (iconName === 'shopping') return 'shopping-bag';
  if (VALID_CATEGORY_ICONS.has(iconName)) {
    return iconName as keyof typeof Feather.glyphMap;
  }
  return 'grid';
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
  usePrivacyMode();
  const now = new Date();
  const [activeTab, setActiveTab] = useState<BudgetPeriod>('mensal');
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<MonthlyBudgetProgressSummary | null>(null);
  const [goals, setGoals] = useState<CategorySpendingGoalProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<CategoryBudgetProgress | null>(null);
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('fixo');
  const [limitInput, setLimitInput] = useState('');
  const [percentageInput, setPercentageInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalCategoryId, setGoalCategoryId] = useState<string>('');
  const [goalMaxInput, setGoalMaxInput] = useState('');
  const [showGoalCategoryPicker, setShowGoalCategoryPicker] = useState(false);
  const goalAmountInputRef = useRef<TextInput>(null);

  const budgetUseCase = new CalculateBudgetProgressUseCase();
  const goalsUseCase = new CategorySpendingGoalsUseCase();
  const budgetRepo = new BudgetRepository();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [res, goalsList] = await Promise.all([
        activeTab === 'anual'
          ? budgetUseCase.executeAnnual(currentYear, true)
          : budgetUseCase.execute(currentMonth, currentYear, true),
        goalsUseCase.execute(currentMonth, currentYear),
      ]);
      setSummary(res);
      setGoals(goalsList);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os orçamentos.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handlePrevPeriod = () => {
    if (activeTab === 'anual') {
      setCurrentYear((prev) => prev - 1);
      return;
    }
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextPeriod = () => {
    if (activeTab === 'anual') {
      setCurrentYear((prev) => prev + 1);
      return;
    }
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const openEditModal = (item: CategoryBudgetProgress) => {
    setSelectedCategory(item);
    const mode = activeTab === 'anual' ? 'fixo' : (item.budgetMode ?? 'fixo');
    setBudgetMode(mode);
    setPercentageInput(
      item.percentageValue && item.percentageValue > 0
        ? String(item.percentageValue).replace('.', ',')
        : ''
    );
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

    if (activeTab === 'mensal' && budgetMode === 'percentual') {
      const pct = parseFloat(percentageInput.replace(',', '.')) || 0;
      if (pct <= 0 || pct > 100) {
        Alert.alert('Atenção', 'Informe um percentual entre 1% e 100%.');
        return;
      }
      setIsSaving(true);
      try {
        await budgetRepo.setCategoryBudget(
          selectedCategory.categoryId,
          currentMonth,
          currentYear,
          0,
          {
            periodType: 'mensal',
            budgetMode: 'percentual',
            percentageValue: pct,
          }
        );
        setSelectedCategory(null);
        await loadData();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Falha ao salvar orçamento.';
        Alert.alert('Erro', message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

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
        parsedVal,
        {
          periodType: activeTab,
          budgetMode: 'fixo',
          percentageValue: null,
        }
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

  const handleSaveGoal = async () => {
    const val = parseCurrencyValue(goalMaxInput);
    if (!goalCategoryId || val <= 0) {
      Alert.alert('Atenção', 'Selecione uma categoria e informe um valor máximo maior que zero.');
      return;
    }
    try {
      await budgetRepo.setCategorySpendingGoal(goalCategoryId, val);
      setGoalModalVisible(false);
      setGoalMaxInput('');
      await loadData();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a meta de gasto.');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    await budgetRepo.deleteCategorySpendingGoal(id);
    await loadData();
  };

  const renderBudgetItem = ({ item }: ListRenderItemInfo<CategoryBudgetProgress>) => {
    const hasBudget = item.limitValue > 0 || item.budgetMode === 'percentual';
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
                  {item.budgetMode === 'percentual' && item.percentageValue
                    ? ` • Flexível (${item.percentageValue}% da receita)`
                    : ''}
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

          {item.missingIncomeWarning ? (
            <View style={styles.missingIncomeBanner}>
              <Feather name="alert-circle" size={14} color="#F59E0B" />
              <Text style={styles.missingIncomeText}>
                Sem receita registrada neste mês para calcular o limite de {item.percentageValue}%.
              </Text>
            </View>
          ) : null}

          {hasBudget && !item.missingIncomeWarning ? (
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
          ) : !hasBudget ? (
            <View style={styles.defineActionRow}>
              <Text style={styles.definePromptText}>
                Toque para definir o limite {activeTab === 'anual' ? 'anual' : 'mensal'}
              </Text>
              <Feather name="plus-circle" size={16} color="#60A5FA" />
            </View>
          ) : null}
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
        <View style={styles.periodTabsRow}>
          <TouchableOpacity
            style={[styles.periodTab, activeTab === 'mensal' ? styles.periodTabActive : null]}
            onPress={() => setActiveTab('mensal')}>
            <Text
              style={[
                styles.periodTabText,
                activeTab === 'mensal' ? styles.periodTabTextActive : null,
              ]}>
              Mensal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodTab, activeTab === 'anual' ? styles.periodTabActive : null]}
            onPress={() => setActiveTab('anual')}>
            <Text
              style={[
                styles.periodTabText,
                activeTab === 'anual' ? styles.periodTabTextActive : null,
              ]}>
              Anual
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.monthNavArrow}
            onPress={handlePrevPeriod}
            activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.monthNavCenter}>
            <Text style={styles.monthNavTitle}>
              {activeTab === 'anual'
                ? `Ano ${currentYear}`
                : `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}
            </Text>
            <Text style={styles.monthNavSubtitle}>
              {activeTab === 'anual' ? 'Planejamento Anual' : 'Acompanhamento Mensal'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.monthNavArrow}
            onPress={handleNextPeriod}
            activeOpacity={0.7}>
            <Feather name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickNavScroll}
          contentContainerStyle={styles.quickNavContent}>
          <TouchableOpacity
            style={styles.quickNavChip}
            activeOpacity={0.75}
            onPress={() =>
              router.push('/spending-goals' as unknown as Parameters<typeof router.push>[0])
            }>
            <Feather name="target" size={16} color="#60A5FA" />
            <Text style={styles.quickNavChipText}>Metas de Gastos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickNavChip}
            activeOpacity={0.75}
            onPress={() =>
              router.push('/zero-based-budget' as unknown as Parameters<typeof router.push>[0])
            }>
            <Feather name="pie-chart" size={16} color="#60A5FA" />
            <Text style={styles.quickNavChipText}>Zero-based</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickNavChip}
            activeOpacity={0.75}
            onPress={() =>
              router.push('/events' as unknown as Parameters<typeof router.push>[0])
            }>
            <Feather name="calendar" size={16} color="#60A5FA" />
            <Text style={styles.quickNavChipText}>Eventos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickNavChip}
            activeOpacity={0.75}
            onPress={() =>
              router.push('/spending-limits' as unknown as Parameters<typeof router.push>[0])
            }>
            <Feather name="sliders" size={16} color="#60A5FA" />
            <Text style={styles.quickNavChipText}>Tetos e Limites</Text>
          </TouchableOpacity>
        </ScrollView>

        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryCardTitle}>
              {activeTab === 'anual' ? 'Orçamento Geral do Ano' : 'Orçamento Geral do Mês'}
            </Text>
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
          <Text style={styles.sectionTitle}>
            Limites por Categoria ({activeTab === 'anual' ? 'Anual' : 'Mensal'})
          </Text>
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

  const renderFooter = () => (
    <View style={styles.goalsSection}>
      <View style={styles.goalsHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Metas de Gastos por Categoria</Text>
        </View>
        <TouchableOpacity
          style={styles.addGoalBtn}
          onPress={() =>
            router.push('/spending-goals' as unknown as Parameters<typeof router.push>[0])
          }>
          <Feather name="external-link" size={13} color="#FFFFFF" />
          <Text style={styles.addGoalBtnText}>Página de Metas</Text>
        </TouchableOpacity>
      </View>

      {goals.length === 0 ? (
        <Text style={styles.emptyGoalsText}>
          Nenhuma meta de gasto cadastrada. Crie metas para acompanhar categorias específicas.
        </Text>
      ) : (
        goals.map((g) => {
          const statusLabel =
            g.status === 'cumprida'
              ? 'Cumprida'
              : g.status === 'em_risco'
                ? 'Em risco'
                : 'Estourada';
          const statusColor =
            g.status === 'cumprida'
              ? '#10B981'
              : g.status === 'em_risco'
                ? '#F59E0B'
                : '#EF4444';

          return (
            <View key={g.goal.id} style={styles.goalCard}>
              <View style={styles.goalTopRow}>
                <Text style={styles.goalCatName}>{g.categoryName}</Text>
                <View style={styles.goalRightRow}>
                  <View
                    style={[
                      styles.goalStatusBadge,
                      { backgroundColor: `${statusColor}25`, borderColor: statusColor },
                    ]}>
                    <Text style={[styles.goalStatusText, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteGoal(g.goal.id)}>
                    <Feather name="trash-2" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.goalValuesText}>
                Gasto no mês: {formatCurrency(g.spentValue)} de {formatCurrency(g.maxMonthlyValue)} ({g.percentageSpent}%)
              </Text>
            </View>
          );
        })
      )}
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
          keyExtractor={(item) => `${activeTab}_${item.categoryId}`}
          renderItem={renderBudgetItem}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
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
                  {activeTab === 'anual'
                    ? `Orçamento Anual de ${currentYear}`
                    : `${MONTH_NAMES[currentMonth - 1]} de ${currentYear}`}
                </Text>
              </View>
            </View>

            {activeTab === 'mensal' ? (
              <View style={styles.modeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    budgetMode === 'fixo' ? styles.modeBtnActive : null,
                  ]}
                  onPress={() => setBudgetMode('fixo')}>
                  <Text
                    style={[
                      styles.modeBtnText,
                      budgetMode === 'fixo' ? styles.modeBtnTextActive : null,
                    ]}>
                    Valor Fixo (R$)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    budgetMode === 'percentual' ? styles.modeBtnActive : null,
                  ]}
                  onPress={() => setBudgetMode('percentual')}>
                  <Text
                    style={[
                      styles.modeBtnText,
                      budgetMode === 'percentual' ? styles.modeBtnTextActive : null,
                    ]}>
                    % da Receita
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {activeTab === 'mensal' && budgetMode === 'percentual' ? (
              <>
                <Text style={styles.inputFieldLabel}>
                  Percentual da Receita do Mês (%)
                </Text>
                <View style={styles.amountInputBox}>
                  <TextInput
                    style={styles.amountInput}
                    value={percentageInput}
                    onChangeText={setPercentageInput}
                    placeholder="Ex: 25"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    selectionColor="#60A5FA"
                  />
                  <Text style={styles.currencyPrefix}>%</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.inputFieldLabel}>
                  Limite {activeTab === 'anual' ? 'Anual' : 'Mensal'} Desejado
                </Text>
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
                    selectionColor="#60A5FA"
                  />
                </View>
              </>
            )}

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

      <Modal
        visible={goalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setGoalModalVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalCategoryTitle}>Nova Meta de Gastos</Text>
            <Text style={styles.inputFieldLabel}>Escolha a Categoria</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goalCatsRow}>
              {(summary?.categories ?? []).map((cat) => {
                const selected = goalCategoryId === cat.categoryId;
                return (
                  <TouchableOpacity
                    key={cat.categoryId}
                    style={[
                      styles.goalCatChip,
                      selected ? styles.goalCatChipSelected : null,
                    ]}
                    onPress={() => setGoalCategoryId(cat.categoryId)}>
                    <Text
                      style={[
                        styles.goalCatChipText,
                        selected ? styles.goalCatChipTextSelected : null,
                      ]}>
                      {cat.categoryName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.inputFieldLabel}>Teto Máximo Mensal da Meta</Text>
            <View style={styles.amountInputBox}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={goalMaxInput}
                onChangeText={(txt) => setGoalMaxInput(formatCurrencyInput(txt))}
                placeholder="0,00"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={handleSaveGoal}>
                <Text style={styles.btnSaveModalText}>Salvar Meta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCancelModal}
                onPress={() => setGoalModalVisible(false)}>
                <Text style={styles.btnCancelModalText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showGoalCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoalCategoryPicker(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowGoalCategoryPicker(false)}>
          <View style={styles.pickerModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalCategoryTitle}>Selecione a Categoria</Text>
              <TouchableOpacity
                onPress={() => setShowGoalCategoryPicker(false)}
                activeOpacity={0.7}
                style={styles.modalCloseBtn}>
                <Feather name="x" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={summary?.categories ?? []}
              keyExtractor={(item) => item.categoryId}
              style={{ maxHeight: 300, marginTop: 10 }}
              renderItem={({ item }) => {
                const isSelected = item.categoryId === goalCategoryId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.categoryOptionItem,
                      isSelected ? styles.categoryOptionItemSelected : null,
                    ]}
                    onPress={() => {
                      setGoalCategoryId(item.categoryId);
                      setShowGoalCategoryPicker(false);
                    }}
                    activeOpacity={0.75}>
                    <View style={styles.categoryOptionLeft}>
                      <View
                        style={[
                          styles.modalCategoryIconChip,
                          { backgroundColor: `${item.categoryColor || '#2563EB'}25` },
                        ]}>
                        <Feather
                          name={mapCategoryIcon(item.categoryIcon)}
                          size={18}
                          color={item.categoryColor || '#60A5FA'}
                        />
                      </View>
                      <Text style={styles.categoryOptionName}>{item.categoryName}</Text>
                    </View>
                    {isSelected ? (
                      <Feather name="check" size={18} color="#2563EB" />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  periodTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: '#2563EB',
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  monthNavArrow: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavCenter: {
    alignItems: 'center',
  },
  monthNavTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  monthNavSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  quickNavScroll: {
    marginHorizontal: -16,
    marginBottom: 16,
  },
  quickNavContent: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 48,
  },
  quickNavChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  summaryPercentagePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  summaryPercentageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summarySpentLabel: {
    fontSize: 11,
    color: '#BFDBFE',
    marginBottom: 2,
  },
  summarySpentValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricsDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  summaryBudgetedLabel: {
    fontSize: 11,
    color: '#BFDBFE',
    marginBottom: 2,
    textAlign: 'right',
  },
  summaryBudgetedValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
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
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 10,
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
    fontSize: 11,
    color: '#94A3B8',
  },
  cardWrapper: {
    marginBottom: 12,
  },
  budgetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryNameText: {
    fontSize: 15,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  percentageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noBudgetBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  noBudgetText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  missingIncomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  missingIncomeText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  progressContainer: {
    marginTop: 14,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  limitLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  remainingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  exceededText: {
    color: '#EF4444',
  },
  defineActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  definePromptText: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: '500',
  },
  goalsSection: {
    marginTop: 16,
    gap: 10,
  },
  goalsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addGoalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyGoalsText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  goalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  goalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalCatName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  goalRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  goalStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  goalValuesText: {
    color: '#94A3B8',
    fontSize: 12,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCategoryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalMonthSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0F172A',
    padding: 4,
    borderRadius: 10,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#2563EB',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  amountInputBox: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 20,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '600',
    color: '#60A5FA',
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 70,
    padding: 0,
  },
  goalCatsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  goalCatChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  goalCatChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  goalCatChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  goalCatChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalActions: {
    gap: 10,
    marginTop: 4,
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
    borderRadius: 12,
    height: 42,
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
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelModalText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryCardTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  catTriggerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalCategoryIconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTextCol: {
    flex: 1,
  },
  categoryTriggerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pickerModalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    maxHeight: '80%',
    padding: 20,
    gap: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  categoryOptionItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  categoryOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
