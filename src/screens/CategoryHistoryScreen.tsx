import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { Category } from '../domain/entities/Category';
import { Transaction, CategoryMonthlyTotal } from '../domain/entities/Transaction';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';

export interface CategoryHistoryScreenProps {
  id: string;
}

const MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const formatCurrency = (val: number): string => formatMoneyValue(val);

const formatYearMonthLabel = (yearMonth: string): string => {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return yearMonth;
  return `${MONTH_NAMES[m - 1]}/${y}`;
};

const formatShortDate = (isoDate: string): string => {
  const part = isoDate.split('T')[0];
  const [y, m, d] = part.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return part;
};

export function CategoryHistoryScreen({ id }: CategoryHistoryScreenProps) {
  usePrivacyMode();
  const [category, setCategory] = useState<Category | null>(null);
  const [monthlyTotals, setMonthlyTotals] = useState<CategoryMonthlyTotal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const categoryRepo = useMemo(() => new CategoryRepository(), []);
  const transactionRepo = useMemo(() => new TransactionRepository(), []);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [cat, totals, txList] = await Promise.all([
        categoryRepo.findById(id),
        transactionRepo.getMonthlyTotalsByCategory(id),
        transactionRepo.findAll({ categoryId: id }),
      ]);
      setCategory(cat);
      setMonthlyTotals(totals);
      setTransactions(txList);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [id, categoryRepo, transactionRepo]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const recentMonths = useMemo(() => monthlyTotals.slice(0, 6), [monthlyTotals]);

  const maxMonthlyTotal = useMemo(() => {
    if (recentMonths.length === 0) return 1;
    return Math.max(...recentMonths.map((m) => m.total), 1);
  }, [recentMonths]);

  const groupedTransactions = useMemo(() => {
    const filtered = selectedMonth
      ? transactions.filter((t) => t.date.substring(0, 7) === selectedMonth)
      : transactions;

    const groups = new Map<string, { yearMonth: string; subtotal: number; items: Transaction[] }>();
    for (const tx of filtered) {
      const ym = tx.date.substring(0, 7);
      const existing = groups.get(ym) ?? { yearMonth: ym, subtotal: 0, items: [] };
      if (tx.status === 'confirmada') {
        existing.subtotal = Number((existing.subtotal + tx.value).toFixed(2));
      }
      existing.items.push(tx);
      groups.set(ym, existing);
    }

    return Array.from(groups.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  }, [transactions, selectedMonth]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando histórico da categoria...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {category?.name ?? 'Histórico por Categoria'}
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {category ? (
          <View style={styles.categoryHeaderCard}>
            <View
              style={[
                styles.categoryIconBox,
                { backgroundColor: `${category.color || '#2563EB'}25` },
              ]}>
              <Feather
                name={(category.icon as keyof typeof Feather.glyphMap) || 'tag'}
                size={22}
                color={category.color || '#60A5FA'}
              />
            </View>
            <View style={styles.categoryHeaderInfo}>
              <Text style={styles.categoryHeaderTitle}>{category.name}</Text>
              {category.description ? (
                <Text style={styles.categoryHeaderDesc}>{category.description}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitle}>Comparativo Mensal</Text>
            {selectedMonth ? (
              <TouchableOpacity onPress={() => setSelectedMonth(null)}>
                <Text style={styles.clearMonthFilterText}>Ver todos os meses</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {recentMonths.length === 0 ? (
            <Text style={styles.emptyChartText}>
              Nenhuma transação confirmada nesta categoria ainda.
            </Text>
          ) : (
            <View style={styles.barsList}>
              {recentMonths.map((item, idx) => {
                const prevMonthItem = recentMonths[idx + 1];
                let variationPct: number | null = null;
                if (prevMonthItem && prevMonthItem.total > 0) {
                  variationPct = Number(
                    (((item.total - prevMonthItem.total) / prevMonthItem.total) * 100).toFixed(1)
                  );
                }
                const fillRatio = Math.max(0.06, Math.min(1, item.total / maxMonthlyTotal));
                const isSelected = selectedMonth === item.yearMonth;

                return (
                  <TouchableOpacity
                    key={item.yearMonth}
                    style={[styles.barRowItem, isSelected ? styles.barRowItemActive : null]}
                    onPress={() =>
                      setSelectedMonth(isSelected ? null : item.yearMonth)
                    }
                    activeOpacity={0.75}>
                    <View style={styles.barRowTop}>
                      <Text style={styles.barMonthLabel}>
                        {formatYearMonthLabel(item.yearMonth)} ({item.count})
                      </Text>
                      <View style={styles.barRightStats}>
                        {variationPct !== null ? (
                          <Text
                            style={[
                              styles.variationText,
                              variationPct > 0 ? styles.variationUp : styles.variationDown,
                            ]}>
                            {variationPct > 0 ? `+${variationPct}%` : `${variationPct}%`}
                          </Text>
                        ) : null}
                        <Text style={styles.barAmountText}>{formatCurrency(item.total)}</Text>
                      </View>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.round(fillRatio * 100)}%`,
                            backgroundColor: category?.color || '#3B82F6',
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>TRANSAÇÕES POR MÊS</Text>

        {groupedTransactions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="inbox" size={36} color="#64748B" />
            <Text style={styles.emptyBoxText}>Nenhuma transação registrada para esta categoria.</Text>
          </View>
        ) : (
          groupedTransactions.map((group) => (
            <View key={group.yearMonth} style={styles.monthGroupCard}>
              <View style={styles.monthGroupHeader}>
                <Text style={styles.monthGroupTitle}>
                  {formatYearMonthLabel(group.yearMonth)}
                </Text>
                <Text style={styles.monthGroupSubtotal}>
                  Total: {formatCurrency(group.subtotal)}
                </Text>
              </View>

              {group.items.map((tx) => {
                const isIncome = tx.type === 'receita';
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.txItemRow}
                    activeOpacity={0.75}
                    onPress={() =>
                      router.push({
                        pathname: '/transaction-detail',
                        params: { id: tx.id },
                      } as unknown as Parameters<typeof router.push>[0])
                    }>
                    <View style={[styles.txIconBox, { backgroundColor: `${category?.color || '#2563EB'}22` }]}>
                      <Feather
                        name={(category?.icon as keyof typeof Feather.glyphMap) || 'tag'}
                        size={16}
                        color={category?.color || '#60A5FA'}
                      />
                    </View>
                    <View style={styles.txLeft}>
                      <Text style={styles.txDesc} numberOfLines={1}>
                        {tx.description}
                      </Text>
                      <Text style={styles.txDate}>
                        {formatShortDate(tx.date)}
                        {tx.status === 'pendente' ? ' • Pendente' : ''}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        isIncome ? styles.txAmountIncome : styles.txAmountExpense,
                      ]}>
                      {isIncome ? '+ ' : '- '}
                      {formatCurrency(tx.value)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  navBackBtn: {
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
    maxWidth: '70%',
  },
  navSpacer: {
    width: 38,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    gap: 16,
  },
  categoryHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    gap: 14,
  },
  categoryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeaderInfo: {
    flex: 1,
  },
  categoryHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  categoryHeaderDesc: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 3,
  },
  chartCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearMonthFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60A5FA',
  },
  emptyChartText: {
    fontSize: 13,
    color: '#94A3B8',
    paddingVertical: 12,
  },
  barsList: {
    gap: 12,
  },
  barRowItem: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  barRowItemActive: {
    borderColor: '#60A5FA',
  },
  barRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barMonthLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  barRightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  variationUp: {
    color: '#F87171',
  },
  variationDown: {
    color: '#4ADE80',
  },
  barAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  emptyBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyBoxText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  monthGroupCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    gap: 10,
  },
  monthGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10,
  },
  monthGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#60A5FA',
  },
  monthGroupSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  txItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  txIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txLeft: {
    flex: 1,
    marginRight: 10,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  txDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmountIncome: {
    color: '#4ADE80',
  },
  txAmountExpense: {
    color: '#F87171',
  },
});
