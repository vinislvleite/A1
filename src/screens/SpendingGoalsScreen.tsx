import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  CategorySpendingGoalsUseCase,
  CategorySpendingGoalProgress,
} from '../domain/usecases/CategorySpendingGoalsUseCase';
import { BudgetRepository } from '../data/repositories/BudgetRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { Category } from '../domain/entities/Category';
import { formatMoneyValue } from '../components/MoneyText';
import { ConfirmModal } from '../components/ConfirmModal';
import { usePrivacyMode } from '../context/PrivacyContext';
import { MONTH_NAMES } from '../utils/date';

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
  if (!iconName) return 'tag';
  if (iconName === 'shopping') return 'shopping-bag';
  if (VALID_CATEGORY_ICONS.has(iconName)) {
    return iconName as keyof typeof Feather.glyphMap;
  }
  return 'tag';
};



export function SpendingGoalsScreen() {
  usePrivacyMode();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const [goals, setGoals] = useState<CategorySpendingGoalProgress[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [goalAmountInput, setGoalAmountInput] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; catName: string } | null>(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    description: string;
    variant?: 'danger' | 'warning' | 'primary';
    icon?: keyof typeof Feather.glyphMap;
  } | null>(null);

  const amountInputRef = useRef<TextInput>(null);

  const goalsUseCase = new CategorySpendingGoalsUseCase();
  const budgetRepo = new BudgetRepository();
  const categoryRepo = new CategoryRepository();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [goalsList, categoriesList] = await Promise.all([
        goalsUseCase.execute(currentMonth, currentYear),
        categoryRepo.findAll(),
      ]);
      setGoals(goalsList);
      setAllCategories(categoriesList);
    } catch {
      setFeedbackModal({
        title: 'Erro',
        description: 'Não foi possível carregar as metas de gastos.',
        variant: 'danger',
        icon: 'alert-circle',
      });
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
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const openCreateModal = () => {
    setEditingGoalId(null);
    if (allCategories.length > 0) {
      const existingCatIds = new Set(goals.map((g) => g.goal.category_id));
      const availableCat = allCategories.find((c) => !existingCatIds.has(c.id)) ?? allCategories[0];
      setSelectedCategoryId(availableCat.id);
    } else {
      setSelectedCategoryId('');
    }
    setGoalAmountInput('');
    setCategorySearchQuery('');
    setGoalModalVisible(true);
  };

  const openEditModal = (goalItem: CategorySpendingGoalProgress) => {
    setEditingGoalId(goalItem.goal.id);
    setSelectedCategoryId(goalItem.goal.category_id);
    setGoalAmountInput(
      goalItem.maxMonthlyValue > 0
        ? goalItem.maxMonthlyValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : ''
    );
    setCategorySearchQuery('');
    setGoalModalVisible(true);
  };

  const handleSaveGoal = async () => {
    const val = parseCurrencyValue(goalAmountInput);
    if (!selectedCategoryId) {
      setFeedbackModal({
        title: 'Categoria Obrigatória',
        description: 'Selecione uma categoria para a meta.',
        variant: 'warning',
        icon: 'alert-triangle',
      });
      return;
    }
    if (val <= 0) {
      setFeedbackModal({
        title: 'Valor Inválido',
        description: 'Informe um valor limite válido maior que zero.',
        variant: 'warning',
        icon: 'alert-triangle',
      });
      return;
    }

    try {
      setIsSaving(true);
      await budgetRepo.setCategorySpendingGoal(selectedCategoryId, val);
      setGoalModalVisible(false);
      setGoalAmountInput('');
      await loadData();
      setFeedbackModal({
        title: 'Meta Salva',
        description: 'Meta de gastos por categoria salva com sucesso.',
        variant: 'primary',
        icon: 'check-circle',
      });
    } catch {
      setFeedbackModal({
        title: 'Erro',
        description: 'Não foi possível salvar a meta de gasto.',
        variant: 'danger',
        icon: 'alert-circle',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = (id: string, catName: string) => {
    setGoalToDelete({ id, catName });
  };

  const handleConfirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    setIsDeletingGoal(true);
    try {
      await budgetRepo.deleteCategorySpendingGoal(goalToDelete.id);
      setGoalToDelete(null);
      await loadData();
    } catch {
      setFeedbackModal({
        title: 'Erro',
        description: 'Não foi possível remover a meta.',
        variant: 'danger',
        icon: 'alert-circle',
      });
    } finally {
      setIsDeletingGoal(false);
    }
  };

  const selectedCategoryObj = allCategories.find((c) => c.id === selectedCategoryId);

  const filteredCategories = allCategories.filter((c) =>
    c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const totalGoals = goals.length;
  const compliantGoals = goals.filter((g) => g.status === 'cumprida').length;
  const alertGoals = goals.filter((g) => g.status === 'em_risco' || g.status === 'estourada').length;

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
        <Text style={styles.navTitle}>Metas de Gastos</Text>
        <TouchableOpacity
          style={styles.navAddBtn}
          onPress={openCreateModal}
          activeOpacity={0.75}>
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.navAddBtnText}>Nova Meta</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.monthNavArrow}
            onPress={handlePrevMonth}
            activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <View style={styles.monthNavCenter}>
            <Text style={styles.monthNavTitle}>
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </Text>
            <Text style={styles.monthNavSubtitle}>Acompanhamento Mensal</Text>
          </View>
          <TouchableOpacity
            style={styles.monthNavArrow}
            onPress={handleNextMonth}
            activeOpacity={0.7}>
            <Feather name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total de Metas</Text>
            <Text style={styles.kpiValue}>{totalGoals}</Text>
            <Text style={styles.kpiSub}>categorias monitoradas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>No Teto</Text>
            <Text style={[styles.kpiValue, { color: '#10B981' }]}>{compliantGoals}</Text>
            <Text style={styles.kpiSub}>dentro do limite</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Atenção / Limite</Text>
            <Text style={[styles.kpiValue, { color: alertGoals > 0 ? '#EF4444' : '#94A3B8' }]}>
              {alertGoals}
            </Text>
            <Text style={styles.kpiSub}>em risco ou estouradas</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTitleCol}>
            <Text style={styles.sectionTitle}>Metas por Categoria</Text>
            <Text style={styles.sectionSubtitle}>
              Limites mensais configurados para controlar gastos específicos
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="target" size={32} color="#60A5FA" />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma meta de gastos definida</Text>
            <Text style={styles.emptyDesc}>
              Crie metas mensais por categoria para receber alertas antes de estourar o orçamento e manter suas finanças sob controle.
            </Text>
            <TouchableOpacity
              style={styles.btnEmptyAction}
              onPress={openCreateModal}
              activeOpacity={0.8}>
              <Feather name="plus-circle" size={18} color="#FFFFFF" />
              <Text style={styles.btnEmptyActionText}>Criar Primeira Meta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((g) => {
            const statusLabel =
              g.status === 'cumprida'
                ? 'Dentro do teto'
                : g.status === 'em_risco'
                ? 'Atenção (80%+)'
                : 'Teto Excedido';

            const statusColor =
              g.status === 'cumprida'
                ? '#10B981'
                : g.status === 'em_risco'
                ? '#F59E0B'
                : '#EF4444';

            const progressClamped = Math.min(100, Math.max(0, g.percentageSpent));
            const remaining = g.maxMonthlyValue - g.spentValue;

            return (
              <View key={g.goal.id} style={styles.goalCard}>
                <View style={styles.goalTopRow}>
                  <View style={styles.goalCatInfo}>
                    <View
                      style={[
                        styles.catIconChip,
                        { backgroundColor: `${g.categoryColor || '#2563EB'}22` },
                      ]}>
                      <Feather
                        name={mapCategoryIcon(g.categoryIcon)}
                        size={20}
                        color={g.categoryColor || '#60A5FA'}
                      />
                    </View>
                    <View style={styles.goalCatTextCol}>
                      <Text style={styles.goalCatName}>{g.categoryName}</Text>
                      <Text style={styles.goalPeriodText}>
                        Meta de {MONTH_NAMES[currentMonth - 1]}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.goalStatusBadge,
                      { backgroundColor: `${statusColor}18`, borderColor: statusColor },
                    ]}>
                    <Text style={[styles.goalStatusText, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${progressClamped}%`,
                        backgroundColor: statusColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.valuesRow}>
                  <View style={styles.valueCol}>
                    <Text style={styles.valueMetaLabel}>Gasto Atual</Text>
                    <Text style={[styles.valueSpentText, { color: statusColor }]}>
                      {formatCurrency(g.spentValue)}
                    </Text>
                  </View>
                  <View style={styles.valueColCenter}>
                    <Text style={styles.valueMetaLabel}>Teto Mensal</Text>
                    <Text style={styles.valueLimitText}>
                      {formatCurrency(g.maxMonthlyValue)}
                    </Text>
                  </View>
                  <View style={styles.valueColRight}>
                    <Text style={styles.valueMetaLabel}>
                      {remaining >= 0 ? 'Disponível' : 'Excedeu'}
                    </Text>
                    <Text
                      style={[
                        styles.valueRemainingText,
                        { color: remaining >= 0 ? '#10B981' : '#EF4444' },
                      ]}>
                      {formatCurrency(Math.abs(remaining))}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.percentText}>
                    {g.percentageSpent.toFixed(1).replace('.', ',')}% do teto utilizado
                  </Text>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.cardActionBtn}
                      onPress={() => openEditModal(g)}
                      activeOpacity={0.7}>
                      <Feather name="edit-2" size={14} color="#60A5FA" />
                      <Text style={styles.cardActionBtnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cardActionBtnDelete}
                      onPress={() => handleDeleteGoal(g.goal.id, g.categoryName)}
                      activeOpacity={0.7}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

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
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderBadge}>
                <Feather name="target" size={18} color="#60A5FA" />
              </View>
              <Text style={styles.modalTitle}>
                {editingGoalId ? 'Editar Meta de Gastos' : 'Nova Meta de Gastos'}
              </Text>
              <TouchableOpacity
                onPress={() => setGoalModalVisible(false)}
                activeOpacity={0.7}
                style={styles.modalCloseBtn}>
                <Feather name="x" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Categoria</Text>
              <TouchableOpacity
                style={styles.categoryCardTrigger}
                onPress={() => setShowCategoryPicker(true)}
                activeOpacity={0.75}>
                <View style={styles.catTriggerInfo}>
                  <View
                    style={[
                      styles.modalCategoryIconChip,
                      {
                        backgroundColor: `${selectedCategoryObj?.color || '#2563EB'}25`,
                      },
                    ]}>
                    <Feather
                      name={mapCategoryIcon(selectedCategoryObj?.icon)}
                      size={18}
                      color={selectedCategoryObj?.color || '#60A5FA'}
                    />
                  </View>
                  <View style={styles.modalOptionTextCol}>
                    <Text style={styles.categoryTriggerName}>
                      {selectedCategoryObj?.name ?? 'Selecione uma categoria'}
                    </Text>
                    {selectedCategoryObj?.description ? (
                      <Text style={styles.categoryTriggerDesc} numberOfLines={1}>
                        {selectedCategoryObj.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Feather name="chevron-down" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Teto Máximo Mensal</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => amountInputRef.current?.focus()}
                style={styles.amountBox}>
                <Text style={styles.currencyPrefix}>R$</Text>
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountInput}
                  value={goalAmountInput}
                  onChangeText={(txt) => setGoalAmountInput(formatCurrencyInput(txt))}
                  placeholder="0,00"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  selectionColor="#60A5FA"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnSaveModal}
                onPress={handleSaveGoal}
                disabled={isSaving}
                activeOpacity={0.8}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.btnSaveModalText}>Salvar Meta</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCancelModal}
                onPress={() => setGoalModalVisible(false)}
                activeOpacity={0.7}>
                <Text style={styles.btnCancelModalText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}>
          <View style={styles.pickerModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Selecione a Categoria</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(false)}
                activeOpacity={0.7}
                style={styles.modalCloseBtn}>
                <Feather name="x" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
                placeholder="Buscar categoria..."
                placeholderTextColor="#64748B"
              />
              {categorySearchQuery ? (
                <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                  <Feather name="x" size={14} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item.id}
              style={styles.categoriesList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.categoryOptionItem,
                      isSelected ? styles.categoryOptionItemSelected : null,
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(item.id);
                      setShowCategoryPicker(false);
                    }}
                    activeOpacity={0.75}>
                    <View style={styles.categoryOptionLeft}>
                      <View
                        style={[
                          styles.modalCategoryIconChip,
                          { backgroundColor: `${item.color || '#2563EB'}25` },
                        ]}>
                        <Feather
                          name={mapCategoryIcon(item.icon)}
                          size={18}
                          color={item.color || '#60A5FA'}
                        />
                      </View>
                      <View style={styles.modalOptionTextCol}>
                        <Text style={styles.categoryOptionName}>{item.name}</Text>
                        {item.description ? (
                          <Text style={styles.categoryOptionDesc} numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
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
      <ConfirmModal
        visible={Boolean(goalToDelete)}
        title="Excluir Meta de Gastos"
        description={`Deseja realmente remover a meta de gastos para "${goalToDelete?.catName}"?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingGoal}
        onConfirm={handleConfirmDeleteGoal}
        onCancel={() => setGoalToDelete(null)}
      />
      <ConfirmModal
        visible={Boolean(feedbackModal)}
        title={feedbackModal?.title ?? ''}
        description={feedbackModal?.description ?? ''}
        variant={feedbackModal?.variant ?? 'primary'}
        icon={feedbackModal?.icon}
        singleButton
        confirmText="Entendido"
        onConfirm={() => setFeedbackModal(null)}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  navAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
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
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeaderRow: {
    marginTop: 4,
  },
  sectionHeaderTitleCol: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  btnEmptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 6,
  },
  btnEmptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  goalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalCatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  catIconChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCatTextCol: {
    flex: 1,
  },
  goalCatName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  goalPeriodText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  goalStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  goalStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  valueCol: {
    flex: 1,
  },
  valueColCenter: {
    flex: 1,
    alignItems: 'center',
  },
  valueColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  valueMetaLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  valueSpentText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  valueLimitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  valueRemainingText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  percentText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  cardActionBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActionBtnDelete: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 16,
  },
  pickerModalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    maxHeight: '80%',
    padding: 20,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 10,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
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
    height: 54,
  },
  catTriggerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalCategoryIconChip: {
    width: 36,
    height: 36,
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
  categoryTriggerDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  amountBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
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
    textAlign: 'left',
  },
  modalActions: {
    gap: 10,
    marginTop: 4,
  },
  btnSaveModal: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSaveModalText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnCancelModal: {
    borderRadius: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelModalText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
  },
  categoriesList: {
    maxHeight: 280,
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
  categoryOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
