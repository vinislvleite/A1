import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Share,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { FinanceButton } from '@/components/finance-login';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { dialog } from '../components/dialogs';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { BudgetRepository } from '../data/repositories/BudgetRepository';
import { NotificationService } from '../services/NotificationService';
import { suggestCategoryFromData } from '../services/CategorySuggestionService';
import {
  CreateInstallmentsUseCase,
  calculateInstallmentSplits,
} from '../domain/usecases/CreateInstallmentsUseCase';
import { CheckSpendingLimitsUseCase } from '../domain/usecases/CheckSpendingLimitsUseCase';
import { Category } from '../domain/entities/Category';
import { Account } from '../domain/entities/Account';
import { BudgetEvent } from '../domain/entities/Budget';
import {
  Transaction,
  TransactionType,
  TRANSACTION_COLOR_PALETTE,
} from '../domain/entities/Transaction';
import { SuccessCheckIcon } from '../components/SuccessCheckIcon';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  formatDate,
  formatDateTime,
  fromIsoDate,
  toIsoDate,
  parseBrDate,
  formatCurrencyBRL as formatCurrencyBRLUtil,
} from '../utils/date';

export interface TransactionFormScreenProps {
  id?: string;
  onSuccess?: () => void;
}

interface SavedTransactionSummary {
  description: string;
  value: number;
  type: TransactionType;
  categoryName: string;
  accountName: string;
  date: string;
  attachmentUri?: string;
  installmentSummary?: string;
}

const getLocalDateString = (d: Date = new Date()): string => toIsoDate(d);

