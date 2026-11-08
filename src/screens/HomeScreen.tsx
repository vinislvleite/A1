import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  AppState,
  Modal,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { AuthService } from '../services/AuthService';
import { CalculateBalanceUseCase } from '../domain/usecases/CalculateBalanceUseCase';
import { CalculateBudgetProgressUseCase } from '../domain/usecases/CalculateBudgetProgressUseCase';
import { GenerateRecurringTransactionsUseCase } from '../domain/usecases/GenerateRecurringTransactionsUseCase';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { LogoutModal } from '../components/LogoutModal';
import { LogService } from '../services/LogService';
import { MoneyText, formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode, PrivacyManager } from '../context/PrivacyContext';
import { BackupService } from '../services/BackupService';

interface TransactionItem {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  status: 'confirmada' | 'pendente';
  isExtraIncome: boolean;
  colorLabel?: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

interface DailyBalance {
  balance: number;
  income: number;
  expense: number;
  monthlyFixedIncome: number;
  monthlyExtraIncome: number;
}

interface MonthlyBudget {
  spent: number;
  total: number;
}

interface UserProfile {
  name: string;
  email?: string;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
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

export function HomeScreen() {
  const { isPrivacyEnabled, togglePrivacyMode } = usePrivacyMode();
  const formatCurrency = (value: number): string => formatMoneyValue(value, isPrivacyEnabled);

  const [user, setUser] = useState<UserProfile>({
    name: 'Vinicius',
    email: '',
  });
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [dailyBalance, setDailyBalance] = useState<DailyBalance>({
    balance: 0.0,
    income: 0.0,
    expense: 0.0,
    monthlyFixedIncome: 0.0,
    monthlyExtraIncome: 0.0,
  });

  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudget>({
    spent: 0.0,
    total: 0.0,
  });

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'list' | 'analytics' | 'settings'>('home');

  const authService = new AuthService();
  const balanceUseCase = new CalculateBalanceUseCase();
  const budgetProgressUseCase = new CalculateBudgetProgressUseCase();
  const generateRecurringUseCase = new GenerateRecurringTransactionsUseCase();
  const transactionRepository = new TransactionRepository();
  const categoryRepository = new CategoryRepository();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
      setShowLogoutModal(false);
      router.replace('/login' as unknown as Parameters<typeof router.replace>[0]);
    } catch {
      setIsLoggingOut(false);
    }
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        router.replace('/login' as unknown as Parameters<typeof router.replace>[0]);
        return;
      }

      setUser({ name: currentUser.name, email: currentUser.email });

      await PrivacyManager.loadPersistedPrivacyMode();
      await new BackupService().runDailyAutoBackupIfNeeded();
      await generateRecurringUseCase.execute();

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const balanceSummary = await balanceUseCase.execute();

      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      const todayTotals = await transactionRepository.getTotalsByPeriod(startOfDay, endOfDay);

