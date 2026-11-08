import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Alert,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  BuildStatementUseCase,
  StatementLine,
  StatementResult,
} from '../domain/usecases/BuildStatementUseCase';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { Account } from '../domain/entities/Account';
import { Category } from '../domain/entities/Category';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';

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

const PAGE_SIZE = 25;

const formatCurrency = (value: number): string => formatMoneyValue(value);

const formatDateShort = (ymd: string): string => {
  const parts = ymd.substring(0, 10).split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}`;
};

const mapCategoryIcon = (iconName?: string): keyof typeof Feather.glyphMap => {
  if (!iconName) return 'credit-card';
  if (iconName in Feather.glyphMap) {
    return iconName as keyof typeof Feather.glyphMap;
  }
  return 'credit-card';
};

export function StatementScreen() {
  usePrivacyMode();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const initialAccountId = typeof params.accountId === 'string' && params.accountId ? params.accountId : undefined;

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(initialAccountId);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Map<string, Category>>(new Map());
  const [statement, setStatement] = useState<StatementResult | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatement = useCallback(async () => {
    try {
      setIsLoading(true);
      const accountRepo = new AccountRepository();
      const categoryRepo = new CategoryRepository();
      const statementUseCase = new BuildStatementUseCase(accountRepo);

      const [allAccounts, allCategories, result] = await Promise.all([
        accountRepo.findAll(),
        categoryRepo.findAll(),
        statementUseCase.execute({
          month: selectedMonth,
          year: selectedYear,
          accountId: selectedAccountId,
        }),
      ]);

      setAccounts(allAccounts);
      setCategoriesMap(new Map(allCategories.map((c) => [c.id, c])));
      setStatement(result);
      setVisibleCount(PAGE_SIZE);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao carregar extrato.';
      Alert.alert('Erro', msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, selectedAccountId]);

  useFocusEffect(
    useCallback(() => {
      loadStatement();
    }, [loadStatement])
  );

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleLoadMore = () => {
    if (!statement) return;
    if (visibleCount < statement.lines.length) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  };

  const renderLineItem = ({ item }: ListRenderItemInfo<StatementLine>) => {
    const isIncome = item.transaction.type === 'receita';
    const isRunningNegative = item.runningBalance < 0;
    const cat = categoriesMap.get(item.transaction.category_id);
    const catColor = cat?.color ?? (isIncome ? '#4ADE80' : '#60A5FA');
    const catIcon = cat ? mapCategoryIcon(cat.icon) : 'credit-card';

    return (
      <TouchableOpacity
        style={styles.lineCard}
        activeOpacity={0.75}
        onPress={() =>
          router.push({
            pathname: '/transaction-detail',
            params: { id: item.transaction.id },
          } as unknown as Parameters<typeof router.push>[0])
        }>
        <View style={[styles.lineIconBox, { backgroundColor: `${catColor}20` }]}>
          <Feather name={catIcon} size={16} color={catColor} />
        </View>

        <View style={styles.lineDateBadge}>
          <Text style={styles.lineDateText}>{formatDateShort(item.transaction.date)}</Text>
        </View>

        <View style={styles.lineCenterCol}>
          <Text style={styles.lineDescription} numberOfLines={1}>
            {item.transaction.description}
          </Text>
          <Text style={styles.lineAccountName} numberOfLines={1}>
            {item.accountName}{cat?.name ? ` · ${cat.name}` : ''}
          </Text>
        </View>

        <View style={styles.lineRightCol}>
          <Text style={[styles.lineValue, isIncome ? styles.incomeText : styles.expenseText]}>
            {isIncome ? '+' : '-'} {formatCurrency(item.transaction.value)}
          </Text>
          <Text
            style={[
              styles.runningBalanceText,
              isRunningNegative ? styles.runningNegative : styles.runningPositive,
            ]}>
            Saldo: {formatCurrency(item.runningBalance)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const paginatedLines = statement ? statement.lines.slice(0, visibleCount) : [];

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
        <Text style={styles.navTitle}>Extrato Bancário</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.monthNavArrow} onPress={handlePrevMonth} activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View style={styles.monthNavCenter}>
          <Text style={styles.monthNavTitle}>
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </Text>
          <Text style={styles.monthNavSubtitle}>Acompanhamento Mensal</Text>
        </View>
        <TouchableOpacity style={styles.monthNavArrow} onPress={handleNextMonth} activeOpacity={0.7}>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <View style={styles.accountsFilterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountChipsScroll}>
          <TouchableOpacity
            style={[
              styles.accountChip,
              !selectedAccountId ? styles.accountChipActive : null,
            ]}
            onPress={() => setSelectedAccountId(undefined)}
            activeOpacity={0.75}>
            <Feather
              name="layers"
              size={13}
              color={!selectedAccountId ? '#FFFFFF' : '#60A5FA'}
            />
            <Text
              style={[
                styles.accountChipText,
                !selectedAccountId ? styles.accountChipTextActive : null,
              ]}>
              Todas as contas
            </Text>
          </TouchableOpacity>

          {accounts.map((acc) => {
            const active = selectedAccountId === acc.id;
            const iconName: keyof typeof Feather.glyphMap =
              acc.type === 'cartao_credito'
                ? 'credit-card'
                : acc.type === 'poupanca'
                  ? 'shield'
                  : 'briefcase';
            const iconColor = active ? '#FFFFFF' : acc.color || '#60A5FA';
            return (
              <TouchableOpacity
                key={acc.id}
                style={[styles.accountChip, active ? styles.accountChipActive : null]}
                onPress={() => setSelectedAccountId(acc.id)}
                activeOpacity={0.75}>
                <Feather name={iconName} size={13} color={iconColor} />
                <Text
                  style={[
                    styles.accountChipText,
                    active ? styles.accountChipTextActive : null,
                  ]}>
                  {acc.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Consolidando extrato...</Text>
        </View>
      ) : (
        <FlatList
          data={paginatedLines}
          keyExtractor={(item) => item.transaction.id}
          renderItem={renderLineItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            statement ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryTopRow}>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Saldo Inicial</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(statement.openingBalance)}
                    </Text>
                  </View>
                  <View style={styles.summaryColRight}>
                    <Text style={styles.summaryLabel}>Saldo Final</Text>
                    <Text
                      style={[
                        styles.summaryValueBold,
                        statement.closingBalance < 0
                          ? styles.expenseText
                          : styles.incomeText,
                      ]}>
                      {formatCurrency(statement.closingBalance)}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryBottomRow}>
                  <View style={styles.summaryFlowItem}>
                    <Feather name="arrow-up-circle" size={14} color="#34D399" />
                    <Text style={styles.summaryFlowText}>
                      Entradas: {formatCurrency(statement.totalIncome)}
                    </Text>
                  </View>
                  <View style={styles.summaryFlowItem}>
                    <Feather name="arrow-down-circle" size={14} color="#F87171" />
                    <Text style={styles.summaryFlowText}>
                      Saídas: {formatCurrency(statement.totalExpense)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="file-text" size={32} color="#475569" />
              <Text style={styles.emptyText}>
                Nenhuma movimentação confirmada neste período.
              </Text>
            </View>
          }
        />
      )}
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
  accountsFilterRow: {
    marginBottom: 12,
  },
  accountChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  accountChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  accountChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  accountChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCol: {
    gap: 4,
  },
  summaryColRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  summaryValueBold: {
    fontSize: 19,
    fontWeight: '800',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  summaryBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryFlowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryFlowText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  lineIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineDateBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  lineDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  lineCenterCol: {
    flex: 1,
  },
  lineDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  lineAccountName: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  lineRightCol: {
    alignItems: 'flex-end',
  },
  lineValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  incomeText: {
    color: '#34D399',
  },
  expenseText: {
    color: '#F87171',
  },
  runningBalanceText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  runningPositive: {
    color: '#94A3B8',
  },
  runningNegative: {
    color: '#FCA5A5',
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
});
