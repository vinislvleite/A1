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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { Account } from '../domain/entities/Account';
import { SuccessCheckIcon } from '../components/SuccessCheckIcon';

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

const formatCurrencyBRL = (val: number): string =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface TransferSummary {
  sourceAccountName: string;
  destAccountName: string;
  value: number;
  date: string;
  description?: string;
}

export function TransferScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destAccountId, setDestAccountId] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(true);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showDestModal, setShowDestModal] = useState(false);
  const [successSummary, setSuccessSummary] = useState<TransferSummary | null>(null);
  const [errors, setErrors] = useState<{
    source?: string;
    dest?: string;
    value?: string;
  }>({});

  const accountRepo = new AccountRepository();
  const transactionRepo = new TransactionRepository();

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setIsFetchingAccounts(true);
        const list = await accountRepo.findAll();
        setAccounts(list);
        if (list.length >= 2) {
          setSourceAccountId(list[0].id);
          setDestAccountId(list[1].id);
        } else if (list.length === 1) {
          setSourceAccountId(list[0].id);
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar as contas.');
      } finally {
        setIsFetchingAccounts(false);
      }
    };

    loadAccounts();
  }, []);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    const parsedVal = parseCurrencyValue(value);

    if (!sourceAccountId) {
      newErrors.source = 'Selecione a conta de origem';
    }

    if (!destAccountId) {
      newErrors.dest = 'Selecione a conta de destino';
    }

    if (sourceAccountId && destAccountId && sourceAccountId === destAccountId) {
      newErrors.dest = 'Origem e destino devem ser diferentes';
    }

    if (parsedVal <= 0) {
      newErrors.value = 'Informe um valor maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSwapAccounts = () => {
    setSourceAccountId(destAccountId);
    setDestAccountId(sourceAccountId);
    if (errors.source || errors.dest) {
      setErrors((prev) => ({ ...prev, source: undefined, dest: undefined }));
    }
  };

  const handleTransfer = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const parsedVal = parseCurrencyValue(value);
      const now = new Date().toISOString();

      await transactionRepo.transfer({
        sourceAccountId,
        destinationAccountId: destAccountId,
        value: parsedVal,
        date: now,
        description: description.trim() || undefined,
      });

      const src = accounts.find((a) => a.id === sourceAccountId);
      const dst = accounts.find((a) => a.id === destAccountId);

      setIsLoading(false);
      setSuccessSummary({
        sourceAccountName: src?.name ?? 'Origem',
        destAccountName: dst?.name ?? 'Destino',
        value: parsedVal,
        date: now,
        description: description.trim() || undefined,
      });
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Falha ao transferir valores.';
      Alert.alert('Erro', message);
    }
  };

  const selectedSource = accounts.find((a) => a.id === sourceAccountId);
  const selectedDest = accounts.find((a) => a.id === destAccountId);

  if (isFetchingAccounts) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando contas disponíveis...</Text>
      </SafeAreaView>
    );
  }

  if (successSummary) {
    return (
      <SafeAreaView style={styles.successSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <ScrollView contentContainerStyle={styles.successContent} showsVerticalScrollIndicator={false}>
          <SuccessCheckIcon size={84} />

          <Text style={styles.successTitle}>Transferência Concluída!</Text>
          <Text style={styles.successSubtitle}>
            O valor foi transferido e registrado com sucesso.
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Valor Transferido</Text>
              <Text style={styles.summaryValueText}>{formatCurrencyBRL(successSummary.value)}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Conta de Origem</Text>
              <Text style={styles.summaryText}>{successSummary.sourceAccountName}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Conta de Destino</Text>
              <Text style={styles.summaryText}>{successSummary.destAccountName}</Text>
            </View>

            {successSummary.description ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Descrição</Text>
                <Text style={styles.summaryText}>{successSummary.description}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.btnPrimary}
              activeOpacity={0.85}
              onPress={() => router.replace('/home' as unknown as Parameters<typeof router.replace>[0])}>
              <Text style={styles.btnPrimaryText}>Voltar ao Início</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              activeOpacity={0.7}
              onPress={() => {
                setValue('');
                setDescription('');
                setSuccessSummary(null);
              }}>
              <Text style={styles.btnSecondaryText}>Nova Transferência</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
        <Text style={styles.navTitle}>Transferência</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Valor da Transferência</Text>
            <View style={[styles.amountBox, errors.value ? styles.boxError : null]}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={value}
                onChangeText={(text) => {
                  const formatted = formatCurrencyInput(text);
                  setValue(formatted);
                  if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
                }}
                placeholder="0,00"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                selectionColor="#60A5FA"
              />
            </View>
            {errors.value ? <Text style={styles.errorText}>{errors.value}</Text> : null}
          </View>

          <View style={styles.accountsContainer}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>De (Origem)</Text>
              <TouchableOpacity
                style={[styles.accountSelectorCard, errors.source ? styles.boxError : null]}
                activeOpacity={0.75}
                onPress={() => setShowSourceModal(true)}>
                <View style={styles.accountSelectorContent}>
                  <View
                    style={[
                      styles.accountChip,
                      { backgroundColor: selectedSource?.color ? `${selectedSource.color}25` : '#334155' },
                    ]}>
                    <Feather
                      name="arrow-up-right"
                      size={18}
                      color={selectedSource?.color || '#EF4444'}
                    />
                  </View>
                  <View style={styles.accountTextGroup}>
                    <Text style={styles.accountSelectedName}>
                      {selectedSource?.name ?? 'Selecione a conta de origem'}
                    </Text>
                    <Text style={styles.accountSub}>Conta que terá o débito</Text>
                  </View>
                </View>
                <Feather name="chevron-down" size={18} color="#94A3B8" />
              </TouchableOpacity>
              {errors.source ? <Text style={styles.errorText}>{errors.source}</Text> : null}
            </View>

            <View style={styles.swapIndicatorRow}>
              <TouchableOpacity
                style={styles.swapCircle}
                onPress={handleSwapAccounts}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="repeat" size={16} color="#60A5FA" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Para (Destino)</Text>
              <TouchableOpacity
                style={[styles.accountSelectorCard, errors.dest ? styles.boxError : null]}
                activeOpacity={0.75}
                onPress={() => setShowDestModal(true)}>
                <View style={styles.accountSelectorContent}>
                  <View
                    style={[
                      styles.accountChip,
                      { backgroundColor: selectedDest?.color ? `${selectedDest.color}25` : '#334155' },
                    ]}>
                    <Feather
                      name="arrow-down-left"
                      size={18}
                      color={selectedDest?.color || '#10B981'}
                    />
                  </View>
                  <View style={styles.accountTextGroup}>
                    <Text style={styles.accountSelectedName}>
                      {selectedDest?.name ?? 'Selecione a conta de destino'}
                    </Text>
                    <Text style={styles.accountSub}>Conta que receberá o crédito</Text>
                  </View>
                </View>
                <Feather name="chevron-down" size={18} color="#94A3B8" />
              </TouchableOpacity>
              {errors.dest ? <Text style={styles.errorText}>{errors.dest}</Text> : null}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
            <View style={styles.inputBox}>
              <Feather name="edit-3" size={18} color="#60A5FA" />
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex: Reserva de emergência, Envio"
                placeholderTextColor="#64748B"
                selectionColor="#60A5FA"
                maxLength={100}
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.actionsFooter}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleTransfer}
              disabled={isLoading}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnPrimaryText}>Confirmar Transferência</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => router.back()}
              activeOpacity={0.7}>
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showSourceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSourceModal(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSourceModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Conta de Origem</Text>
            <FlatList
              data={accounts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    item.id === sourceAccountId ? styles.modalOptionSelected : null,
                  ]}
                  onPress={() => {
                    setSourceAccountId(item.id);
                    if (errors.source) setErrors((prev) => ({ ...prev, source: undefined }));
                    setShowSourceModal(false);
                  }}>
                  <View style={styles.modalOptionLeft}>
                    <View style={[styles.colorDot, { backgroundColor: item.color || '#2563EB' }]} />
                    <Text style={styles.modalOptionText}>{item.name}</Text>
                  </View>
                  {item.id === sourceAccountId ? (
                    <Feather name="check" size={18} color="#2563EB" />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showDestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDestModal(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowDestModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Conta de Destino</Text>
            <FlatList
              data={accounts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    item.id === destAccountId ? styles.modalOptionSelected : null,
                  ]}
                  onPress={() => {
                    setDestAccountId(item.id);
                    if (errors.dest) setErrors((prev) => ({ ...prev, dest: undefined }));
                    setShowDestModal(false);
                  }}>
                  <View style={styles.modalOptionLeft}>
                    <View style={[styles.colorDot, { backgroundColor: item.color || '#2563EB' }]} />
                    <Text style={styles.modalOptionText}>{item.name}</Text>
                  </View>
                  {item.id === destAccountId ? (
                    <Feather name="check" size={18} color="#2563EB" />
                  ) : null}
                </TouchableOpacity>
              )}
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
    paddingTop: 8,
    paddingBottom: 40,
    gap: 18,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  amountLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 8,
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
    width: '100%',
  },
  boxError: {
    borderColor: '#EF4444',
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '600',
    color: '#60A5FA',
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 160,
    padding: 0,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  accountsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  accountSelectorCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accountChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextGroup: {
    flex: 1,
  },
  accountSelectedName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  accountSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  swapIndicatorRow: {
    alignItems: 'center',
    marginVertical: -4,
  },
  swapCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
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
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  actionsFooter: {
    marginTop: 10,
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSecondary: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    maxHeight: 380,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalOptionSelected: {
    backgroundColor: '#334155',
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalOptionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  successSafeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  successContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 18,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    padding: 18,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  summaryValueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ADE80',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  successActions: {
    width: '100%',
    marginTop: 28,
    gap: 10,
  },
});
