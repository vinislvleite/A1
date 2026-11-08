import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ManageBillsUseCase } from '../domain/usecases/ManageBillsUseCase';
import { BillWithStatus, BillUrgencyStatus } from '../domain/entities/RecurringBill';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { Category } from '../domain/entities/Category';
import { Account } from '../domain/entities/Account';
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

const formatCurrency = (val: number): string => formatMoneyValue(val);

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
  if (!iconName) return 'file-text';
  if (iconName === 'shopping') return 'shopping-bag';
  if (VALID_CATEGORY_ICONS.has(iconName)) {
    return iconName as keyof typeof Feather.glyphMap;
  }
  return 'file-text';
};

export function BillsScreen() {
  usePrivacyMode();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [bills, setBills] = useState<BillWithStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBill, setEditingBill] = useState<BillWithStatus | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('10');
  const [reminderDaysInput, setReminderDaysInput] = useState('3');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [notesInput, setNotesInput] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const amountInputRef = useRef<TextInput>(null);

  const [payModalBill, setPayModalBill] = useState<BillWithStatus | null>(null);
  const [payCreateExpense, setPayCreateExpense] = useState(true);
  const [payAccountId, setPayAccountId] = useState<string>('');

  const manageBillsUseCase = new ManageBillsUseCase();
  const categoryRepo = new CategoryRepository();
  const accountRepo = new AccountRepository();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [billsList, cats, accs] = await Promise.all([
        manageBillsUseCase.listBillsForMonth(selectedMonth, selectedYear),
        categoryRepo.findAll(),
        accountRepo.findAll(),
      ]);
      setBills(billsList);
      setCategories(cats);
      setAccounts(accs);
      if (cats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(cats[0].id);
      }
      if (accs.length > 0 && !payAccountId) {
        setPayAccountId(accs[0].id);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategoryId);
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const openCreateModal = () => {
    setEditingBill(null);
    setNameInput('');
    setValueInput('');
    setDueDayInput('10');
    setReminderDaysInput('3');
    setSelectedCategoryId(categories[0]?.id ?? '');
    setCategorySearchQuery('');
    setSelectedAccountId(accounts[0]?.id);
    setNotesInput('');
    setCategorySearchQuery('');
    setShowFormModal(true);
  };

  const openEditModal = (bill: BillWithStatus) => {
    setEditingBill(bill);
    setNameInput(bill.name);
    setValueInput(formatValueFromNumber(bill.value));
    setDueDayInput(String(bill.due_day));
    setReminderDaysInput(String(bill.reminder_days_before));
    setSelectedCategoryId(bill.category_id);
    setSelectedAccountId(bill.account_id);
    setNotesInput(bill.notes ?? '');
    setShowFormModal(true);
  };

  const handleSaveBill = async () => {
    const parsedVal = parseFloat(valueInput.replace(/\./g, '').replace(',', '.')) || 0;
    const parsedDue = parseInt(dueDayInput, 10);
    const parsedReminder = parseInt(reminderDaysInput, 10);

    if (!nameInput.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome da conta fixa.');
      return;
    }
    if (Number.isNaN(parsedVal) || parsedVal <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    if (Number.isNaN(parsedDue) || parsedDue < 1 || parsedDue > 31) {
      Alert.alert('Dia inválido', 'O dia de vencimento deve estar entre 1 e 31.');
      return;
    }
    if (Number.isNaN(parsedReminder) || parsedReminder < 0 || parsedReminder > 30) {
      Alert.alert('Antecedência inválida', 'Informe entre 0 e 30 dias de antecedência.');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Categoria obrigatória', 'Selecione uma categoria.');
      return;
    }

    try {
      if (editingBill) {
        await manageBillsUseCase.updateBill({
          id: editingBill.id,
          name: nameInput.trim(),
          value: parsedVal,
          due_day: parsedDue,
          reminder_days_before: parsedReminder,
          category_id: selectedCategoryId,
          account_id: selectedAccountId,
          notes: notesInput.trim() || undefined,
          is_active: true,
          created_at: editingBill.created_at,
        });
      } else {
        const isCurrentMonth =
          selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

        const billDate = isCurrentMonth
          ? new Date()
          : new Date(selectedYear, selectedMonth - 1, Math.min(parsedDue, 28), 12, 0, 0);

        await manageBillsUseCase.createBill(
          {
            name: nameInput.trim(),
            value: parsedVal,
            due_day: parsedDue,
            reminder_days_before: parsedReminder,
            category_id: selectedCategoryId,
            account_id: selectedAccountId,
            notes: notesInput.trim() || undefined,
            created_at: billDate.toISOString(),
          },
          billDate
        );
      }
      setShowFormModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar conta fixa.';
      Alert.alert('Erro', msg);
    }
  };

  const handleDeleteBill = (bill: BillWithStatus) => {
    Alert.alert(
      'Excluir Conta Fixa',
      `Deseja remover "${bill.name}" da lista de contas a pagar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await manageBillsUseCase.deleteBill(bill.id);
            await loadData();
          },
        },
      ]
    );
  };

  const openMarkPaidModal = (bill: BillWithStatus) => {
    setPayModalBill(bill);
    setPayCreateExpense(true);
    setPayAccountId(bill.account_id ?? accounts[0]?.id ?? '');
  };

  const handleConfirmPay = async () => {
    if (!payModalBill) return;
    try {
      await manageBillsUseCase.markAsPaid({
        billId: payModalBill.id,
        month: selectedMonth,
        year: selectedYear,
        createExpenseTransaction: payCreateExpense,
        accountId: payAccountId || undefined,
      });
      setPayModalBill(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar o pagamento.';
      Alert.alert('Atenção', msg);
    }
  };

  const handleUnmarkPaid = async (bill: BillWithStatus) => {
    try {
      await manageBillsUseCase.unmarkAsPaid(bill.id, selectedMonth, selectedYear);
      await loadData();
    } catch {
      Alert.alert('Erro', 'Não foi possível reabrir a conta.');
    }
  };

  const getBadgeProps = (
    status: BillUrgencyStatus,
    daysUntilDue: number
  ): { label: string; color: string; bg: string } => {
    if (status === 'paga') {
      return { label: 'Paga', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
    }
    if (status === 'vencida') {
      const overdueDays = Math.abs(daysUntilDue);
      return {
        label: overdueDays === 1 ? 'Vencida há 1 dia' : `Vencida há ${overdueDays} dias`,
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.15)',
      };
    }
    if (status === 'vence_em_breve') {
      const dueStr =
        daysUntilDue === 0
          ? 'Vence hoje'
          : daysUntilDue === 1
            ? 'Vence amanhã'
            : `Vence em ${daysUntilDue} dias`;
      return { label: dueStr, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
    }
    return {
      label: `Em dia (${daysUntilDue} dias)`,
      color: '#60A5FA',
      bg: 'rgba(96, 165, 250, 0.15)',
    };
  };

  const totalMonth = bills.reduce((acc, b) => acc + b.value, 0);
  const totalPaid = bills
    .filter((b) => b.isPaidInCurrentMonth)
    .reduce((acc, b) => acc + b.value, 0);
  const totalPending = Math.max(0, totalMonth - totalPaid);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contas a Pagar</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Feather name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.monthNavArrow}
              onPress={handlePrevMonth}
              activeOpacity={0.7}>
              <Feather name="chevron-left" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <View style={styles.monthNavCenter}>
              <Text style={styles.monthNavTitle}>
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
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
              <Text style={styles.kpiLabel}>Total Previsto</Text>
              <Text style={styles.kpiValue}>{formatCurrency(totalMonth)}</Text>
              <Text style={styles.kpiSub}>{bills.length} contas no mês</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Pendente</Text>
              <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
                {formatCurrency(totalPending)}
              </Text>
              <Text style={styles.kpiSub}>a pagar</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Pago</Text>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                {formatCurrency(totalPaid)}
              </Text>
              <Text style={styles.kpiSub}>concluídas</Text>
            </View>
          </View>

          <View style={styles.infoNote}>
            <Feather name="bell" size={15} color="#60A5FA" />
            <Text style={styles.infoNoteText}>
              Contas fixas enviam lembretes antes do vencimento e cancelam o alerta do mês assim que marcadas como pagas.
            </Text>
          </View>

          {bills.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="calendar" size={36} color="#475569" />
              <Text style={styles.emptyTitle}>Nenhuma conta fixa cadastrada</Text>
              <Text style={styles.emptySub}>
                Cadastre aluguel, internet, luz ou outras obrigações mensais para receber lembretes antes do vencimento.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreateModal}>
                <Feather name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.emptyBtnText}>Nova Conta Fixa</Text>
              </TouchableOpacity>
            </View>
          ) : (
            bills.map((bill) => {
              const badge = getBadgeProps(bill.status, bill.daysUntilDue);
              const cat = categories.find((c) => c.id === bill.category_id);
              const catColor = cat?.color ?? '#60A5FA';
              const catIcon = cat ? (cat.icon as keyof typeof Feather.glyphMap) : 'file-text';

              return (
                <View key={bill.id} style={styles.billCard}>
                  <View style={styles.billTopRow}>
                    <View style={[styles.billIconBox, { backgroundColor: `${catColor}22` }]}>
                      <Feather name={catIcon} size={18} color={catColor} />
                    </View>
                    <View style={styles.billTitleCol}>
                      <Text style={styles.billName}>{bill.name}</Text>
                      <Text style={styles.billMeta}>
                        Vence dia {String(bill.due_day).padStart(2, '0')} • Lembrete {bill.reminder_days_before}d antes • {bill.categoryName ?? 'Geral'}
                      </Text>
                    </View>
                    <Text style={styles.billAmount}>{formatCurrency(bill.value)}</Text>
                  </View>

                  <View style={styles.billBottomRow}>
                    <View style={[styles.urgencyBadge, { backgroundColor: badge.bg }]}>
                      <View style={[styles.urgencyDot, { backgroundColor: badge.color }]} />
                      <Text style={[styles.urgencyText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>

                    <View style={styles.billActions}>
                      {bill.isPaidInCurrentMonth ? (
                        <TouchableOpacity
                          style={styles.reopenBtn}
                          onPress={() => handleUnmarkPaid(bill)}>
                          <Feather name="rotate-ccw" size={14} color="#94A3B8" />
                          <Text style={styles.reopenBtnText}>Reabrir</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => openMarkPaidModal(bill)}>
                          <Feather name="check" size={14} color="#FFFFFF" />
                          <Text style={styles.payBtnText}>Pagar</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => openEditModal(bill)}>
                        <Feather name="edit-2" size={15} color="#94A3B8" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleDeleteBill(bill)}>
                        <Feather name="trash-2" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal
        visible={showFormModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFormModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIcon}>
                  <Feather name="repeat" size={18} color="#60A5FA" />
                </View>
                <Text style={styles.modalTitle}>
                  {editingBill ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowFormModal(false)}>
                <Feather name="x" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nome da Conta</Text>
              <View style={styles.inputBox}>
                <Feather name="file-text" size={16} color="#60A5FA" />
                <TextInput
                  style={styles.inputText}
                  placeholder="Ex: Aluguel, Internet, Energia"
                  placeholderTextColor="#64748B"
                  value={nameInput}
                  onChangeText={setNameInput}
                  selectionColor="#60A5FA"
                />
              </View>

              <Text style={styles.inputLabel}>Valor</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => amountInputRef.current?.focus()}
                style={styles.amountBox}>
                <Text style={styles.currencyPrefix}>R$</Text>
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountInput}
                  placeholder="0,00"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={valueInput}
                  onChangeText={(text) => setValueInput(formatCurrencyInput(text))}
                  selectionColor="#60A5FA"
                />
              </TouchableOpacity>

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Dia de Vencimento (1-31)</Text>
                  <View style={styles.inputBox}>
                    <Feather name="calendar" size={16} color="#60A5FA" />
                    <TextInput
                      style={styles.inputText}
                      keyboardType="numeric"
                      value={dueDayInput}
                      onChangeText={setDueDayInput}
                      placeholder="10"
                      placeholderTextColor="#64748B"
                      selectionColor="#60A5FA"
                    />
                  </View>
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Lembrar (dias antes)</Text>
                  <View style={styles.inputBox}>
                    <Feather name="bell" size={16} color="#60A5FA" />
                    <TextInput
                      style={styles.inputText}
                      keyboardType="numeric"
                      value={reminderDaysInput}
                      onChangeText={setReminderDaysInput}
                      placeholder="3"
                      placeholderTextColor="#64748B"
                      selectionColor="#60A5FA"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>Categoria</Text>
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

              {accounts.length > 0 ? (
                <>
                  <Text style={styles.inputLabel}>Conta Padrão para Débito (opcional)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}>
                    {accounts.map((acc) => {
                      const active = acc.id === selectedAccountId;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSelectedAccountId(acc.id)}
                          activeOpacity={0.75}>
                          <Feather
                            name="credit-card"
                            size={14}
                            color={active ? '#FFFFFF' : '#64748B'}
                          />
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {acc.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              <Text style={styles.inputLabel}>Observações (opcional)</Text>
              <View style={styles.inputBox}>
                <Feather name="message-square" size={16} color="#60A5FA" />
                <TextInput
                  style={styles.inputText}
                  placeholder="Ex: Débito automático ou PIX"
                  placeholderTextColor="#64748B"
                  value={notesInput}
                  onChangeText={setNotesInput}
                  selectionColor="#60A5FA"
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBill} activeOpacity={0.85}>
                <Feather name="check" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>
                  {editingBill ? 'Salvar Alterações' : 'Salvar Conta Fixa'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(payModalBill)}
        transparent
        animationType="fade"
        onRequestClose={() => setPayModalBill(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar Pagamento</Text>
            {payModalBill ? (
              <Text style={styles.paySubtitle}>
                Marcar "{payModalBill.name}" ({formatCurrency(payModalBill.value)}) como paga em {MONTH_NAMES[selectedMonth - 1]}/{selectedYear}?
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setPayCreateExpense((v) => !v)}>
              <View style={[styles.checkbox, payCreateExpense && styles.checkboxChecked]}>
                {payCreateExpense ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.checkboxLabel}>
                Criar despesa correspondente nas minhas transações
              </Text>
            </TouchableOpacity>

            {payCreateExpense && accounts.length > 0 ? (
              <>
                <Text style={styles.inputLabel}>Debitar da conta:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}>
                  {accounts.map((acc) => {
                    const active = acc.id === payAccountId;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setPayAccountId(acc.id)}
                        activeOpacity={0.75}>
                        <Feather
                          name="credit-card"
                          size={14}
                          color={active ? '#FFFFFF' : '#64748B'}
                        />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <View style={styles.payActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPayModalBill(null)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPayBtn}
                onPress={handleConfirmPay}>
                <Text style={styles.confirmPayBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
              style={{ maxHeight: 280 }}
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  monthArrow: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
    minWidth: 140,
    textAlign: 'center',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 14,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
    borderRadius: 12,
    padding: 12,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#BFDBFE',
    lineHeight: 17,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 28,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  billCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    gap: 12,
  },
  billTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  billIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billTitleCol: {
    flex: 1,
  },
  billName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  billMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  billAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  billBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  billActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reopenBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 18,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 10,
    marginBottom: 6,
  },
  inputBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: '700',
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
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  chipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  paySubtitle: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 19,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#E2E8F0',
  },
  payActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 13,
  },
  confirmPayBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmPayBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
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
    marginBottom: 12,
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
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
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
