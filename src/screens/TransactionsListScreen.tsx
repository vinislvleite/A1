import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import {
  Transaction,
  TransactionFilter,
  TransactionSortOptions,
  TransactionSortField,
  SortDirection,
} from '../domain/entities/Transaction';
import { Category } from '../domain/entities/Category';
import { Account } from '../domain/entities/Account';
import { DeleteTransactionModal } from '../components/DeleteTransactionModal';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';

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
  status: 'confirmada' | 'pendente';
  hasNotes: boolean;
  hasAttachment: boolean;
  isRecurring: boolean;
  isExtraIncome: boolean;
  colorLabel?: string;
  tags: string[];
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
}

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
  if (isoDate && isoDate.includes('T')) {
    try {
      const d = new Date(isoDate);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${accountName} · ${categoryName} · ${hours}:${minutes}`;
    } catch {
      return `${accountName} · ${categoryName}`;
    }
  }
  return `${accountName} · ${categoryName}`;
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

const mapCategoryIcon = (iconName: string): keyof typeof Feather.glyphMap => {
  if (iconName === 'shopping') return 'shopping-bag';
  if (VALID_CATEGORY_ICONS.has(iconName)) {
    return iconName as keyof typeof Feather.glyphMap;
  }
  return 'credit-card';
};

export function TransactionsListScreen() {
  usePrivacyMode();
  const [items, setItems] = useState<EnrichedTransaction[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [categoryMap, setCategoryMap] = useState<Map<string, Category>>(new Map());
  const [accountMap, setAccountMap] = useState<Map<string, Account>>(new Map());

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [filterType, setFilterType] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'confirmada' | 'pendente'>('todos');
  const [onlyExtraIncome, setOnlyExtraIncome] = useState(false);
  const [tagFilterInput, setTagFilterInput] = useState<string>('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [minValInput, setMinValInput] = useState('');
  const [maxValInput, setMaxValInput] = useState('');

  const [sortField, setSortField] = useState<TransactionSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');

  const [showFilterModal, setShowFilterModal] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<EnrichedTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const transactionRepo = useMemo(() => new TransactionRepository(), []);
  const categoryRepo = useMemo(() => new CategoryRepository(), []);
  const accountRepo = useMemo(() => new AccountRepository(), []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const parsedTags = useMemo(() => {
    return tagFilterInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean);
  }, [tagFilterInput]);

  const currentTagQuery = useMemo(() => {
    const parts = tagFilterInput.split(',');
    const last = parts[parts.length - 1].trim().replace(/^#/, '').toLowerCase();
    return last;
  }, [tagFilterInput]);

  const tagSuggestions = useMemo(() => {
    if (!currentTagQuery) return [];
    return availableTags
      .filter(
        (t) =>
          t.toLowerCase().includes(currentTagQuery) &&
          !parsedTags.includes(t.toLowerCase())
      )
      .slice(0, 4);
  }, [availableTags, currentTagQuery, parsedTags]);

  const handleAddTagSuggestion = (tag: string) => {
    const parts = tagFilterInput.split(',').map((p) => p.trim());
    parts[parts.length - 1] = `#${tag}`;
    const nextVal = parts.filter(Boolean).join(', ') + ', ';
    setTagFilterInput(nextVal);
  };

  const activeFilters = useMemo((): TransactionFilter => {
    const filter: TransactionFilter = {};
    if (debouncedSearch.trim()) {
      const cleanQ = debouncedSearch.trim().replace(/^#/, '');
      filter.searchTerm = cleanQ;
    }
    if (filterType !== 'todos') {
      filter.type = filterType;
    }
    if (filterStatus !== 'todos') {
      filter.status = filterStatus;
    }
    if (onlyExtraIncome) {
      filter.isExtraIncome = true;
    }
    if (parsedTags.length === 1) {
      filter.tag = parsedTags[0];
    } else if (parsedTags.length > 1) {
      filter.tags = parsedTags;
    }
    if (selectedCategoryIds.length > 0) {
      filter.categoryIds = selectedCategoryIds;
    }
    const minVal = parseCurrencyValue(minValInput);
    if (minVal > 0) {
      filter.minValue = minVal;
    }
    const maxVal = parseCurrencyValue(maxValInput);
    if (maxVal > 0) {
      filter.maxValue = maxVal;
    }
    return filter;
  }, [
    debouncedSearch,
    filterType,
    filterStatus,
    onlyExtraIncome,
    parsedTags,
    selectedCategoryIds,
    minValInput,
    maxValInput,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterType !== 'todos') count++;
    if (filterStatus !== 'todos') count++;
    if (onlyExtraIncome) count++;
    if (parsedTags.length > 0) count += parsedTags.length;
    if (selectedCategoryIds.length > 0) count += selectedCategoryIds.length;
    if (parseCurrencyValue(minValInput) > 0) count++;
    if (parseCurrencyValue(maxValInput) > 0) count++;
    return count;
  }, [
    filterType,
    filterStatus,
    onlyExtraIncome,
    parsedTags,
    selectedCategoryIds,
    minValInput,
    maxValInput,
  ]);

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
        status: tx.status ?? 'confirmada',
        hasNotes: Boolean(tx.notes && tx.notes.trim()),
        hasAttachment: Boolean(tx.attachment_uri),
        isRecurring: Boolean(tx.is_recurring),
        isExtraIncome: Boolean(tx.is_extra_income),
        colorLabel: tx.color_label,
        tags: tx.tags ?? [],
        installmentGroupId: tx.installment_group_id,
        installmentNumber: tx.installment_number,
        installmentTotal: tx.installment_total,
      };
    },
    []
  );

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [cats, accts, tagsList] = await Promise.all([
        categoryRepo.findAll(),
        accountRepo.findAll(),
        transactionRepo.getAllTags(),
      ]);

      const catsMap = new Map(cats.map((c) => [c.id, c]));
      const acctsMap = new Map(accts.map((a) => [a.id, a]));

      setCategoryList(cats);
      setAvailableTags(tagsList);
      setCategoryMap(catsMap);
      setAccountMap(acctsMap);

      const sortOptions: TransactionSortOptions = {
        field: sortField,
        direction: sortDirection,
      };

      const result = await transactionRepo.findPaginated(
        1,
        PAGE_SIZE,
        activeFilters,
        sortOptions
      );

      setTotalPages(result.totalPages);
      setPage(1);
      setItems(result.data.map((tx) => enrich(tx, catsMap, acctsMap)));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar transações.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [categoryRepo, accountRepo, transactionRepo, enrich, activeFilters, sortField, sortDirection]);

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
      const sortOptions: TransactionSortOptions = {
        field: sortField,
        direction: sortDirection,
      };

      const result = await transactionRepo.findPaginated(
        nextPage,
        PAGE_SIZE,
        activeFilters,
        sortOptions
      );

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

  const handleQuickConfirm = async (itemId: string) => {
    try {
      await transactionRepo.confirmTransaction(itemId);
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'confirmada' } : it))
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível confirmar a transação.');
    }
  };

  const handleToggleSort = (field: TransactionSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortField(field);
      setSortDirection('DESC');
    }
  };

  const toggleCategorySelection = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const clearAllFilters = () => {
    setFilterType('todos');
    setFilterStatus('todos');
    setOnlyExtraIncome(false);
    setTagFilterInput('');
    setSelectedCategoryIds([]);
    setMinValInput('');
    setMaxValInput('');
  };

  const handleDelete = (item: EnrichedTransaction) => {
    setTransactionToDelete(item);
  };

  const handleConfirmDelete = async (scope?: 'single' | 'future') => {
    if (!transactionToDelete) return;
    try {
      setIsDeleting(true);
      if (transactionToDelete.installmentGroupId) {
        await transactionRepo.deleteInstallmentGroup(transactionToDelete.id, scope ?? 'single');
        setTransactionToDelete(null);
        await loadFirstPage();
      } else {
        await transactionRepo.delete(transactionToDelete.id);
        setItems((prev) => prev.filter((t) => t.id !== transactionToDelete.id));
        setTransactionToDelete(null);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir transação.';
      Alert.alert('Erro', message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setTransactionToDelete(null);
  };

  const renderItem = ({ item, index }: ListRenderItemInfo<EnrichedTransaction>) => {
    const isIncome = item.type === 'receita';
    const isPending = item.status === 'pendente';
    const prevItem = index > 0 ? items[index - 1] : null;
    const showHeader = !prevItem || prevItem.dateGroup !== item.dateGroup;

    return (
      <View style={styles.itemWrapper}>
        {showHeader && sortField === 'date' ? (
          <Text style={styles.sectionLabel}>{item.dateGroup}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.transactionCard,
            item.colorLabel
              ? { borderLeftWidth: 4, borderLeftColor: item.colorLabel }
              : null,
            isPending ? styles.transactionCardPending : null,
          ]}
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: '/transaction-detail',
              params: { id: item.id },
            } as unknown as Parameters<typeof router.push>[0])
          }>
          <View style={styles.itemLeft}>
            <View
              style={[
                styles.itemIcon,
                { backgroundColor: `${item.categoryColor}22` },
              ]}>
              <Feather
                name={item.categoryIcon as keyof typeof Feather.glyphMap}
                size={18}
                color={item.categoryColor}
              />
            </View>
            <View style={styles.itemInfo}>
              <View style={styles.itemTitleRow}>
                {item.colorLabel ? (
                  <View
                    style={[styles.colorLabelIndicator, { backgroundColor: item.colorLabel }]}
                  />
                ) : null}
                <Text style={styles.itemDesc} numberOfLines={1}>
                  {item.description}
                </Text>
                {item.isRecurring ? (
                  <View style={styles.recurringBadge}>
                    <Text style={styles.recurringBadgeText}>Fixo</Text>
                  </View>
                ) : null}
                {item.installmentNumber && item.installmentTotal ? (
                  <View style={styles.installmentBadge}>
                    <Text style={styles.installmentBadgeText}>
                      {item.installmentNumber}/{item.installmentTotal}
                    </Text>
                  </View>
                ) : null}
                {item.isExtraIncome ? (
                  <View style={styles.extraIncomeBadge}>
                    <Text style={styles.extraIncomeBadgeText}>Extra</Text>
                  </View>
                ) : null}
                {isPending ? (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pendente</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.itemSubRow}>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {item.subText}
                </Text>
                {item.hasAttachment ? (
                  <Feather name="paperclip" size={12} color="#94A3B8" style={styles.subIcon} />
                ) : null}
                {item.hasNotes ? (
                  <Feather name="file-text" size={12} color="#94A3B8" style={styles.subIcon} />
                ) : null}
              </View>

              {item.tags.length > 0 ? (
                <View style={styles.itemTagsRow}>
                  {item.tags.slice(0, 3).map((tag) => (
                    <View key={tag} style={styles.itemTagPill}>
                      <Text style={styles.itemTagPillText}>#{tag}</Text>
                    </View>
                  ))}
                  {item.tags.length > 3 ? (
                    <Text style={styles.itemTagMoreText}>+{item.tags.length - 3}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.itemRight}>
            <Text style={[styles.itemVal, isIncome ? styles.valIncome : styles.valExpense]}>
              {isIncome ? '+ ' : '- '}
              {formatCurrency(item.amount)}
            </Text>

            {isPending ? (
              <TouchableOpacity
                testID={`btn-confirm-tx-${item.id}`}
                style={styles.btnQuickConfirm}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleQuickConfirm(item.id)}>
                <Feather name="check" size={14} color="#10B981" />
              </TouchableOpacity>
            ) : null}

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
        <Text style={styles.emptyTitle}>Nenhuma transação encontrada</Text>
        <Text style={styles.emptySubtitle}>
          {activeFilterCount > 0 || debouncedSearch
            ? 'Nenhum resultado para os filtros e termos selecionados.'
            : 'Toque no "+" na tela principal para registrar uma transação.'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

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

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por descrição, notas ou #tag..."
            placeholderTextColor="#64748B"
            value={searchInput}
            onChangeText={setSearchInput}
            selectionColor="#60A5FA"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchInput ? (
            <TouchableOpacity onPress={() => setSearchInput('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.filterToggleBtn, activeFilterCount > 0 ? styles.filterToggleActive : null]}
          activeOpacity={0.8}
          onPress={() => setShowFilterModal(true)}>
          <Feather
            name="filter"
            size={18}
            color={activeFilterCount > 0 ? '#FFFFFF' : '#94A3B8'}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.sortBar}>
        <TouchableOpacity
          style={[styles.sortChip, sortField === 'date' ? styles.sortChipActive : null]}
          onPress={() => handleToggleSort('date')}
          activeOpacity={0.7}>
          <Text style={[styles.sortChipText, sortField === 'date' ? styles.sortChipTextActive : null]}>
            Data
          </Text>
          {sortField === 'date' ? (
            <Feather
              name={sortDirection === 'DESC' ? 'arrow-down' : 'arrow-up'}
              size={13}
              color="#FFFFFF"
            />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortChip, sortField === 'value' ? styles.sortChipActive : null]}
          onPress={() => handleToggleSort('value')}
          activeOpacity={0.7}>
          <Text style={[styles.sortChipText, sortField === 'value' ? styles.sortChipTextActive : null]}>
            Valor
          </Text>
          {sortField === 'value' ? (
            <Feather
              name={sortDirection === 'DESC' ? 'arrow-down' : 'arrow-up'}
              size={13}
              color="#FFFFFF"
            />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortChip, sortField === 'category' ? styles.sortChipActive : null]}
          onPress={() => handleToggleSort('category')}
          activeOpacity={0.7}>
          <Text style={[styles.sortChipText, sortField === 'category' ? styles.sortChipTextActive : null]}>
            Categoria
          </Text>
          {sortField === 'category' ? (
            <Feather
              name={sortDirection === 'DESC' ? 'arrow-down' : 'arrow-up'}
              size={13}
              color="#FFFFFF"
            />
          ) : null}
        </TouchableOpacity>
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
          <Text style={styles.loadingText}>Buscando transações...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
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

      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filtros Avançados</Text>
              <TouchableOpacity onPress={clearAllFilters}>
                <Text style={styles.clearFiltersText}>Limpar Tudo</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterModalBody}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Tipo de Transação</Text>
                <View style={styles.filterTypeRow}>
                  <TouchableOpacity
                    style={[styles.typeFilterBtn, filterType === 'todos' ? styles.typeFilterActive : null]}
                    onPress={() => setFilterType('todos')}>
                    <Text style={[styles.typeFilterText, filterType === 'todos' ? styles.typeFilterTextActive : null]}>
                      Todas
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeFilterBtn, filterType === 'receita' ? styles.typeFilterActive : null]}
                    onPress={() => setFilterType('receita')}>
                    <Text style={[styles.typeFilterText, filterType === 'receita' ? styles.typeFilterTextActive : null]}>
                      Receitas
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeFilterBtn, filterType === 'despesa' ? styles.typeFilterActive : null]}
                    onPress={() => setFilterType('despesa')}>
                    <Text style={[styles.typeFilterText, filterType === 'despesa' ? styles.typeFilterTextActive : null]}>
                      Despesas
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Status</Text>
                <View style={styles.filterTypeRow}>
                  <TouchableOpacity
                    style={[styles.typeFilterBtn, filterStatus === 'todos' ? styles.typeFilterActive : null]}
                    onPress={() => setFilterStatus('todos')}>
                    <Text style={[styles.typeFilterText, filterStatus === 'todos' ? styles.typeFilterTextActive : null]}>
                      Todos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeFilterBtn, filterStatus === 'confirmada' ? styles.typeFilterActive : null]}
                    onPress={() => setFilterStatus('confirmada')}>
                    <Text style={[styles.typeFilterText, filterStatus === 'confirmada' ? styles.typeFilterTextActive : null]}>
                      Confirmadas
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeFilterBtn, filterStatus === 'pendente' ? styles.typeFilterActive : null]}
                    onPress={() => setFilterStatus('pendente')}>
                    <Text style={[styles.typeFilterText, filterStatus === 'pendente' ? styles.typeFilterTextActive : null]}>
                      Pendentes
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Renda Extra</Text>
                <TouchableOpacity
                  style={[styles.catChipFilter, onlyExtraIncome ? styles.catChipFilterActive : null]}
                  onPress={() => setOnlyExtraIncome((prev) => !prev)}
                  activeOpacity={0.75}>
                  <Feather
                    name="trending-up"
                    size={13}
                    color={onlyExtraIncome ? '#34D399' : '#94A3B8'}
                  />
                  <Text style={[styles.catChipText, onlyExtraIncome ? styles.catChipTextActive : null]}>
                    Apenas Renda Extra (freela, bicos, vendas)
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Tags</Text>
                <View style={styles.tagFilterInputBox}>
                  <Feather name="hash" size={15} color="#60A5FA" />
                  <TextInput
                    style={styles.tagFilterInput}
                    value={tagFilterInput}
                    onChangeText={setTagFilterInput}
                    placeholder="Ex: #alimentação, #lazer"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor="#60A5FA"
                  />
                  {tagFilterInput ? (
                    <TouchableOpacity
                      onPress={() => setTagFilterInput('')}
                      style={styles.tagFilterClearBtn}
                      activeOpacity={0.7}>
                      <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {tagSuggestions.length > 0 ? (
                  <View style={styles.tagSuggestionsRow}>
                    <Text style={styles.tagSuggestionsLabel}>Sugestões:</Text>
                    {tagSuggestions.map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={styles.tagSuggestionChip}
                        onPress={() => handleAddTagSuggestion(st)}
                        activeOpacity={0.75}>
                        <Text style={styles.tagSuggestionChipText}>#{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.filterGroupHelper}>
                    Separe múltiplas tags por vírgula (ex: #alimentação, #lazer)
                  </Text>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Categorias</Text>
                <View style={styles.categoriesChipsWrap}>
                  {categoryList.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.catChipFilter,
                          isSelected ? styles.catChipFilterActive : null,
                        ]}
                        onPress={() => toggleCategorySelection(cat.id)}
                        activeOpacity={0.75}>
                        <View style={[styles.catChipDot, { backgroundColor: cat.color || '#2563EB' }]} />
                        <Text
                          style={[
                            styles.catChipText,
                            isSelected ? styles.catChipTextActive : null,
                          ]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>Faixa de Valor</Text>
                <View style={styles.valueInputsRow}>
                  <View style={styles.valueInputBox}>
                    <Text style={styles.valueInputPrefix}>R$</Text>
                    <TextInput
                      style={styles.valInput}
                      value={minValInput}
                      onChangeText={(t) => setMinValInput(formatCurrencyInput(t))}
                      placeholder="Mínimo"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      selectionColor="#60A5FA"
                    />
                  </View>
                  <Text style={styles.rangeDivider}>até</Text>
                  <View style={styles.valueInputBox}>
                    <Text style={styles.valueInputPrefix}>R$</Text>
                    <TextInput
                      style={styles.valInput}
                      value={maxValInput}
                      onChangeText={(t) => setMaxValInput(formatCurrencyInput(t))}
                      placeholder="Máximo"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      selectionColor="#60A5FA"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.btnApplyFilters}
                onPress={() => {
                  setShowFilterModal(false);
                  loadFirstPage();
                }}
                activeOpacity={0.85}>
                <Text style={styles.btnApplyFiltersText}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <DeleteTransactionModal
        visible={transactionToDelete !== null}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        transaction={
          transactionToDelete
            ? {
                id: transactionToDelete.id,
                description: transactionToDelete.description,
                value: transactionToDelete.amount,
                type: transactionToDelete.type,
                accountName: transactionToDelete.accountName,
                categoryName: transactionToDelete.categoryName,
                date: transactionToDelete.date,
                installment_group_id: transactionToDelete.installmentGroupId,
                installment_number: transactionToDelete.installmentNumber,
                installment_total: transactionToDelete.installmentTotal,
              }
            : null
        }
      />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
  },
  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterToggleActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sortChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  sortChipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#EF4444',
  },
  errorRetry: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  itemWrapper: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  transactionCardPending: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  colorLabelIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recurringBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recurringBadgeText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  installmentBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  installmentBadgeText: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '700',
  },
  extraIncomeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  extraIncomeBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pendingBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  itemSub: {
    fontSize: 12,
    color: '#94A3B8',
    flexShrink: 1,
  },
  subIcon: {
    marginLeft: 6,
  },
  itemTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  itemTagPill: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  itemTagPillText: {
    fontSize: 10,
    color: '#93C5FD',
    fontWeight: '600',
  },
  itemTagMoreText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  valIncome: {
    color: '#4ADE80',
  },
  valExpense: {
    color: '#EF4444',
  },
  btnQuickConfirm: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDelete: {
    padding: 4,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
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
    maxWidth: 260,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  filterModalCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '85%',
    padding: 20,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearFiltersText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  filterModalBody: {
    gap: 18,
    paddingBottom: 20,
  },
  filterGroup: {
    gap: 8,
  },
  filterGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterTypeRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  typeFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeFilterActive: {
    backgroundColor: '#2563EB',
  },
  typeFilterText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  typeFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  categoriesChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChipFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  catChipFilterActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  catChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catChipText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tagFilterInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  tagFilterInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  tagFilterClearBtn: {
    padding: 4,
  },
  filterGroupHelper: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  tagSuggestionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tagSuggestionsLabel: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 2,
  },
  tagSuggestionChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagSuggestionChipText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
  valueInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valueInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    height: 42,
    gap: 6,
  },
  valueInputPrefix: {
    fontSize: 13,
    color: '#60A5FA',
    fontWeight: '600',
  },
  valInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  rangeDivider: {
    fontSize: 12,
    color: '#64748B',
  },
  filterModalFooter: {
    marginTop: 10,
  },
  btnApplyFilters: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnApplyFiltersText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