      const startOfMonth = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0).toISOString();
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999).toISOString();
      const monthTotals = await transactionRepository.getTotalsByPeriod(startOfMonth, endOfMonth);

      setDailyBalance({
        balance: balanceSummary.totalBalance,
        income: todayTotals.totalIncome,
        expense: todayTotals.totalExpense,
        monthlyFixedIncome: monthTotals.fixedIncome,
        monthlyExtraIncome: monthTotals.extraIncome,
      });

      const budgetSummary = await budgetProgressUseCase.execute(currentMonth, currentYear);
      setMonthlyBudget({
        spent: budgetSummary.totalSpent,
        total: budgetSummary.totalBudgeted,
      });

      const categories = await categoryRepository.findAll();
      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      const paginatedTransactions = await transactionRepository.findPaginated(1, 3);
      const mappedTransactions: TransactionItem[] = paginatedTransactions.data.map((tx) => {
        const cat = categoryMap.get(tx.category_id);
        const txDate = new Date(tx.date);
        const isToday = txDate.toDateString() === now.toDateString();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const isYesterday = txDate.toDateString() === yesterday.toDateString();
        const timeStr = txDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const day = String(txDate.getDate()).padStart(2, '0');
        const month = String(txDate.getMonth() + 1).padStart(2, '0');
        const dateLabel = isToday
          ? `Hoje, ${timeStr}`
          : isYesterday
          ? `Ontem, ${timeStr}`
          : `${day}/${month}, ${timeStr}`;

        return {
          id: tx.id,
          description: tx.description,
          category: cat ? cat.name : 'Geral',
          date: dateLabel,
          amount: tx.value,
          type: tx.type === 'receita' ? 'income' : 'expense',
          status: tx.status ?? 'confirmada',
          isExtraIncome: Boolean(tx.is_extra_income),
          colorLabel: tx.color_label,
          icon: cat ? mapCategoryIcon(cat.icon) : 'credit-card',
          color: cat?.color || '#60A5FA',
        };
      });

      setTransactions(mappedTransactions);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadDashboardData();
        LogService.getInstance().purgeOldLogs(15);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadDashboardData]);

  useFocusEffect(
    useCallback(() => {
      setActiveTab('home');
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const budgetPercentage = monthlyBudget.total > 0
    ? Math.min(Math.round((monthlyBudget.spent / monthlyBudget.total) * 100), 100)
    : 0;

  const renderTransactionItem = ({ item }: ListRenderItemInfo<TransactionItem>) => {
    const isIncome = item.type === 'income';

    return (
      <TouchableOpacity
        style={[
          styles.transactionCard,
          item.colorLabel ? { borderLeftWidth: 4, borderLeftColor: item.colorLabel } : null,
        ]}
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: '/transaction-detail',
            params: { id: item.id },
          } as unknown as Parameters<typeof router.push>[0])
        }>
        <View
          style={[
            styles.transactionIconContainer,
            { backgroundColor: `${item.color}22` },
          ]}>
          <Feather name={item.icon} size={18} color={item.color} />
        </View>

        <View style={styles.transactionDetails}>
          <View style={styles.txDescRow}>
            <Text style={styles.transactionDescription} numberOfLines={1}>
              {item.description}
            </Text>
            {item.status === 'pendente' ? (
              <View style={styles.txPendingBadge}>
                <Text style={styles.txPendingBadgeText}>Pendente</Text>
              </View>
            ) : null}
            {item.isExtraIncome ? (
              <View style={styles.txExtraBadge}>
                <Text style={styles.txExtraBadgeText}>Extra</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.transactionDate}>{item.date}</Text>
        </View>

        <MoneyText
          value={item.amount}
          prefix={isIncome ? '+ ' : '- '}
          style={[
            styles.transactionAmount,
            isIncome ? styles.incomeText : styles.expenseText,
          ]}
        />
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContentContainer}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.greetingText}>Olá,</Text>
          <Text style={styles.userNameText}>{user.name}</Text>
        </View>

        <View style={styles.topHeaderRightActions}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.privacyToggleBtn}
            onPress={togglePrivacyMode}>
            <Feather
              name={isPrivacyEnabled ? 'eye-off' : 'eye'}
              size={19}
              color="#E2E8F0"
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.avatarWrapper}
            onPress={() => setShowUserMenu(true)}>
            <LinearGradient
              colors={['#60A5FA', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}>
              <Feather name="user" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push('/accounts' as unknown as Parameters<typeof router.push>[0])}>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}>
          <View style={styles.balanceCardTopRow}>
            <Text style={styles.balanceLabel}>Saldo de hoje</Text>
            <View style={styles.viewAccountsChip}>
              <Text style={styles.viewAccountsText}>Minhas Contas</Text>
              <Feather name="chevron-right" size={13} color="#BFDBFE" />
            </View>
          </View>
          <MoneyText value={dailyBalance.balance} style={styles.balanceValue} />

          <View style={styles.balanceStatsRow}>
            <View style={styles.balanceStatItem}>
              <View style={styles.statIconBadgeIncome}>
                <Feather name="arrow-up-right" size={14} color="#10B981" />
              </View>
              <View>
                <Text style={styles.statLabel}>Receitas</Text>
                <MoneyText
                  value={dailyBalance.income}
                  prefix="+"
                  style={styles.statValueIncome}
                />
              </View>
            </View>

            <View style={styles.balanceDivider} />

            <View style={styles.balanceStatItem}>
              <View style={styles.statIconBadgeExpense}>
                <Feather name="arrow-down-left" size={14} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.statLabel}>Despesas</Text>
                <MoneyText
                  value={dailyBalance.expense}
                  prefix="-"
                  style={styles.statValueExpense}
                />
              </View>
            </View>
          </View>

          <View style={styles.incomeBreakdownRow}>
            <View style={styles.incomeBreakdownPill}>
              <Text style={styles.incomeBreakdownLabel}>Receita Fixa (mês):</Text>
              <MoneyText
                value={dailyBalance.monthlyFixedIncome}
                style={styles.incomeBreakdownVal}
              />
            </View>
            <View style={styles.incomeBreakdownPill}>
              <Text style={styles.incomeBreakdownLabel}>Renda Extra (mês):</Text>
              <MoneyText
                value={dailyBalance.monthlyExtraIncome}
                style={styles.incomeBreakdownValExtra}
              />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.budgetCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Orçamento do mês</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/budgets' as unknown as Parameters<typeof router.push>[0])}>
            <Text style={styles.cardActionLink}>Ver tudo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.budgetMetricsRow}>
          <Text style={styles.budgetSpentText}>
            {formatCurrency(monthlyBudget.spent)}{' '}
            <Text style={styles.budgetTotalText}>
              gastos de {formatCurrency(monthlyBudget.total)}
            </Text>
          </Text>
          <Text style={styles.budgetPercentageText}>{budgetPercentage}%</Text>
        </View>

        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#60A5FA', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${budgetPercentage}%` }]}
          />
        </View>

        <View style={styles.budgetReminderRow}>
          <Feather
            name={monthlyBudget.spent > monthlyBudget.total && monthlyBudget.total > 0 ? 'alert-circle' : 'info'}
            size={13}
            color={monthlyBudget.spent > monthlyBudget.total && monthlyBudget.total > 0 ? '#F87171' : '#60A5FA'}
          />
          <Text
            style={[
              styles.budgetReminderText,
              monthlyBudget.spent > monthlyBudget.total && monthlyBudget.total > 0
                ? styles.budgetReminderTextWarning
                : null,
            ]}>
            {monthlyBudget.total === 0
              ? 'Nenhum limite definido para este mês'
              : monthlyBudget.spent >= monthlyBudget.total
              ? `Limite mensal atingido (${formatCurrency(monthlyBudget.spent - monthlyBudget.total)} acima)`
              : `Restante para o mês: ${formatCurrency(monthlyBudget.total - monthlyBudget.spent)}`}
          </Text>
        </View>
      </View>

      <View style={styles.quickShortcutsRow}>
        <TouchableOpacity
          style={styles.quickShortcutBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/bills' as unknown as Parameters<typeof router.push>[0])}>
          <Feather name="calendar" size={16} color="#F59E0B" />
          <Text style={styles.quickShortcutText}>Contas Fixas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickShortcutBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/statement' as unknown as Parameters<typeof router.push>[0])}>
          <Feather name="file-text" size={16} color="#60A5FA" />
          <Text style={styles.quickShortcutText}>Extrato</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickShortcutBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/spending-goals' as unknown as Parameters<typeof router.push>[0])}>
          <Feather name="target" size={16} color="#10B981" />
          <Text style={styles.quickShortcutText}>Metas</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Transações recentes</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/transactions-list' as unknown as Parameters<typeof router.push>[0])}>
          <Text style={styles.cardActionLink}>Ver todas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <View style={styles.emptyTransactionsContainer}>
            <Feather name="inbox" size={36} color="#475569" />
            <Text style={styles.emptyTransactionsTitle}>Nenhuma transação recente</Text>
            <Text style={styles.emptyTransactionsSubtitle}>
              Toque no botão + abaixo para registrar seu primeiro gasto ou receita.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#60A5FA"
            colors={['#2563EB', '#60A5FA']}
          />
        }
      />

      <View style={styles.bottomBarContainer}>
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => setActiveTab('home')}>
            <Feather
              name="home"
              size={22}
              color={activeTab === 'home' ? '#60A5FA' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('list');
              router.push('/transactions-list' as unknown as Parameters<typeof router.push>[0]);
            }}>
            <Feather
              name="list"
              size={22}
              color={activeTab === 'list' ? '#60A5FA' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabWrapper}
            activeOpacity={0.85}
            onPress={() => router.push('/transaction-form' as unknown as Parameters<typeof router.push>[0])}>
            <LinearGradient
              colors={['#60A5FA', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabButton}>
              <Feather name="plus" size={26} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('analytics');
              router.push('/budgets' as unknown as Parameters<typeof router.push>[0]);
            }}>
            <Feather
              name="pie-chart"
              size={22}
              color={activeTab === 'analytics' ? '#60A5FA' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('settings');
              router.push('/account' as unknown as Parameters<typeof router.push>[0]);
            }}>
            <Feather
              name="settings"
              size={22}
              color={activeTab === 'settings' ? '#60A5FA' : '#94A3B8'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showUserMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUserMenu(false)}>
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowUserMenu(false)}>
          <View style={styles.menuCard}>
            <View style={styles.menuUserHeader}>
              <LinearGradient
                colors={['#60A5FA', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.menuAvatarGradient}>
                <Feather name="user" size={18} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.menuUserInfo}>
                <Text style={styles.menuUserName} numberOfLines={1}>
                  {user.name}
                </Text>
                {user.email ? (
                  <Text style={styles.menuUserEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setShowUserMenu(false);
                router.push('/account' as unknown as Parameters<typeof router.push>[0]);
              }}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIconChip}>
                  <Feather name="user" size={16} color="#60A5FA" />
                </View>
                <Text style={styles.menuItemText}>Minha Conta</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setShowUserMenu(false);
                handleLogout();
              }}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIconChipLogout}>
                  <Feather name="log-out" size={16} color="#EF4444" />
                </View>
                <Text style={styles.menuItemTextLogout}>Deslogar</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        isLoading={isLoggingOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  headerContentContainer: {
    paddingTop: 12,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  greetingText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 2,
  },
  avatarWrapper: {
    borderRadius: 20,
  },
  topHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  privacyToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  balanceCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAccountsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  viewAccountsText: {
    fontSize: 11,
    color: '#E0E7FF',
    fontWeight: '500',
  },
  balanceLabel: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 6,
    marginBottom: 18,
  },
  balanceStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(28, 23, 48, 0.45)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  balanceStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  balanceDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#475569',
    marginHorizontal: 12,
  },
  statIconBadgeIncome: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(143, 217, 168, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBadgeExpense: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(240, 153, 155, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#E2E8F0',
  },
  statValueIncome: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 1,
  },
  statValueExpense: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 1,
  },
  incomeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  incomeBreakdownPill: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  incomeBreakdownLabel: {
    fontSize: 10,
    color: '#BFDBFE',
  },
  incomeBreakdownVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  incomeBreakdownValExtra: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
    marginTop: 2,
  },
  budgetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#475569',
    padding: 18,
    marginBottom: 24,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardActionLink: {
    fontSize: 13,
    fontWeight: '500',
    color: '#60A5FA',
  },
  budgetMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  budgetSpentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  budgetTotalText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#CBD5E1',
  },
  budgetPercentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60A5FA',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  budgetReminderText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  budgetReminderTextWarning: {
    color: '#F87171',
    fontWeight: '600',
  },
  quickShortcutsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickShortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 11,
  },
  quickShortcutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transactionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },
  transactionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  txDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transactionDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  txPendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  txPendingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FBBF24',
  },
  txExtraBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  txExtraBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34D399',
  },
  transactionDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  incomeText: {
    color: '#10B981',
  },
  expenseText: {
    color: '#EF4444',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bottomBar: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#475569',
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  fabWrapper: {
    top: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0F172A',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 72,
    paddingRight: 20,
  },
  menuCard: {
    width: 250,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  menuUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  menuAvatarGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuUserInfo: {
    flex: 1,
  },
  menuUserName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  menuUserEmail: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconChip: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuIconChipLogout: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuItemText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  menuItemTextLogout: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyTransactionsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyTransactionsTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  emptyTransactionsSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
