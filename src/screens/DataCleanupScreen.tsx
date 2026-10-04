import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { TransactionRepository } from '../data/repositories/TransactionRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { Account } from '../domain/entities/Account';
import { Transaction } from '../domain/entities/Transaction';

export type CleanupPeriod = '30_days' | '90_days' | '180_days' | '365_days' | 'all';

interface PeriodOption {
  key: CleanupPeriod;
  label: string;
  days: number | null;
  description: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: '30_days', label: 'Mais de 30 dias', days: 30, description: 'Transações com mais de 1 mês' },
  { key: '90_days', label: 'Mais de 90 dias', days: 90, description: 'Transações com mais de 3 meses' },
  { key: '180_days', label: 'Mais de 6 meses', days: 180, description: 'Transações com mais de 6 meses' },
  { key: '365_days', label: 'Mais de 1 ano', days: 365, description: 'Transações com mais de 1 ano' },
  { key: 'all', label: 'Todas as transações', days: null, description: 'Limpar todo o histórico' },
];

const formatCurrency = (val: number): string =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function DataCleanupScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState<CleanupPeriod>('90_days');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [matchingTransactions, setMatchingTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const transactionRepo = new TransactionRepository();
  const accountRepo = new AccountRepository();

  const getCutoffDate = (days: number | null): string | null => {
    if (days === null) return null;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  const calculateMatching = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allAccounts, allTransactions] = await Promise.all([
        accountRepo.findAll(),
        transactionRepo.findAll(),
      ]);

      setAccounts(allAccounts);

      const option = PERIOD_OPTIONS.find((p) => p.key === selectedPeriod);
      const cutoffDate = getCutoffDate(option?.days ?? null);

      const filtered = allTransactions.filter((tx) => {
        if (selectedAccountId !== 'all' && tx.account_id !== selectedAccountId) {
          return false;
        }
        if (cutoffDate && tx.date >= cutoffDate) {
          return false;
        }
        return true;
      });

      setMatchingTransactions(filtered);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar as transações para limpeza.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, selectedAccountId]);

  useFocusEffect(
    useCallback(() => {
      calculateMatching();
    }, [calculateMatching])
  );

  const totalExpense = matchingTransactions
    .filter((tx) => tx.type === 'despesa')
    .reduce((sum, tx) => sum + tx.value, 0);

  const totalIncome = matchingTransactions
    .filter((tx) => tx.type === 'receita')
    .reduce((sum, tx) => sum + tx.value, 0);

  const handleDelete = () => {
    if (matchingTransactions.length === 0) return;

    Alert.alert(
      'Passo 1 de 2: Confirmar Exclusão',
      `Deseja apagar ${matchingTransactions.length} transações do período selecionado?\n\nTotal em movimentações: ${formatCurrency(totalIncome + totalExpense)}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => confirmFinalDelete(),
        },
      ]
    );
  };

  const confirmFinalDelete = () => {
    Alert.alert(
      'Passo 2 de 2: Confirmação Definitiva',
      `ATENÇÃO: Esta ação é irreversível e NÃO poderá ser desfeita. Todos os ${matchingTransactions.length} registros serão apagados do seu banco de dados local.\n\nTem certeza absoluta de que deseja apagar?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Sim, Apagar Definitivamente',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const ids = matchingTransactions.map((tx) => tx.id);
              await transactionRepo.deleteMany(ids);
              Alert.alert(
                'Limpeza Concluída',
                `${ids.length} transações foram removidas com sucesso.`
              );
              calculateMatching();
            } catch {
              Alert.alert('Erro', 'Ocorreu um erro ao excluir transações.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.btnBack}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Limpeza de Dados</Text>
        <View style={styles.emptySpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <View style={styles.introIconBox}>
            <Feather name="trash-2" size={24} color="#EF4444" />
          </View>
          <View style={styles.introTextBox}>
            <Text style={styles.introTitle}>Exclusão de Registros Antigos</Text>
            <Text style={styles.introDescription}>
              Remova transações anteriores a determinado período para manter seus dados limpos e o
              aplicativo leve. O saldo atual das contas será recalculado automaticamente.
            </Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>PERÍODO DE CORTE</Text>
          <View style={styles.periodCardsList}>
            {PERIOD_OPTIONS.map((option) => {
              const isSelected = selectedPeriod === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.periodCard, isSelected ? styles.periodCardSelected : null]}
                  onPress={() => setSelectedPeriod(option.key)}
                  activeOpacity={0.8}>
                  <View style={styles.periodCardLeft}>
                    <View
                      style={[
                        styles.periodRadio,
                        isSelected ? styles.periodRadioSelected : null,
                      ]}>
                      {isSelected ? <View style={styles.periodRadioInner} /> : null}
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.periodLabel,
                          isSelected ? styles.periodLabelSelected : null,
                        ]}>
                        {option.label}
                      </Text>
                      <Text style={styles.periodSub}>{option.description}</Text>
                    </View>
                  </View>
                  <Feather
                    name="calendar"
                    size={16}
                    color={isSelected ? '#60A5FA' : '#64748B'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>FILTRAR POR CONTA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountChipsRow}>
            <TouchableOpacity
              style={[
                styles.accountChip,
                selectedAccountId === 'all' ? styles.accountChipSelected : null,
              ]}
              onPress={() => setSelectedAccountId('all')}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.accountChipText,
                  selectedAccountId === 'all' ? styles.accountChipTextSelected : null,
                ]}>
                Todas as Contas
              </Text>
            </TouchableOpacity>

            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accountChip, isSelected ? styles.accountChipSelected : null]}
                  onPress={() => setSelectedAccountId(acc.id)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.accountChipText,
                      isSelected ? styles.accountChipTextSelected : null,
                    ]}>
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>IMPACTO DA LIMPEZA</Text>
          {isLoading ? (
            <View style={styles.impactLoading}>
              <ActivityIndicator color="#60A5FA" size="small" />
              <Text style={styles.impactLoadingText}>Calculando transações afetadas...</Text>
            </View>
          ) : (
            <View style={styles.impactCard}>
              <View style={styles.impactHeader}>
                <Text style={styles.impactCount}>{matchingTransactions.length}</Text>
                <Text style={styles.impactCountSub}>
                  {matchingTransactions.length === 1
                    ? 'transação selecionada para exclusão'
                    : 'transações selecionadas para exclusão'}
                </Text>
              </View>

              <View style={styles.impactDivider} />

              <View style={styles.impactDetailsRow}>
                <View style={styles.impactCol}>
                  <Text style={styles.impactColLabel}>Total em Receitas</Text>
                  <Text style={[styles.impactColValue, styles.valIncome]}>
                    {formatCurrency(totalIncome)}
                  </Text>
                </View>

                <View style={styles.impactColDivider} />

                <View style={styles.impactCol}>
                  <Text style={styles.impactColLabel}>Total em Despesas</Text>
                  <Text style={[styles.impactColValue, styles.valExpense]}>
                    {formatCurrency(totalExpense)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.warningCard}>
          <Feather name="alert-triangle" size={18} color="#F59E0B" style={styles.warningIcon} />
          <Text style={styles.warningText}>
            Atenção: Os dados excluídos não poderão ser recuperados. Certifique-se de que não precisa
            mais deste histórico antes de prosseguir.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.btnDeleteAll,
            matchingTransactions.length === 0 || isDeleting ? styles.btnDeleteDisabled : null,
          ]}
          onPress={handleDelete}
          disabled={matchingTransactions.length === 0 || isDeleting}
          activeOpacity={0.85}>
          {isDeleting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="trash-2" size={18} color="#FFFFFF" style={styles.btnDeleteIcon} />
              <Text style={styles.btnDeleteAllText}>
                {matchingTransactions.length === 0
                  ? 'Nenhuma Transação para Apagar'
                  : `Apagar ${matchingTransactions.length} Transações`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  emptySpacer: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  introCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
    gap: 14,
  },
  introIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTextBox: {
    flex: 1,
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  introDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  periodCardsList: {
    gap: 8,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  periodCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#1E293B',
  },
  periodCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  periodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodRadioSelected: {
    borderColor: '#2563EB',
  },
  periodRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  periodLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  periodLabelSelected: {
    color: '#60A5FA',
  },
  periodSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  accountChipsRow: {
    gap: 8,
    paddingRight: 10,
  },
  accountChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  accountChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  accountChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  accountChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  impactLoading: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  impactLoadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  impactCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 18,
  },
  impactHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  impactCount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  impactCountSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  impactDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 14,
  },
  impactDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactCol: {
    flex: 1,
    alignItems: 'center',
  },
  impactColDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#334155',
  },
  impactColLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  impactColValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  valIncome: {
    color: '#4ADE80',
  },
  valExpense: {
    color: '#F87171',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  warningIcon: {
    flexShrink: 0,
  },
  warningText: {
    flex: 1,
    color: '#FBBF24',
    fontSize: 12,
    lineHeight: 18,
  },
  btnDeleteAll: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDeleteDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnDeleteIcon: {
    marginRight: 8,
  },
  btnDeleteAllText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
