import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  type ListRenderItemInfo,
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

const PAGE_SIZE = 20;

interface EnrichedTransaction {
  id: string;
  description: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  accountName: string;
  date: string;
  dateGroup: string;
  subText: string;
  amount: number;
  type: 'receita' | 'despesa';
}

const formatCurrency = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getDateGroupLabel = (isoDate: string): string => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const itemDateStr = isoDate.split('T')[0];

  if (itemDateStr === todayStr) {
    return 'HOJE';
  }
  if (itemDateStr === yesterdayStr) {
    return 'ONTEM';
  }

  const parts = itemDateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    const monthName = d.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
    return `${day} DE ${monthName}`;
  }

  return itemDateStr;
};

const formatItemSub = (accountName: string, categoryName: string, isoDate: string): string => {
  if (isoDate.includes('T')) {
    try {
      const d = new Date(isoDate);
      const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (timeStr && timeStr !== '00:00') {
        return `${accountName} · ${timeStr}`;
      }
    } catch {
      return `${accountName} · ${categoryName}`;
    }
  }
  return `${accountName} · ${categoryName}`;
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
  return iconMap[iconName] ?? 'credit-card';
};

export function TransactionsListScreen() {
  const [items, setItems] = useState<EnrichedTransaction[]>([]);
  const [categoryMap, setCategoryMap] = useState<Map<string, Category>>(new Map());
  const [accountMap, setAccountMap] = useState<Map<string, Account>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transactionRepo = useMemo(() => new TransactionRepository(), []);
  const categoryRepo = useMemo(() => new CategoryRepository(), []);
  const accountRepo = useMemo(() => new AccountRepository(), []);

  const enrich = useCallback(
    (
      tx: Transaction,
      cats: Map<string, Category>,
      accts: Map<string, Account>
    ): EnrichedTransaction => {
      const cat = cats.get(tx.category_id);
      const acct = accts.get(tx.account_id);
      const accountName = acct?.name ?? 'Conta';
      const categoryName = cat?.name ?? 'Geral';

      return {
        id: tx.id,
        description: tx.description,
        categoryName,
        categoryIcon: cat ? mapCategoryIcon(cat.icon) : 'credit-card',
        categoryColor: cat?.color ?? '#60A5FA',
        accountName,
        date: tx.date,
        dateGroup: getDateGroupLabel(tx.date),
        subText: formatItemSub(accountName, categoryName, tx.date),
        amount: tx.value,
        type: tx.type,
      };
    },
    []
  );

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [cats, accts, result] = await Promise.all([
        categoryRepo.findAll(),
        accountRepo.findAll(),
        transactionRepo.findPaginated(1, PAGE_SIZE),
      ]);

      const catsMap = new Map(cats.map((c) => [c.id, c]));
      const acctsMap = new Map(accts.map((a) => [a.id, a]));

      setCategoryMap(catsMap);
      setAccountMap(acctsMap);
      setTotalPages(result.totalPages);
      setPage(1);
      setItems(result.data.map((tx) => enrich(tx, catsMap, acctsMap)));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar transações.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [categoryRepo, accountRepo, transactionRepo, enrich]);

  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage])
  );

  const loadNextPage = async () => {
    const nextPage = page + 1;
    if (isFetchingMore || nextPage > totalPages) return;

    setIsFetchingMore(true);
    try {
      const result = await transactionRepo.findPaginated(nextPage, PAGE_SIZE);
      setPage(nextPage);
      setItems((prev) => [
        ...prev,
        ...result.data.map((tx) => enrich(tx, categoryMap, accountMap)),
      ]);
    } catch {
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleDelete = (item: EnrichedTransaction) => {
    Alert.alert(
      'Excluir transação',
      `Deseja excluir "${item.description}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await transactionRepo.delete(item.id);
              setItems((prev) => prev.filter((t) => t.id !== item.id));
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : 'Erro ao excluir transação.';
              Alert.alert('Erro', message);
            }
          },
        },
      ]
    );
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.description.toLowerCase().includes(query) ||
        item.accountName.toLowerCase().includes(query) ||
        item.categoryName.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const renderItem = ({ item, index }: ListRenderItemInfo<EnrichedTransaction>) => {
    const isIncome = item.type === 'receita';
    const prevItem = index > 0 ? filteredItems[index - 1] : null;
    const showHeader = !prevItem || prevItem.dateGroup !== item.dateGroup;

    return (
      <View style={styles.itemWrapper}>
        {showHeader ? (
          <Text style={styles.sectionLabel}>{item.dateGroup}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.transactionCard}
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: '/transaction-form',
              params: { id: item.id },
            } as unknown as Parameters<typeof router.push>[0])
          }>
          <View style={styles.itemLeft}>
            <View style={styles.itemIcon}>
              <Feather
                name={item.categoryIcon as keyof typeof Feather.glyphMap}
                size={18}
                color={isIncome ? '#4ADE80' : '#60A5FA'}
              />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemDesc} numberOfLines={1}>
                {item.description}
              </Text>
              <Text style={styles.itemSub} numberOfLines={1}>
                {item.subText}
              </Text>
            </View>
          </View>

          <View style={styles.itemRight}>
            <Text style={[styles.itemVal, isIncome ? styles.valIncome : styles.valExpense]}>
              {isIncome ? '+ ' : '- '}
              {formatCurrency(item.amount)}
            </Text>
            <TouchableOpacity
              style={styles.btnDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => handleDelete(item)}>
              <Feather name="trash-2" size={15} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#60A5FA" />
        <Text style={styles.loadingMoreText}>Carregando mais transações...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={44} color="#64748B" />
        <Text style={styles.emptyTitle}>Nenhuma transação</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? 'Nenhum resultado encontrado para a pesquisa.'
            : 'Toque no "+" na tela principal para registrar uma transação.'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Histórico</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() =>
            router.push('/transaction-form' as unknown as Parameters<typeof router.push>[0])
          }>
          <Feather name="plus" size={18} color="#60A5FA" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar por transação, conta..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={(text: string) => setSearchQuery(text)}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {errorMessage !== null ? (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={14} color="#EF4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={loadFirstPage}>
            <Text style={styles.errorRetry}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando transações...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.3}
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  searchContainer: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    flexGrow: 1,
  },
  itemWrapper: {
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#64748B',
    marginTop: 14,
    marginBottom: 8,
  },
  transactionCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginLeft: 8,
  },
  itemVal: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  valIncome: {
    color: '#4ADE80',
  },
  valExpense: {
    color: '#F87171',
  },
  btnDelete: {
    padding: 2,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    marginHorizontal: 18,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#EF4444',
  },
  errorRetry: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60A5FA',
  },
});
