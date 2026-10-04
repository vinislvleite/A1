import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { AccountType } from '../domain/entities/Account';

export interface AccountFormScreenProps {
  id?: string;
  onSuccess?: () => void;
}

const AVAILABLE_COLORS = [
  '#820AD1',
  '#EC7000',
  '#CC092F',
  '#EA1D2C',
  '#F59E0B',
  '#005CA9',
  '#2563EB',
  '#10B981',
  '#06B6D4',
  '#8B5CF6',
  '#EC4899',
  '#11C76F',
  '#FF7A00',
  '#14B8A6',
  '#6366F1',
  '#E11D48',
  '#84CC16',
  '#0EA5E9',
  '#3B82F6',
  '#64748B',
  '#475569',
  '#D97706',
  '#059669',
  '#7C3AED',
];

const AVAILABLE_ICONS: (keyof typeof Feather.glyphMap)[] = [
  'credit-card',
  'dollar-sign',
  'smartphone',
  'briefcase',
  'pie-chart',
  'trending-up',
  'shield',
  'lock',
  'home',
  'shopping-bag',
  'pocket',
  'award',
  'send',
  'zap',
  'folder',
  'archive',
  'layers',
  'gift',
  'globe',
  'compass',
  'target',
  'box',
  'bookmark',
  'activity',
  'percent',
  'tag',
  'feather',
  'user',
];

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

export function AccountFormScreen({ id, onSuccess }: AccountFormScreenProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('corrente');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState(AVAILABLE_COLORS[0]);
  const [icon, setIcon] = useState<keyof typeof Feather.glyphMap>(AVAILABLE_ICONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(Boolean(id));
  const [errors, setErrors] = useState<{ name?: string }>({});

  const accountRepo = new AccountRepository();

  useEffect(() => {
    if (!id) return;

    const loadAccount = async () => {
      try {
        setIsFetching(true);
        const account = await accountRepo.findById(id);
        if (account) {
          setName(account.name);
          setType(account.type);
          setColor(account.color || AVAILABLE_COLORS[0]);
          setIcon((account.icon as keyof typeof Feather.glyphMap) || AVAILABLE_ICONS[0]);
          setInitialBalance(
            account.initial_balance.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          );
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os dados da conta.');
      } finally {
        setIsFetching(false);
      }
    };

    loadAccount();
  }, [id]);

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Informe o nome da conta';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const parsedBalance = parseCurrencyValue(initialBalance);

      if (id) {
        await accountRepo.update(id, {
          name: name.trim(),
          type,
          initial_balance: parsedBalance,
          color,
          icon,
        });
      } else {
        await accountRepo.create({
          name: name.trim(),
          type,
          initial_balance: parsedBalance,
          color,
          icon,
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
      const message = error instanceof Error ? error.message : 'Falha ao salvar conta.';
      Alert.alert('Erro', message);
    }
  };

  if (isFetching) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando dados da conta...</Text>
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
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{id ? 'Editar Conta' : 'Nova Conta'}</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <View style={[styles.previewCard, { backgroundColor: color }]}>
            <View style={styles.previewTopRow}>
              <View style={styles.previewIconBox}>
                <Feather name={icon} size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.previewTypeBadge}>
                {type === 'corrente' ? 'Conta Corrente' : type === 'poupanca' ? 'Poupança' : 'Cartão de Crédito'}
              </Text>
            </View>
            <View style={styles.previewBottomCol}>
              <Text style={styles.previewAccountName} numberOfLines={1}>
                {name.trim() || 'Nome da Conta'}
              </Text>
              <Text style={styles.previewBalanceLabel}>Saldo Inicial</Text>
              <Text style={styles.previewBalanceValue}>
                R$ {initialBalance || '0,00'}
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nome da Conta</Text>
            <View style={[styles.inputBox, errors.name ? styles.inputBoxError : null]}>
              <Feather name="credit-card" size={18} color="#60A5FA" />
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors({});
                }}
                placeholder="Ex: Nubank, Itaú, Carteira"
                placeholderTextColor="#64748B"
              />
            </View>
            {errors.name ? (
              <Text style={styles.errorText}>{errors.name}</Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Tipo de Conta</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'corrente' ? styles.typeButtonActive : null,
                ]}
                onPress={() => setType('corrente')}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'corrente' ? styles.typeButtonTextActive : null,
                  ]}>
                  Corrente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'poupanca' ? styles.typeButtonActive : null,
                ]}
                onPress={() => setType('poupanca')}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'poupanca' ? styles.typeButtonTextActive : null,
                  ]}>
                  Poupança
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'cartao_credito' ? styles.typeButtonActive : null,
                ]}
                onPress={() => setType('cartao_credito')}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'cartao_credito' ? styles.typeButtonTextActive : null,
                  ]}>
                  Cartão
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Saldo Inicial</Text>
            <View style={styles.amountBox}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={initialBalance}
                onChangeText={(text) => {
                  const formatted = formatCurrencyInput(text);
                  setInitialBalance(formatted);
                }}
                placeholder="0,00"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                selectionColor="#60A5FA"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Cor da Conta</Text>
            <View style={styles.paletteRow}>
              {AVAILABLE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorChip,
                    { backgroundColor: c },
                    color === c ? styles.colorChipSelected : null,
                  ]}
                  onPress={() => setColor(c)}
                  activeOpacity={0.8}>
                  {color === c ? (
                    <Feather name="check" size={16} color="#FFFFFF" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Ícone da Conta</Text>
            <View style={styles.iconsGrid}>
              {AVAILABLE_ICONS.map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.iconOption,
                    icon === i ? styles.iconOptionSelected : null,
                  ]}
                  onPress={() => setIcon(i)}
                  activeOpacity={0.8}>
                  <Feather
                    name={i}
                    size={22}
                    color={icon === i ? '#60A5FA' : '#94A3B8'}
                  />
                </TouchableOpacity>
              ))}
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
                  {id ? 'Salvar Alterações' : 'Criar Conta'}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  inputBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputBoxError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2563EB',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    color: '#60A5FA',
  },
  amountInput: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 70,
    padding: 0,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 4,
  },
  colorChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChipSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    borderColor: '#60A5FA',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  actionsFooter: {
    marginTop: 12,
    gap: 10,
  },
  btnSave: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnCancel: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  previewCard: {
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTypeBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  previewBottomCol: {
    marginTop: 10,
  },
  previewAccountName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewBalanceLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  previewBalanceValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
});
