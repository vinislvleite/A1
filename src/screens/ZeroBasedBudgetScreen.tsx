import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  ZeroBasedBudgetUseCase,
  calculateZeroBasedSummary,
} from '../domain/usecases/ZeroBasedBudgetUseCase';
import { ZeroBasedGroupType } from '../domain/entities/Budget';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { Category } from '../domain/entities/Category';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';

interface DraftAllocationItem {
  id: string;
  group_type: ZeroBasedGroupType;
  category_name: string;
  category_id?: string | null;
  allocated_value: number;
}

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

const formatCurrencyInput = (rawText: string): string => {
  const cleanDigits = rawText.replace(/\D/g, '').slice(0, 10);
  if (!cleanDigits) return '';
  const cents = parseInt(cleanDigits, 10);
  if (cents === 0) return '';
  const amount = cents / 100;
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDbValue = (val: number): string => {
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function ZeroBasedBudgetScreen() {
  usePrivacyMode();
  const formatCurrency = (value: number): string => formatMoneyValue(value);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expectedIncomeText, setExpectedIncomeText] = useState('');
  const [items, setItems] = useState<DraftAllocationItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newGroup, setNewGroup] = useState<ZeroBasedGroupType>('gastos');
  const [newName, setNewName] = useState('');
  const [newValueText, setNewValueText] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categoriesMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) {
      map.set(c.id, c);
      map.set(c.name.toLowerCase(), c);
    }
    return map;
  }, [categories]);

  const selectedCategory = useMemo(() => {
    if (!selectedCatId) return null;
    return categories.find((c) => c.id === selectedCatId) ?? null;
  }, [selectedCatId, categories]);

  const loadMonthData = useCallback(async () => {
    try {
      setIsLoading(true);
      const useCase = new ZeroBasedBudgetUseCase();
      const catRepo = new CategoryRepository();
      const [res, cats] = await Promise.all([
        useCase.loadMonth(month, year),
        catRepo.findAll(),
      ]);

      setCategories(cats);
      setExpectedIncomeText(
        res.summary.expectedIncome > 0 ? formatDbValue(res.summary.expectedIncome) : ''
      );
      setItems(
        res.allocations.map((a) => ({
          id: a.id,
          group_type: a.group_type,
          category_name: a.category_name,
          category_id: a.category_id,
          allocated_value: a.allocated_value,
        }))
      );
    } catch {
      Alert.alert('Erro', 'Falha ao carregar alocação zero-based.');
    } finally {
      setIsLoading(false);
    }
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      loadMonthData();
    }, [loadMonthData])
  );

  const parsedIncome =
    parseFloat(expectedIncomeText.replace(/\./g, '').replace(',', '.')) || 0;
  const liveSummary = calculateZeroBasedSummary(parsedIncome, items);

  const handleSelectCategory = (cat: Category) => {
    setSelectedCatId(cat.id);
    setNewName(cat.name);
    setShowCategoryModal(false);
  };

  const handleAddAllocation = () => {
    const val = parseFloat(newValueText.replace(/\./g, '').replace(',', '.')) || 0;
    const label = newGroup === 'gastos' ? (selectedCategory?.name ?? newName.trim()) : newName.trim();

    if (!label || val <= 0) {
      Alert.alert(
        'Atenção',
        newGroup === 'gastos'
          ? 'Selecione uma categoria e informe um valor maior que zero.'
          : 'Informe o destino e um valor maior que zero.'
      );
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: `draft_${Date.now()}_${Math.random()}`,
        group_type: newGroup,
        category_name: label,
        category_id: newGroup === 'gastos' ? selectedCatId : null,
        allocated_value: Number(val.toFixed(2)),
      },
    ]);
    setNewName('');
    setNewValueText('');
    setSelectedCatId(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const useCase = new ZeroBasedBudgetUseCase();
      await useCase.saveMonth({
        month,
        year,
        expectedIncome: parsedIncome,
        items,
        syncExpenseBudgets: true,
      });
      Alert.alert(
        'Orçamento Zero-based Salvo',
        liveSummary.isZeroBalanced
          ? 'Perfeito! Cada real da sua receita prevista tem um destino planejado (Restante: R$ 0,00).'
          : 'Alocações do mês salvas com sucesso.'
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a alocação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Orçamento Zero-based</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.monthNavArrow}
          onPress={() => {
            if (month === 1) {
              setMonth(12);
              setYear((y) => y - 1);
            } else {
              setMonth((m) => m - 1);
            }
          }}
          activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View style={styles.monthNavCenter}>
          <Text style={styles.monthNavTitle}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <Text style={styles.monthNavSubtitle}>Acompanhamento Mensal</Text>
        </View>
        <TouchableOpacity
          style={styles.monthNavArrow}
          onPress={() => {
            if (month === 12) {
              setMonth(1);
              setYear((y) => y + 1);
            } else {
              setMonth((m) => m + 1);
            }
          }}
          activeOpacity={0.7}>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.fieldLabel}>Receita Prevista do Mês</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={expectedIncomeText}
                onChangeText={(txt) => setExpectedIncomeText(formatCurrencyInput(txt))}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor="#64748B"
                selectionColor="#60A5FA"
              />
            </View>

            <View style={styles.remainingRow}>
              <Text style={styles.remainingLabel}>Restante a alocar:</Text>
              <Text
                style={[
                  styles.remainingValue,
                  liveSummary.isZeroBalanced
                    ? styles.zeroText
                    : liveSummary.isOverAllocated
                      ? styles.overText
                      : styles.pendingText,
                ]}>
                {formatCurrency(liveSummary.remainingToAllocate)}
              </Text>
            </View>

            {liveSummary.isZeroBalanced ? (
              <View style={styles.zeroBadge}>
                <Feather name="check-circle" size={16} color="#10B981" />
                <Text style={styles.zeroBadgeText}>
                  Orçamento equilibrado! Todo o seu dinheiro foi alocado (R$ 0,00 restante).
                </Text>
              </View>
            ) : null}

            <View style={styles.groupsBreakdown}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.groupBreakItem}>
                  Gastos: {formatCurrency(liveSummary.gastosTotal)}
                </Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.groupBreakItem}>
                  Poupança: {formatCurrency(liveSummary.poupancaTotal)}
                </Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.groupBreakItem}>
                  Invest.: {formatCurrency(liveSummary.investimentosTotal)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.addCard}>
            <Text style={styles.sectionTitle}>Nova Alocação</Text>
            <View style={styles.groupTabs}>
              {(['gastos', 'poupanca', 'investimentos'] as ZeroBasedGroupType[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.groupTab, newGroup === g ? styles.groupTabActive : null]}
                  onPress={() => {
                    setNewGroup(g);
                    setNewName('');
                    setSelectedCatId(null);
                  }}
                  activeOpacity={0.75}>
                  <Text
                    style={[
                      styles.groupTabText,
                      newGroup === g ? styles.groupTabTextActive : null,
                    ]}>
                    {g === 'gastos'
                      ? 'Gastos'
                      : g === 'poupanca'
                        ? 'Poupança'
                        : 'Investimentos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newGroup === 'gastos' ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Categoria</Text>
                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => setShowCategoryModal(true)}
                  activeOpacity={0.7}>
                  <View style={styles.catInfo}>
                    <View
                      style={[
                        styles.catIconChip,
                        { backgroundColor: `${selectedCategory?.color || '#2563EB'}22` },
                      ]}>
                      <Feather
                        name={mapCategoryIcon(selectedCategory?.icon)}
                        size={18}
                        color={selectedCategory?.color || '#60A5FA'}
                      />
                    </View>
                    <View style={styles.catTextCol}>
                      <Text style={styles.catName}>
                        {selectedCategory?.name ?? 'Selecione uma categoria'}
                      </Text>
                      {selectedCategory?.description ? (
                        <Text style={styles.catDescriptionSub} numberOfLines={1}>
                          {selectedCategory.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Feather name="chevron-down" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {newGroup === 'poupanca' ? 'Destino da Poupança' : 'Destino do Investimento'}
                </Text>
                <View style={styles.textInputBox}>
                  <Feather
                    name={newGroup === 'poupanca' ? 'shield' : 'trending-up'}
                    size={16}
                    color="#60A5FA"
                  />
                  <TextInput
                    style={styles.textInput}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={
                      newGroup === 'poupanca'
                        ? 'Ex: Reserva de emergência, Viagem...'
                        : 'Ex: Tesouro Direto, CDB, Ações...'
                    }
                    placeholderTextColor="#64748B"
                    selectionColor="#60A5FA"
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Valor Planejado</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencyPrefix}>R$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={newValueText}
                  onChangeText={(txt) => setNewValueText(formatCurrencyInput(txt))}
                  placeholder="0,00"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  selectionColor="#60A5FA"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAddAllocation} activeOpacity={0.85}>
              <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.addBtnText}>Adicionar à Alocação</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.allocatedSectionHeader}>
            <Text style={styles.sectionTitle}>Destinos Alocados ({items.length})</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyAllocationsBox}>
              <Feather name="layers" size={28} color="#475569" />
              <Text style={styles.emptyAllocationsText}>
                Nenhum destino adicionado para este mês ainda.
              </Text>
            </View>
          ) : (
            items.map((item) => {
              const cat =
                item.category_id
                  ? categoriesMap.get(item.category_id)
                  : categoriesMap.get(item.category_name.toLowerCase());
              const catColor =
                item.group_type === 'gastos'
                  ? cat?.color || '#3B82F6'
                  : item.group_type === 'poupanca'
                    ? '#10B981'
                    : '#8B5CF6';
              const catIcon =
                item.group_type === 'gastos'
                  ? mapCategoryIcon(cat?.icon)
                  : item.group_type === 'poupanca'
                    ? 'shield'
                    : 'trending-up';

              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <View style={[styles.itemIconBox, { backgroundColor: `${catColor}22` }]}>
                      <Feather name={catIcon} size={18} color={catColor} />
                    </View>
                    <View>
                      <Text style={styles.itemName}>{item.category_name}</Text>
                      <Text style={styles.itemGroup}>
                        {item.group_type === 'gastos'
                          ? 'Gastos'
                          : item.group_type === 'poupanca'
                            ? 'Poupança'
                            : 'Investimentos'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemValue}>{formatCurrency(item.allocated_value)}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Salvar Alocação do Mês</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Selecione a Categoria</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedCatId;
                return (
                  <TouchableOpacity
                    style={[styles.modalOptionRow, isSelected ? styles.modalOptionRowSelected : null]}
                    onPress={() => handleSelectCategory(item)}
                    activeOpacity={0.7}>
                    <View style={styles.modalOptionContent}>
                      <View
                        style={[
                          styles.modalCategoryIconChip,
                          { backgroundColor: `${item.color || '#2563EB'}25` },
                        ]}>
                        <Feather
                          name={mapCategoryIcon(item.icon)}
                          size={18}
                          color={item.color || '#2563EB'}
                        />
                      </View>
                      <View style={styles.modalOptionTextCol}>
                        <Text style={styles.modalOptionText}>{item.name}</Text>
                        {item.description ? (
                          <Text style={styles.modalOptionDesc} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {isSelected ? <Feather name="check" size={18} color="#2563EB" /> : null}
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
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
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
  navTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  navPlaceholder: { width: 38 },
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
    marginHorizontal: 16,
    marginBottom: 12,
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
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 36, gap: 14 },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#60A5FA',
  },
  amountInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
  },
  textInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'left',
  },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  remainingLabel: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  remainingValue: { fontSize: 20, fontWeight: '800' },
  zeroText: { color: '#10B981' },
  overText: { color: '#EF4444' },
  pendingText: { color: '#F59E0B' },
  zeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  zeroBadgeText: { color: '#A7F3D0', fontSize: 12, fontWeight: '600', flex: 1 },
  groupsBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  groupBreakItem: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  addCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  groupTabs: { flexDirection: 'row', gap: 6 },
  groupTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  groupTabActive: { backgroundColor: '#2563EB', borderColor: '#60A5FA' },
  groupTabText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  groupTabTextActive: { color: '#FFFFFF' },
  categoryCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  catIconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTextCol: {
    flex: 1,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  catDescriptionSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  allocatedSectionHeader: {
    marginTop: 4,
  },
  emptyAllocationsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyAllocationsText: {
    color: '#64748B',
    fontSize: 13,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  itemGroup: { color: '#64748B', fontSize: 11, marginTop: 2 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemValue: { color: '#60A5FA', fontSize: 14, fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionRowSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
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
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOptionDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
});
