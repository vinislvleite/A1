import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FinanceButton, FinanceInput } from '@/components/finance-login';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { Category } from '../domain/entities/Category';
import { Account } from '../domain/entities/Account';
import { TransactionType } from '../domain/entities/Transaction';

export interface TransactionFormScreenProps {
  id?: string;
  onSuccess?: () => void;
}

export function TransactionFormScreen({ id, onSuccess }: TransactionFormScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';

  const [type, setType] = useState<TransactionType>('despesa');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  const [errors, setErrors] = useState<{
    value?: string;
    description?: string;
    categoryId?: string;
    accountId?: string;
    general?: string;
  }>({});

  const transactionRepo = new TransactionRepository();
  const categoryRepo = new CategoryRepository();
  const accountRepo = new AccountRepository();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsFetchingData(true);
        const [loadedCategories, loadedAccounts] = await Promise.all([
          categoryRepo.findAll(),
          accountRepo.findAll(),
        ]);
        setCategories(loadedCategories);
        setAccounts(loadedAccounts);

        if (loadedCategories.length > 0 && !categoryId) {
          setCategoryId(loadedCategories[0].id);
        }
        if (loadedAccounts.length > 0 && !accountId) {
          setAccountId(loadedAccounts[0].id);
        }

        if (id) {
          const existing = await transactionRepo.findById(id);
          if (existing) {
            setType(existing.type);
            setValue(String(existing.value));
            setDescription(existing.description);
            setDate(existing.date.split('T')[0]);
            setCategoryId(existing.category_id);
            setAccountId(existing.account_id);
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar dados.';
        setErrors((prev) => ({ ...prev, general: message }));
      } finally {
        setIsFetchingData(false);
      }
    };

    loadInitialData();
  }, [id]);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    const parsedValue = parseFloat(value.replace(',', '.'));

    if (!value.trim() || isNaN(parsedValue) || parsedValue <= 0) {
      newErrors.value = 'Informe um valor maior que zero';
    }

    if (!description.trim()) {
      newErrors.description = 'Informe a descrição da transação';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Selecione uma categoria';
    }

    if (!accountId) {
      newErrors.accountId = 'Selecione uma conta';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const parsedValue = parseFloat(value.replace(',', '.'));

      const formattedDate = date.includes('T')
        ? date
        : new Date(date + 'T12:00:00').toISOString();

      if (id) {
        await transactionRepo.update(id, {
          account_id: accountId,
          category_id: categoryId,
          value: parsedValue,
          type,
          description: description.trim(),
          date: formattedDate,
        });
      } else {
        await transactionRepo.create({
          account_id: accountId,
          category_id: categoryId,
          value: parsedValue,
          type,
          description: description.trim(),
          date: formattedDate,
          is_recurring: false,
          status: 'confirmada',
        });
      }


      setIsLoading(false);

      if (onSuccess) {
        onSuccess();
      } else {
        router.back();
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Falha ao salvar transação.';
      setErrors({ general: message });
    }
  };

  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const selectedAccount = accounts.find((acc) => acc.id === accountId);

  const formatDateDisplay = (isoDate: string): string => {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  const adjustDateDays = (days: number) => {
    const current = new Date(date + 'T12:00:00');
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().split('T')[0]);
  };

  const bgColor = '#0F172A';
  const cardBg = '#1E293B';
  const borderColor = '#334155';
  const textColor = '#F8FAFC';
  const mutedTextColor = '#94A3B8';

  if (isFetchingData) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={[styles.loadingText, { color: mutedTextColor }]}>Carregando formulário...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        
        {/* Top Navigation Header */}
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.btnBack}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>
            {id ? 'Editar Transação' : 'Nova Transação'}
          </Text>
          <View style={styles.emptySpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Segmented Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                type === 'despesa' ? styles.toggleExpenseActive : styles.toggleInactive,
              ]}
              onPress={() => {
                setType('despesa');
                setErrors((prev) => ({ ...prev, value: undefined }));
              }}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.toggleBtnText,
                  type === 'despesa' ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}>
                Despesa
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                type === 'receita' ? styles.toggleIncomeActive : styles.toggleInactive,
              ]}
              onPress={() => {
                setType('receita');
                setErrors((prev) => ({ ...prev, value: undefined }));
              }}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.toggleBtnText,
                  type === 'receita' ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}>
                Receita
              </Text>
            </TouchableOpacity>
          </View>

          {errors.general ? (
            <View style={styles.generalErrorBanner}>
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          ) : null}

          <View style={styles.formContainer}>
            {/* Amount Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Valor</Text>
              <View style={[styles.amountBox, errors.value ? styles.boxError : null]}>
                <Text
                  style={[
                    styles.currencyPrefix,
                    { color: type === 'despesa' ? '#F87171' : '#10B981' },
                  ]}>
                  R$
                </Text>
                <TextInput
                  style={styles.amountInput}
                  value={value}
                  onChangeText={(text: string) => {
                    setValue(text);
                    if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
                  }}
                  placeholder="0,00"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                />
              </View>
              {errors.value ? <Text style={styles.fieldErrorText}>{errors.value}</Text> : null}
            </View>

            {/* Description Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Descrição</Text>
              <View style={[styles.inputBox, errors.description ? styles.boxError : null]}>
                <Feather name="edit-3" size={18} color="#60A5FA" />
                <TextInput
                  style={styles.textInput}
                  value={description}
                  onChangeText={(text: string) => {
                    setDescription(text);
                    if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  placeholder="Ex: Mercado semanal"
                  placeholderTextColor="#64748B"
                />
              </View>
              {errors.description ? (
                <Text style={styles.fieldErrorText}>{errors.description}</Text>
              ) : null}
            </View>

            {/* Row: Date & Account */}
            <View style={styles.formRow}>
              {/* Date */}
              <View style={styles.fieldGroupFlex}>
                <Text style={styles.fieldLabel}>Data</Text>
                <TouchableOpacity
                  style={styles.inputBox}
                  onPress={() => setShowDateModal(true)}
                  activeOpacity={0.7}>
                  <Feather name="calendar" size={16} color="#60A5FA" />
                  <Text style={styles.inputTextValue}>{formatDateDisplay(date)}</Text>
                </TouchableOpacity>
              </View>

              {/* Account */}
              <View style={styles.fieldGroupFlex}>
                <Text style={styles.fieldLabel}>Conta</Text>
                <TouchableOpacity
                  style={[styles.inputBox, styles.inputBoxBetween, errors.accountId ? styles.boxError : null]}
                  onPress={() => setShowAccountModal(true)}
                  activeOpacity={0.7}>
                  <View style={styles.inputBoxLeft}>
                    <Feather name="credit-card" size={16} color="#60A5FA" />
                    <Text style={styles.inputTextValue} numberOfLines={1}>
                      {selectedAccount?.name ?? 'Selecione'}
                    </Text>
                  </View>
                  <Feather name="chevron-down" size={16} color="#94A3B8" />
                </TouchableOpacity>
                {errors.accountId ? (
                  <Text style={styles.fieldErrorText}>{errors.accountId}</Text>
                ) : null}
              </View>
            </View>

            {/* Category Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Categoria</Text>
              <TouchableOpacity
                style={[styles.categoryCard, errors.categoryId ? styles.boxError : null]}
                onPress={() => setShowCategoryModal(true)}
                activeOpacity={0.7}>
                <View style={styles.catInfo}>
                  <View style={styles.catIconChip}>
                    <Feather
                      name={(selectedCategory?.icon as keyof typeof Feather.glyphMap) ?? 'tag'}
                      size={18}
                      color={selectedCategory?.color ?? '#FBBF24'}
                    />
                  </View>
                  <Text style={styles.catName}>
                    {selectedCategory?.name ?? 'Selecione uma categoria'}
                  </Text>
                </View>
                <Feather name="chevron-down" size={16} color="#94A3B8" />
              </TouchableOpacity>
              {errors.categoryId ? (
                <Text style={styles.fieldErrorText}>{errors.categoryId}</Text>
              ) : null}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsFooter}>
            <TouchableOpacity
              style={styles.btnSave}
              onPress={handleSave}
              disabled={isLoading}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnSaveText}>
                  {id ? 'Salvar Alterações' : 'Salvar Transação'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnCancel}
              onPress={() => router.back()}
              activeOpacity={0.7}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        <Modal
          visible={showCategoryModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCategoryModal(false)}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCategoryModal(false)}>
            <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Selecione a Categoria</Text>
              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalOptionRow,
                      item.id === categoryId && { backgroundColor: '#334155' },
                    ]}
                    onPress={() => {
                      setCategoryId(item.id);
                      if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: undefined }));
                      setShowCategoryModal(false);
                    }}>
                    <View style={styles.modalOptionContent}>
                      <View style={[styles.categoryBullet, { backgroundColor: item.color || '#2563EB' }]} />
                      <Text style={[styles.modalOptionText, { color: textColor }]}>{item.name}</Text>
                    </View>
                    {item.id === categoryId ? (
                      <Feather name="check" size={18} color="#2563EB" />
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showAccountModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAccountModal(false)}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAccountModal(false)}>
            <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Selecione a Conta</Text>
              <FlatList
                data={accounts}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalOptionRow,
                      item.id === accountId && { backgroundColor: '#334155' },
                    ]}
                    onPress={() => {
                      setAccountId(item.id);
                      if (errors.accountId) setErrors((prev) => ({ ...prev, accountId: undefined }));
                      setShowAccountModal(false);
                    }}>
                    <View style={styles.modalOptionContent}>
                      <Feather name="credit-card" size={18} color="#2563EB" style={styles.accountIcon} />
                      <View>
                        <Text style={[styles.modalOptionText, { color: textColor }]}>{item.name}</Text>
                        <Text style={[styles.accountTypeSubtitle, { color: mutedTextColor }]}>
                          {item.type.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                    {item.id === accountId ? (
                      <Feather name="check" size={18} color="#2563EB" />
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showDateModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDateModal(false)}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowDateModal(false)}>
            <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Selecione a Data</Text>
              <View style={styles.dateSelectorControls}>
                <TouchableOpacity
                  style={[styles.dateQuickButton, { backgroundColor: '#334155' }]}
                  onPress={() => adjustDateDays(-1)}>
                  <Feather name="chevron-left" size={16} color={textColor} />
                  <Text style={[styles.dateQuickButtonText, { color: textColor }]}>-1 dia</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateQuickButton, { backgroundColor: '#2563EB' }]}
                  onPress={() => setDate(new Date().toISOString().split('T')[0])}>
                  <Text style={[styles.dateQuickButtonText, { color: '#FFFFFF' }]}>Hoje</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateQuickButton, { backgroundColor: '#334155' }]}
                  onPress={() => adjustDateDays(1)}>
                  <Text style={[styles.dateQuickButtonText, { color: textColor }]}>+1 dia</Text>
                  <Feather name="chevron-right" size={16} color={textColor} />
                </TouchableOpacity>
              </View>

              <View style={[styles.dateDisplayCard, { backgroundColor: '#0F172A' }]}>
                <Text style={[styles.dateDisplayLabel, { color: mutedTextColor }]}>Data Selecionada</Text>
                <Text style={[styles.dateDisplayValue, { color: textColor }]}>
                  {formatDateDisplay(date)}
                </Text>
              </View>

              <FinanceButton
                title="Confirmar Data"
                variant="primary"
                onPress={() => setShowDateModal(false)}
              />
            </View>
          </TouchableOpacity>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  btnBack: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySpacer: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 16,
  },
  typeToggle: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleExpenseActive: {
    backgroundColor: '#F87171',
    shadowColor: '#F87171',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  toggleIncomeActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  toggleInactive: {
    backgroundColor: 'transparent',
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  toggleTextInactive: {
    color: '#94A3B8',
  },
  generalErrorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  generalErrorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formContainer: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldGroupFlex: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  amountBox: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
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
  },
  amountInput: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 120,
    padding: 0,
  },
  inputBox: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputBoxBetween: {
    justifyContent: 'space-between',
  },
  inputBoxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    padding: 0,
  },
  inputTextValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catIconChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  boxError: {
    borderColor: '#EF4444',
  },
  fieldErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  actionsFooter: {
    marginTop: 10,
    gap: 8,
  },
  btnSave: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnCancel: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryBullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  accountIcon: {
    marginRight: 4,
  },
  accountTypeSubtitle: {
    fontSize: 12,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  dateSelectorControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  dateQuickButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dateQuickButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateDisplayCard: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  dateDisplayLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateDisplayValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