const getLocalTimeString = (d: Date = new Date()): string => {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatTimeInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const formatBrazilianDateTime = (isoDate: string): string => formatDateTime(isoDate);

const formatCurrencyBRL = (val: number): string => formatCurrencyBRLUtil(val);

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

export function TransactionFormScreen({ id, onSuccess }: TransactionFormScreenProps) {
  const [type, setType] = useState<TransactionType>('despesa');
  const [value, setValue] = useState('');
  const amountInputRef = useRef<TextInput>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => getLocalDateString());
  const [time, setTime] = useState(() => getLocalTimeString());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [savedSummary, setSavedSummary] = useState<SavedTransactionSummary | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const [notes, setNotes] = useState('');
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);

  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentValueMode, setInstallmentValueMode] = useState<'total' | 'parcel'>('total');
  const [existingInstallmentGroupId, setExistingInstallmentGroupId] = useState<string | undefined>(undefined);
  const [existingInstallmentNumber, setExistingInstallmentNumber] = useState<number | undefined>(undefined);
  const [existingInstallmentTotal, setExistingInstallmentTotal] = useState<number | undefined>(undefined);
  const [editInstallmentScope, setEditInstallmentScope] = useState<'single' | 'future'>('single');

  const [isExtraIncome, setIsExtraIncome] = useState(false);
  const [incomeSource, setIncomeSource] = useState('');
  const [colorLabel, setColorLabel] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<BudgetEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPending, setIsPending] = useState(false);

  const [manualCategorySelected, setManualCategorySelected] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<Category | null>(null);
  const [limitWarningData, setLimitWarningData] = useState<{ parsedValue: number; maxLimit: number } | null>(null);

  const [errors, setErrors] = useState<{
    value?: string;
    description?: string;
    categoryId?: string;
    accountId?: string;
    time?: string;
    general?: string;
  }>({});

  const transactionRepo = new TransactionRepository();
  const categoryRepo = new CategoryRepository();
  const accountRepo = new AccountRepository();
  const budgetRepo = new BudgetRepository();
  const notificationService = new NotificationService();
  const createInstallmentsUseCase = new CreateInstallmentsUseCase(transactionRepo);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsFetchingData(true);
        const [loadedCategories, loadedAccounts, recentPage, loadedTags, loadedEvents] = await Promise.all([
          categoryRepo.findAll(),
          accountRepo.findAll(),
          transactionRepo.findPaginated(1, 150),
          transactionRepo.getAllTags(),
          budgetRepo.findAllEvents(),
        ]);
        setCategories(loadedCategories);
        setAccounts(loadedAccounts);
        setRecentTransactions(recentPage.data);
        setAvailableTags(loadedTags);
        setEvents(loadedEvents);

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
            setValue(
              existing.value.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            );
            setDescription(existing.description);
            setDate(toIsoDate(fromIsoDate(existing.date)));
            try {
              const d = new Date(existing.date);
              if (!isNaN(d.getTime())) {
                setTime(
                  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                );
              }
            } catch {
            }
            setCategoryId(existing.category_id);
            setManualCategorySelected(true);
            setAccountId(existing.account_id);
            if (existing.notes) setNotes(existing.notes);
            if (existing.attachment_uri) setAttachmentUri(existing.attachment_uri);
            setIsRecurring(Boolean(existing.is_recurring));
            if (existing.installment_group_id) {
              setExistingInstallmentGroupId(existing.installment_group_id);
              setExistingInstallmentNumber(existing.installment_number);
              setExistingInstallmentTotal(existing.installment_total);
            }
            setIsExtraIncome(Boolean(existing.is_extra_income));
            if (existing.income_source) setIncomeSource(existing.income_source);
            setColorLabel(existing.color_label);
            setSelectedEventId(existing.event_id);
            setTags(existing.tags ?? []);
            setIsPending(existing.status === 'pendente');
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = description.trim();
      if (trimmed.length < 2) {
        setSuggestedCategory(null);
        return;
      }
      const suggestion = suggestCategoryFromData(trimmed, categories, recentTransactions);
      setSuggestedCategory(suggestion);
      if (suggestion && !manualCategorySelected && !id) {
        setCategoryId(suggestion.id);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [description, categories, recentTransactions, manualCategorySelected, id]);

  const loadAccountsList = useCallback(async () => {
    try {
      const loaded = await accountRepo.findAll();
      setAccounts(loaded);
      if (loaded.length > 0 && !accountId) {
        setAccountId(loaded[0].id);
      }
    } catch {
      return;
    }
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      loadAccountsList();
    }, [loadAccountsList])
  );

  const handleAddTag = (rawTag?: string) => {
    const candidate = (rawTag ?? tagInput).trim();
    if (!candidate) return;
    const exists = tags.some((t) => t.toLowerCase() === candidate.toLowerCase());
    if (!exists) {
      setTags((prev) => [...prev, candidate]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (targetTag: string) => {
    setTags((prev) => prev.filter((t) => t !== targetTag));
  };

  const matchingTagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return availableTags
      .filter(
        (t) =>
          t.toLowerCase().includes(q) &&
          !tags.some((selected) => selected.toLowerCase() === t.toLowerCase())
      )
      .slice(0, 6);
  }, [tagInput, availableTags, tags]);

  const installmentPreview = useMemo(() => {
    if (!isInstallment || type !== 'despesa') return null;
    const parsed = parseCurrencyValue(value);
    if (parsed <= 0 || installmentCount < 2) return null;
    const totalVal =
      installmentValueMode === 'total'
        ? parsed
        : Number((parsed * installmentCount).toFixed(2));
    try {
      const splits = calculateInstallmentSplits(totalVal, installmentCount, `${date}T12:00:00.000Z`);
      const firstVal = splits[0]?.value ?? 0;
      const lastVal = splits[splits.length - 1]?.value ?? 0;
      return {
        totalVal,
        firstVal,
        lastVal,
        hasRemainder: firstVal !== lastVal,
      };
    } catch {
      return null;
    }
  }, [isInstallment, type, value, installmentCount, installmentValueMode, date]);

  const handlePickFromGallery = async () => {
    setShowImageModal(false);
    try {
      const granted = await dialog.solicitarPermissao({
        titulo: 'Acesso à Galeria de Fotos',
        mensagem:
          'O Orçamento Fácil precisa de permissão para acessar a galeria para que você possa anexar comprovantes de pagamento.',
        motivo: 'A foto do comprovante é armazenada apenas no seu celular.',
        icone: 'image',
        rotuloConfirmar: 'Permitir Acesso',
        aoPermitir: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          return permission.granted;
        },
      });
      if (!granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch {
      dialog.alerta({
        titulo: 'Erro',
        mensagem: 'Não foi possível selecionar a imagem.',
        tipo: 'erro',
      });
    }
  };

  const handleTakePhoto = async () => {
    setShowImageModal(false);
    try {
      const granted = await dialog.solicitarPermissao({
        titulo: 'Acesso à Câmera',
        mensagem:
          'O Orçamento Fácil precisa de permissão para usar a câmera para fotografar comprovantes ou cupons fiscais.',
        motivo: 'A fotografia fica salva localmente junto ao registro da despesa.',
        icone: 'camera',
        rotuloConfirmar: 'Abrir Câmera',
        aoPermitir: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          return permission.granted;
        },
      });
      if (!granted) return;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch {
      dialog.alerta({
        titulo: 'Erro',
        mensagem: 'Não foi possível capturar a foto.',
        tipo: 'erro',
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    const parsedValue = parseCurrencyValue(value);

    if (!value.trim() || parsedValue <= 0) {
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

    if (time.trim()) {
      const [hStr, mStr] = time.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        newErrors.time = 'Hora inválida (00:00 - 23:59)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const executeSave = async (bypassLimitWarning: boolean = false) => {
    if (!validate()) return;

    const parsedValue = parseCurrencyValue(value);

    if (type === 'despesa' && !bypassLimitWarning) {
      try {
        const limitsUseCase = new CheckSpendingLimitsUseCase(budgetRepo, transactionRepo, notificationService);
        const txCheck = await limitsUseCase.checkTransactionLimit(parsedValue);
        if (txCheck.exceeded && txCheck.maxLimit) {
          setLimitWarningData({ parsedValue, maxLimit: txCheck.maxLimit });
          return;
        }
      } catch {
      }
    }

    setIsLoading(true);
    setErrors({});

    try {

      const now = new Date();
      let hour = now.getHours();
      let minute = now.getMinutes();
      if (time.trim().includes(':')) {
        const [hStr, mStr] = time.split(':');
        const parsedH = parseInt(hStr, 10);
        const parsedM = parseInt(mStr, 10);
        if (!isNaN(parsedH) && parsedH >= 0 && parsedH <= 23) hour = parsedH;
        if (!isNaN(parsedM) && parsedM >= 0 && parsedM <= 59) minute = parsedM;
      }

      const localBase = fromIsoDate(date);
      const localDate = new Date(
        localBase.getFullYear(),
        localBase.getMonth(),
        localBase.getDate(),
        hour,
        minute,
        0
      );
      const formattedDate = localDate.toISOString();
      const targetStatus = isPending ? 'pendente' : 'confirmada';

      const finalTags = tagInput.trim()
        ? Array.from(new Set([...tags, tagInput.trim()]))
        : tags;

      let summaryValue = parsedValue;
      let installmentSummaryText: string | undefined;

      if (id) {
        const updatePayload = {
          account_id: accountId,
          category_id: categoryId,
          value: parsedValue,
          type,
          description: description.trim(),
          date: formattedDate,
          is_recurring: isRecurring,
          recurrence_day: isRecurring ? fromIsoDate(date).getDate() : undefined,
          is_extra_income: type === 'receita' ? isExtraIncome : false,
          income_source: type === 'receita' && isExtraIncome ? incomeSource.trim() || undefined : undefined,
          color_label: colorLabel,
          event_id: type === 'despesa' ? selectedEventId : undefined,
          tags: finalTags,
          notes: notes.trim() || undefined,
          attachment_uri: attachmentUri || undefined,
          status: targetStatus as 'confirmada' | 'pendente',
        };

        if (existingInstallmentGroupId) {
          await transactionRepo.updateInstallmentGroup(id, editInstallmentScope, updatePayload);
        } else {
          await transactionRepo.update(id, updatePayload);
        }
      } else if (type === 'despesa' && isInstallment) {
        const totalInstallmentAmount =
          installmentValueMode === 'total'
            ? parsedValue
            : Number((parsedValue * installmentCount).toFixed(2));

        const result = await createInstallmentsUseCase.execute({
          account_id: accountId,
          category_id: categoryId,
          totalValue: totalInstallmentAmount,
          installmentCount,
          description: description.trim(),
          startDate: formattedDate,
          type: 'despesa',
          color_label: colorLabel,
          tags: finalTags,
          notes: notes.trim() || undefined,
          attachment_uri: attachmentUri || undefined,
          status: targetStatus,
        });

        summaryValue = totalInstallmentAmount;
        const firstInstallment = result.installments[0];
        installmentSummaryText = `${installmentCount}x de ${formatCurrencyBRL(firstInstallment ? firstInstallment.value : parsedValue)}`;
      } else {
        await transactionRepo.create({
          account_id: accountId,
          category_id: categoryId,
          value: parsedValue,
          type,
          description: description.trim(),
          date: formattedDate,
          is_recurring: isRecurring,
          recurrence_day: isRecurring ? fromIsoDate(date).getDate() : undefined,
          is_extra_income: type === 'receita' ? isExtraIncome : false,
          income_source: type === 'receita' && isExtraIncome ? incomeSource.trim() || undefined : undefined,
          color_label: colorLabel,
          event_id: type === 'despesa' ? selectedEventId : undefined,
          tags: finalTags,
          notes: notes.trim() || undefined,
          attachment_uri: attachmentUri || undefined,
          status: targetStatus,
        });
      }

      if (type === 'despesa' && targetStatus === 'confirmada') {
        try {
          const txDate = new Date(formattedDate);
          const txMonth = txDate.getMonth() + 1;
          const txYear = txDate.getFullYear();

          const limitsUseCase = new CheckSpendingLimitsUseCase(
            budgetRepo,
            transactionRepo,
            notificationService
          );
          await limitsUseCase.checkDailyLimitAfterExpense(formattedDate);

          const budget = !selectedEventId
            ? await budgetRepo.findByCategoryAndPeriod(categoryId, txMonth, txYear, 'mensal')
            : null;
          if (budget && budget.limit_value > 0) {
            const startMonthStr = String(txMonth).padStart(2, '0');
            const startDate = `${txYear}-${startMonthStr}-01T00:00:00.000Z`;
            const lastDay = new Date(txYear, txMonth, 0).getDate();
            const lastDayStr = String(lastDay).padStart(2, '0');
            const endDate = `${txYear}-${startMonthStr}-${lastDayStr}T23:59:59.999Z`;

            const expenses = await transactionRepo.findAll({
              type: 'despesa',
              status: 'confirmada',
              categoryId,
              startDate,
              endDate,
            });

            const totalSpent = expenses.reduce((sum, e) => sum + e.value, 0);
            const cat = categories.find((c) => c.id === categoryId);

            await notificationService.checkAndNotifyBudgetThreshold({
              categoryId,
              categoryName: cat?.name ?? 'Categoria',
              totalSpent,
              limitValue: budget.limit_value,
              month: txMonth,
              year: txYear,
            });
          }
        } catch {
        }
      }

      setIsLoading(false);

      const cat = categories.find((c) => c.id === categoryId);
      const acc = accounts.find((a) => a.id === accountId);

      setSavedSummary({
        description: description.trim(),
        value: summaryValue,
        type,
        categoryName: cat ? cat.name : 'Geral',
        accountName: acc ? acc.name : 'Conta',
        date: formattedDate,
        attachmentUri: attachmentUri || undefined,
        installmentSummary: installmentSummaryText,
      });
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Falha ao salvar transação.';
      setErrors({ general: message });
    }
  };

  const handleSave = () => {
    executeSave(false);
  };

  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const selectedAccount = accounts.find((acc) => acc.id === accountId);

  const formatDateDisplay = (isoDate: string): string => formatDate(isoDate);

  const adjustDateDays = (days: number) => {
    const current = fromIsoDate(date);
    current.setDate(current.getDate() + days);
    setDate(toIsoDate(current));
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

  if (savedSummary) {
    const isIncome = savedSummary.type === 'receita';
    const formattedVal = `${isIncome ? '+' : '-'} ${formatCurrencyBRL(savedSummary.value)}`;

    const handleShare = async () => {
      try {
        if (savedSummary.attachmentUri) {
          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            const rawUri = savedSummary.attachmentUri;
            const shareUri = rawUri.startsWith('file://') || rawUri.startsWith('content://')
              ? rawUri
              : `file://${rawUri}`;
            const lower = shareUri.toLowerCase();
            const mimeType = lower.endsWith('.png')
              ? 'image/png'
              : lower.endsWith('.webp')
              ? 'image/webp'
              : lower.endsWith('.pdf')
              ? 'application/pdf'
              : 'image/jpeg';
            await Sharing.shareAsync(shareUri, {
              mimeType,
              dialogTitle: 'Compartilhar comprovante',
            });
            return;
          }
        }

        const message = [
          'Comprovante de Transação - Orçamento Fácil',
          `Descrição: ${savedSummary.description}`,
          `Valor: ${formattedVal}`,
          `Categoria: ${savedSummary.categoryName}`,
          `Data: ${formatBrazilianDateTime(savedSummary.date)}`,
        ].join('\n');

        await Share.share({ message });
      } catch {
        return;
      }
    };

    const handleFinish = () => {
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace('/home' as unknown as Parameters<typeof router.replace>[0]);
      }
    };

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
        <View style={styles.confirmedContainer}>
          <View style={styles.confirmedCard}>
            <View style={styles.confirmedIconWrapper}>
              <SuccessCheckIcon size={76} />
            </View>

            <Text style={styles.confirmedTitle}>
              {id ? 'Transação atualizada com sucesso!' : 'Transação registrada com sucesso!'}
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Descrição</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {savedSummary.description}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Valor</Text>
                <Text
                  style={[
                    styles.summaryValueAmount,
                    isIncome ? styles.summaryAmountIncome : styles.summaryAmountExpense,
                  ]}>
                  {formattedVal}
                </Text>
              </View>

              {savedSummary.installmentSummary ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Parcelamento</Text>
                  <Text style={styles.summaryValue}>{savedSummary.installmentSummary}</Text>
                </View>
              ) : null}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Categoria</Text>
                <Text style={styles.summaryValue}>
                  {savedSummary.categoryName}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Data</Text>
                <Text style={styles.summaryValue}>
                  {formatBrazilianDateTime(savedSummary.date)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnShare}
              onPress={handleShare}
              activeOpacity={0.8}>
              <Feather name="share-2" size={18} color="#FFFFFF" style={styles.btnShareIcon} />
              <Text style={styles.btnShareText}>Compartilhar comprovante</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnFinish}
              onPress={handleFinish}
              activeOpacity={0.85}>
              <Text style={styles.btnFinishText}>Voltar ao Início</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        
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

          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                type === 'despesa' ? styles.toggleExpenseActive : styles.toggleInactive,
              ]}
              onPress={() => {
                setType('despesa');
                setIsExtraIncome(false);
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
                setIsInstallment(false);
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
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {type === 'despesa' && isInstallment && installmentValueMode === 'parcel'
                  ? 'Valor de cada parcela'
                  : 'Valor'}
              </Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => amountInputRef.current?.focus()}
                style={[styles.amountBox, errors.value ? styles.boxError : null]}>
                <Text
                  style={[
                    styles.currencyPrefix,
                    { color: type === 'despesa' ? '#F87171' : '#10B981' },
                  ]}>
                  R$
                </Text>
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountInput}
                  value={value}
                  onChangeText={(text: string) => {
                    const formatted = formatCurrencyInput(text);
                    setValue(formatted);
                    if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
                  }}
                  placeholder="0,00"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  selectionColor="#60A5FA"
                />
              </TouchableOpacity>
              {errors.value ? <Text style={styles.fieldErrorText}>{errors.value}</Text> : null}
            </View>

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
                  placeholder="Ex: Mercado semanal, Uber, Freela..."
                  placeholderTextColor="#64748B"
                  selectionColor="#60A5FA"
                  maxLength={100}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                />
              </View>
              {errors.description ? (
                <Text style={styles.fieldErrorText}>{errors.description}</Text>
              ) : null}

              {suggestedCategory ? (
                <TouchableOpacity
                  testID="category-suggestion-chip"
                  style={[
                    styles.suggestionChip,
                    suggestedCategory.id === categoryId ? styles.suggestionChipActive : null,
                  ]}
                  onPress={() => {
                    setCategoryId(suggestedCategory.id);
                    setManualCategorySelected(true);
                  }}
                  activeOpacity={0.75}>
                  <Feather name="zap" size={13} color="#60A5FA" />
                  <Text style={styles.suggestionChipText}>
                    Categoria sugerida: <Text style={styles.suggestionChipHighlight}>{suggestedCategory.name}</Text>
                  </Text>
                  {suggestedCategory.id === categoryId ? (
                    <Feather name="check" size={13} color="#10B981" />
                  ) : (
                    <Text style={styles.suggestionChipApply}>Aplicar</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.formRow}>
              <View style={styles.fieldGroupFlex}>
                <Text style={styles.fieldLabel}>Data</Text>
                <TouchableOpacity
                  style={styles.inputBox}
                  onPress={async () => {
                    const chosen = await dialog.datePicker({
                      titulo: 'Data da Transação',
                      dataInicial: date,
                    });
                    if (chosen) {
                      const parsed = parseBrDate(chosen);
                      if (parsed.valid && parsed.isoDate) {
                        setDate(parsed.isoDate);
                      }
                    }
                  }}
                  activeOpacity={0.7}>
                  <Feather name="calendar" size={16} color="#60A5FA" />
                  <Text style={styles.inputTextValue}>{formatDateDisplay(date)}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroupFlex}>
                <Text style={styles.fieldLabel}>Hora</Text>
                <TouchableOpacity
                  style={[styles.inputBox, errors.time ? styles.boxError : null]}
                  onPress={async () => {
                    const chosen = await dialog.timePicker({
                      titulo: 'Horário da Transação',
                      horaInicial: time,
                    });
                    if (chosen) {
                      setTime(chosen);
                      if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                    }
                  }}
                  activeOpacity={0.7}>
                  <Feather name="clock" size={16} color="#60A5FA" />
                  <Text style={styles.inputTextValue}>{time || '00:00'}</Text>
                </TouchableOpacity>
                {errors.time ? (
                  <Text style={styles.fieldErrorText}>{errors.time}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Conta</Text>
              <TouchableOpacity
                style={[styles.categoryCard, errors.accountId ? styles.boxError : null]}
                onPress={() => setShowAccountModal(true)}
                activeOpacity={0.7}>
                <View style={styles.catInfo}>
                  <View style={styles.catIconChip}>
                    <Feather name="credit-card" size={18} color="#60A5FA" />
                  </View>
                  <Text style={styles.catName}>
                    {selectedAccount?.name ?? 'Selecione uma conta'}
                  </Text>
                </View>
                <Feather name="chevron-down" size={16} color="#94A3B8" />
              </TouchableOpacity>
              {errors.accountId ? (
                <Text style={styles.fieldErrorText}>{errors.accountId}</Text>
              ) : null}
            </View>

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
              {errors.categoryId ? (
                <Text style={styles.fieldErrorText}>{errors.categoryId}</Text>
              ) : null}
            </View>

            {type === 'receita' ? (
              <View style={styles.fieldGroup}>
                <View style={styles.switchRowContainer}>
                  <View style={styles.switchLabelContainer}>
                    <View style={styles.switchIconBox}>
                      <Feather name="trending-up" size={16} color="#10B981" />
                    </View>
                    <View style={styles.switchTextCol}>
                      <Text style={styles.switchTitle}>Renda extra</Text>
                      <Text style={styles.switchSubtitle}>
                        Freela, comissão, venda ou ganho esporádico
                      </Text>
                    </View>
                  </View>
                  <Switch
                    testID="extra-income-switch"
                    value={isExtraIncome}
                    onValueChange={setIsExtraIncome}
                    trackColor={{ false: '#334155', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {isExtraIncome ? (
                  <View style={[styles.inputBox, styles.subFieldBox]}>
                    <Feather name="briefcase" size={16} color="#10B981" />
                    <TextInput
                      style={styles.textInput}
                      value={incomeSource}
                      onChangeText={setIncomeSource}
                      placeholder="Origem da renda (ex: Freela design, Venda)"
                      placeholderTextColor="#64748B"
                      maxLength={80}
                      selectionColor="#10B981"
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {type === 'despesa' && events.length > 0 ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vincular a Evento (opcional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagSuggestionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.tagSuggestionChip,
                      !selectedEventId ? { borderColor: '#60A5FA', backgroundColor: 'rgba(37, 99, 235, 0.2)' } : null,
                    ]}
                    onPress={() => setSelectedEventId(undefined)}>
                    <Text style={styles.tagSuggestionText}>Nenhum (Orçamento Geral)</Text>
                  </TouchableOpacity>
                  {events.map((ev) => {
                    const active = selectedEventId === ev.id;
                    return (
                      <TouchableOpacity
                        key={ev.id}
                        style={[
                          styles.tagSuggestionChip,
                          active ? { borderColor: '#60A5FA', backgroundColor: 'rgba(37, 99, 235, 0.25)' } : null,
                        ]}
                        onPress={() => setSelectedEventId(ev.id)}>
                        <Text style={styles.tagSuggestionText}>{ev.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <View style={styles.switchRowContainer}>
                <View style={styles.switchLabelContainer}>
                  <View style={styles.switchIconBox}>
                    <Feather name="repeat" size={16} color="#60A5FA" />
                  </View>
                  <View style={styles.switchTextCol}>
                    <Text style={styles.switchTitle}>Transação recorrente mensal</Text>
                    <Text style={styles.switchSubtitle}>
                      Gera automaticamente todo mês no dia escolhido
                    </Text>
                  </View>
                </View>
                <Switch
                  testID="recurring-switch"
                  value={isRecurring}
                  onValueChange={(val) => {
                    setIsRecurring(val);
                    if (val) setIsInstallment(false);
                  }}
                  trackColor={{ false: '#334155', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {isRecurring ? (
                <Text style={styles.recurrenceDerivedHelperText}>
                  Repete todo dia {fromIsoDate(date).getDate()}
                </Text>
              ) : null}
            </View>

            {type === 'despesa' && !id ? (
              <View style={styles.fieldGroup}>
                <View style={styles.switchRowContainer}>
                  <View style={styles.switchLabelContainer}>
                    <View style={styles.switchIconBox}>
                      <Feather name="layers" size={16} color="#60A5FA" />
                    </View>
                    <View style={styles.switchTextCol}>
                      <Text style={styles.switchTitle}>Parcelar despesa</Text>
                      <Text style={styles.switchSubtitle}>
                        Divide em 2 a 48 parcelas mensais consecutivas
                      </Text>
                    </View>
                  </View>
                  <Switch
                    testID="installment-switch"
                    value={isInstallment}
                    onValueChange={(val) => {
                      setIsInstallment(val);
                      if (val) setIsRecurring(false);
                    }}
                    trackColor={{ false: '#334155', true: '#2563EB' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {isInstallment ? (
                  <View style={styles.installmentConfigBox}>
                    <View style={styles.installmentModeRow}>
                      <TouchableOpacity
                        style={[
                          styles.installmentModeBtn,
                          installmentValueMode === 'total' ? styles.installmentModeBtnActive : null,
                        ]}
                        onPress={() => setInstallmentValueMode('total')}
                        activeOpacity={0.75}>
                        <Text
                          style={[
                            styles.installmentModeText,
                            installmentValueMode === 'total' ? styles.installmentModeTextActive : null,
                          ]}>
                          Informar Valor Total
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.installmentModeBtn,
                          installmentValueMode === 'parcel' ? styles.installmentModeBtnActive : null,
                        ]}
                        onPress={() => setInstallmentValueMode('parcel')}
                        activeOpacity={0.75}>
                        <Text
                          style={[
                            styles.installmentModeText,
                            installmentValueMode === 'parcel' ? styles.installmentModeTextActive : null,
                          ]}>
                          Informar Valor da Parcela
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.installmentCounterRow}>
                      <Text style={styles.recurrenceDayLabel}>Número de parcelas (2 a 48):</Text>
                      <View style={styles.recurrenceCounter}>
                        <TouchableOpacity
                          style={styles.recurrenceCounterBtn}
                          onPress={() => setInstallmentCount((prev) => Math.max(2, prev - 1))}
                          activeOpacity={0.7}>
                          <Feather name="minus" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.recurrenceCounterValue}>{installmentCount}x</Text>
                        <TouchableOpacity
                          style={styles.recurrenceCounterBtn}
                          onPress={() => setInstallmentCount((prev) => Math.min(48, prev + 1))}
                          activeOpacity={0.7}>
                          <Feather name="plus" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {installmentPreview ? (
                      <View style={styles.installmentPreviewCard}>
                        <Feather name="info" size={14} color="#60A5FA" />
                        <Text style={styles.installmentPreviewText}>
                          {installmentCount}x de {formatCurrencyBRL(installmentPreview.firstVal)}
                          {installmentPreview.hasRemainder
                            ? ` (última de ${formatCurrencyBRL(installmentPreview.lastVal)})`
                            : ''}{' '}
                          • Total: {formatCurrencyBRL(installmentPreview.totalVal)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {id && existingInstallmentGroupId ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Escopo da edição (Parcela {existingInstallmentNumber}/{existingInstallmentTotal})
                </Text>
                <View style={styles.installmentModeRow}>
                  <TouchableOpacity
                    style={[
                      styles.installmentModeBtn,
                      editInstallmentScope === 'single' ? styles.installmentModeBtnActive : null,
                    ]}
                    onPress={() => setEditInstallmentScope('single')}
                    activeOpacity={0.75}>
                    <Text
                      style={[
                        styles.installmentModeText,
                        editInstallmentScope === 'single' ? styles.installmentModeTextActive : null,
                      ]}>
                      Apenas esta parcela
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.installmentModeBtn,
                      editInstallmentScope === 'future' ? styles.installmentModeBtnActive : null,
                    ]}
                    onPress={() => setEditInstallmentScope('future')}
                    activeOpacity={0.75}>
                    <Text
                      style={[
                        styles.installmentModeText,
                        editInstallmentScope === 'future' ? styles.installmentModeTextActive : null,
                      ]}>
                      Esta e as futuras
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <View style={styles.switchRowContainer}>
                <View style={styles.switchLabelContainer}>
                  <View style={styles.switchIconBox}>
                    <Feather name="clock" size={16} color="#F59E0B" />
                  </View>
                  <View style={styles.switchTextCol}>
                    <Text style={styles.switchTitle}>Marcar como pendente</Text>
                    <Text style={styles.switchSubtitle}>
                      Não afeta o saldo nem orçamentos até ser confirmada
                    </Text>
                  </View>
                </View>
                <Switch
                  testID="pending-switch"
                  value={isPending}
                  onValueChange={setIsPending}
                  trackColor={{ false: '#334155', true: '#F59E0B' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Rótulo colorido (opcional)</Text>
              <View style={styles.colorPaletteRow}>
                {TRANSACTION_COLOR_PALETTE.map((hex) => {
                  const isSelected = colorLabel === hex;
                  return (
                    <TouchableOpacity
                      key={hex}
                      testID={`color-label-${hex}`}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: hex },
                        isSelected ? styles.colorSwatchActive : null,
                      ]}
                      onPress={() => setColorLabel(isSelected ? undefined : hex)}
                      activeOpacity={0.8}>
                      {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tags personalizadas (opcional)</Text>
              <View style={styles.tagInputRow}>
                <View style={[styles.inputBox, styles.tagInputBox]}>
                  <Feather name="hash" size={16} color="#60A5FA" />
                  <TextInput
                    testID="tag-text-input"
                    style={styles.textInput}
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={() => handleAddTag()}
                    placeholder="Ex: viagem-sp, reembolso, cliente-x"
                    placeholderTextColor="#64748B"
                    maxLength={40}
                    returnKeyType="done"
                    selectionColor="#60A5FA"
                  />
                </View>
                <TouchableOpacity
                  testID="btn-add-tag"
                  style={styles.btnAddTag}
                  onPress={() => handleAddTag()}
                  activeOpacity={0.8}>
                  <Feather name="plus" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {matchingTagSuggestions.length > 0 ? (
                <View style={styles.tagSuggestionsRow}>
                  {matchingTagSuggestions.map((sug) => (
                    <TouchableOpacity
                      key={sug}
                      style={styles.tagSuggestionChip}
                      onPress={() => handleAddTag(sug)}
                      activeOpacity={0.75}>
                      <Feather name="plus-circle" size={12} color="#60A5FA" />
                      <Text style={styles.tagSuggestionText}>{sug}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {tags.length > 0 ? (
                <View style={styles.tagsChipsContainer}>
                  {tags.map((t) => (
                    <View key={t} style={styles.tagChipItem}>
                      <Text style={styles.tagChipText}>#{t}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveTag(t)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Feather name="x" size={13} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Observações (opcional)</Text>
              <View style={styles.textAreaBox}>
                <Feather name="file-text" size={16} color="#60A5FA" style={{ marginTop: 2 }} />
                <TextInput
                  style={styles.textAreaInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Adicione anotações, detalhes ou observações..."
                  placeholderTextColor="#64748B"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  selectionColor="#60A5FA"
                  maxLength={500}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Comprovante (opcional)</Text>
              {attachmentUri ? (
                <View style={styles.attachmentPreviewContainer}>
                  <Image source={{ uri: attachmentUri }} style={styles.attachmentThumbnail} />
                  <View style={styles.attachmentActions}>
                    <Text style={styles.attachmentSuccessText}>Comprovante anexado</Text>
                    <View style={styles.attachmentBtnRow}>
                      <TouchableOpacity
                        style={styles.attachmentBtnChange}
                        onPress={() => setShowImageModal(true)}
                        activeOpacity={0.7}>
                        <Feather name="refresh-cw" size={13} color="#60A5FA" />
                        <Text style={styles.attachmentBtnChangeText}>Trocar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.attachmentBtnRemove}
                        onPress={() => setAttachmentUri(null)}
                        activeOpacity={0.7}>
                        <Feather name="trash-2" size={13} color="#EF4444" />
                        <Text style={styles.attachmentBtnRemoveText}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.attachmentPlaceholder}
                  onPress={() => setShowImageModal(true)}
                  activeOpacity={0.7}>
                  <View style={styles.attachmentPlaceholderIcon}>
                    <Feather name="camera" size={20} color="#60A5FA" />
                  </View>
                  <View>
                    <Text style={styles.attachmentPlaceholderTitle}>Anexar foto ou recibo</Text>
                    <Text style={styles.attachmentPlaceholderSub}>Tirar foto ou escolher da galeria</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

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
                      setManualCategorySelected(true);
                      if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: undefined }));
                      setShowCategoryModal(false);
                    }}>
                    <View style={styles.modalOptionContent}>
                      <View style={[styles.modalCategoryIconChip, { backgroundColor: `${item.color || '#2563EB'}25` }]}>
                        <Feather
                          name={(item.icon as keyof typeof Feather.glyphMap) || 'tag'}
                          size={18}
                          color={item.color || '#2563EB'}
                        />
                      </View>
                      <View style={styles.modalOptionTextCol}>
                        <Text style={[styles.modalOptionText, { color: textColor }]}>{item.name}</Text>
                        {item.description ? (
                          <Text style={[styles.modalOptionDesc, { color: mutedTextColor }]} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
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
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Selecione a Conta</Text>
                <TouchableOpacity
                  onPress={() => setShowAccountModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {accounts.length === 0 ? (
                <View style={styles.emptyAccountBox}>
                  <Feather name="credit-card" size={36} color="#64748B" />
                  <Text style={[styles.emptyAccountTitle, { color: textColor }]}>
                    Nenhuma conta cadastrada
                  </Text>
                  <Text style={[styles.emptyAccountSub, { color: mutedTextColor }]}>
                    Cadastre uma conta corrente, poupança ou cartão para vincular à transação.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={accounts}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  style={styles.accountFlatList}
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
              )}

              <TouchableOpacity
                testID="btn-create-account-from-modal"
                style={styles.btnCreateAccountModal}
                activeOpacity={0.8}
                onPress={() => {
                  setShowAccountModal(false);
                  router.push('/account-form' as unknown as Parameters<typeof router.push>[0]);
                }}>
                <Feather name="plus-circle" size={18} color="#FFFFFF" />
                <Text style={styles.btnCreateAccountModalText}>Cadastrar Nova Conta</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showImageModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImageModal(false)}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowImageModal(false)}>
            <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Anexar Comprovante</Text>
              
              <TouchableOpacity
                style={styles.modalActionItem}
                onPress={handleTakePhoto}
                activeOpacity={0.7}>
                <View style={styles.modalActionIconBox}>
                  <Feather name="camera" size={20} color="#2563EB" />
                </View>
                <View style={styles.modalActionTextBox}>
                  <Text style={[styles.modalOptionText, { color: textColor }]}>Tirar Foto</Text>
                  <Text style={[styles.modalActionSub, { color: mutedTextColor }]}>Usar a câmera do aparelho</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionItem}
                onPress={handlePickFromGallery}
                activeOpacity={0.7}>
                <View style={styles.modalActionIconBox}>
                  <Feather name="image" size={20} color="#10B981" />
                </View>
                <View style={styles.modalActionTextBox}>
                  <Text style={[styles.modalOptionText, { color: textColor }]}>Escolher da Galeria</Text>
                  <Text style={[styles.modalActionSub, { color: mutedTextColor }]}>Selecionar comprovante salvo</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

      </KeyboardAvoidingView>

      <ConfirmModal
        visible={Boolean(limitWarningData)}
        title="Limite por Transação Excedido"
        description={`Esta despesa de ${limitWarningData ? formatCurrencyBRL(limitWarningData.parsedValue) : ''} ultrapassa o seu teto configurado de ${limitWarningData ? formatCurrencyBRL(limitWarningData.maxLimit) : ''}. Deseja prosseguir com o lançamento?`}
        confirmText="Continuar e Salvar"
        cancelText="Voltar"
        variant="warning"
        icon="alert-triangle"
        onConfirm={() => {
          setLimitWarningData(null);
          executeSave(true);
        }}
        onCancel={() => setLimitWarningData(null)}
      />
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
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '600',
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 70,
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
  subFieldBox: {
    marginTop: 6,
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
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    gap: 8,
  },
  suggestionChipActive: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  suggestionChipText: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
  },
  suggestionChipHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  suggestionChipApply: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60A5FA',
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
    flex: 1,
  },
  catTextCol: {
    flex: 1,
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
  catDescriptionSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
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
  installmentConfigBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  installmentModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  installmentModeBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  installmentModeBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  installmentModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  installmentModeTextActive: {
    color: '#60A5FA',
  },
  installmentCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  installmentPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  installmentPreviewText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
    flex: 1,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInputBox: {
    flex: 1,
  },
  btnAddTag: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSuggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  tagSuggestionText: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '500',
  },
  tagsChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  tagChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  tagChipText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
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
    flex: 1,
    marginRight: 8,
  },
  modalOptionTextCol: {
    flex: 1,
  },
  categoryBullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalCategoryIconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalOptionDesc: {
    fontSize: 12,
    marginTop: 2,
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
  confirmedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmedCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmedIconWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
    lineHeight: 28,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '65%',
    textAlign: 'right',
  },
  summaryValueAmount: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  summaryAmountExpense: {
    color: '#F87171',
  },
  summaryAmountIncome: {
    color: '#4ADE80',
  },
  btnShare: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  btnShareIcon: {
    marginRight: 8,
  },
  btnShareText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnFinish: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnFinishText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  switchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  switchIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  switchTextCol: {
    flex: 1,
  },
  switchTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  switchSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  recurrenceDerivedHelperText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    marginLeft: 4,
  },
  recurrenceDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  recurrenceDayLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  recurrenceCounter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurrenceCounterBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurrenceCounterValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  textAreaBox: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 80,
    flexDirection: 'row',
    gap: 10,
  },
  textAreaInput: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  attachmentPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  attachmentPlaceholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  attachmentPlaceholderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentPlaceholderSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  attachmentPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    padding: 12,
  },
  attachmentThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  attachmentActions: {
    flex: 1,
    marginLeft: 14,
  },
  attachmentSuccessText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  attachmentBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentBtnChange: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  attachmentBtnChangeText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  attachmentBtnRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  attachmentBtnRemoveText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#0F172A',
  },
  modalActionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalActionTextBox: {
    flex: 1,
  },
  modalActionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emptyAccountBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyAccountTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyAccountSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  accountFlatList: {
    maxHeight: 280,
  },
  btnCreateAccountModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  btnCreateAccountModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
