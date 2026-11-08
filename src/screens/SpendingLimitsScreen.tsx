import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BudgetRepository } from '../data/repositories/BudgetRepository';

const WEEKDAYS = [
  { day: 1, label: 'Segunda-feira', short: 'SEG' },
  { day: 2, label: 'Terça-feira', short: 'TER' },
  { day: 3, label: 'Quarta-feira', short: 'QUA' },
  { day: 4, label: 'Quinta-feira', short: 'QUI' },
  { day: 5, label: 'Sexta-feira', short: 'SEX' },
  { day: 6, label: 'Sábado', short: 'SÁB' },
  { day: 0, label: 'Domingo', short: 'DOM' },
];

const formatCurrencyInput = (rawText: string): string => {
  const cleanDigits = rawText.replace(/\D/g, '').slice(0, 10);
  if (!cleanDigits) return '';
  const cents = parseInt(cleanDigits, 10);
  if (cents === 0) return '';
  const amount = cents / 100;
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDbValue = (val: number): string => {
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function SpendingLimitsScreen() {
  const [maxTxText, setMaxTxText] = useState('');
  const [defaultDailyText, setDefaultDailyText] = useState('');
  const [weekdayTexts, setWeekdayTexts] = useState<Record<number, string>>({});

  const loadLimits = useCallback(async () => {
    const repo = new BudgetRepository();
    const [maxTx, dailyList] = await Promise.all([
      repo.getMaxTransactionLimit(),
      repo.findAllDailyLimits(),
    ]);

    setMaxTxText(maxTx && maxTx > 0 ? formatDbValue(maxTx) : '');
    const map: Record<number, string> = {};
    let defVal = '';
    for (const item of dailyList) {
      if (item.day_of_week === -1 && item.limit_value > 0) {
        defVal = formatDbValue(item.limit_value);
      } else if (item.day_of_week >= 0 && item.limit_value > 0) {
        map[item.day_of_week] = formatDbValue(item.limit_value);
      }
    }
    setDefaultDailyText(defVal);
    setWeekdayTexts(map);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLimits();
    }, [loadLimits])
  );

  const handleSave = async () => {
    try {
      const repo = new BudgetRepository();
      const parsedMaxTx =
        parseFloat(maxTxText.replace(/\./g, '').replace(',', '.')) || 0;
      await repo.setMaxTransactionLimit(parsedMaxTx > 0 ? parsedMaxTx : null);

      const parsedDefaultDaily =
        parseFloat(defaultDailyText.replace(/\./g, '').replace(',', '.')) || 0;
      await repo.setDailyLimit(-1, parsedDefaultDaily > 0 ? parsedDefaultDaily : 0);

      for (const w of WEEKDAYS) {
        const raw = weekdayTexts[w.day] ?? '';
        const val = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
        await repo.setDailyLimit(w.day, val > 0 ? val : 0);
      }

      Alert.alert('Sucesso', 'Tetos de gasto diário e limite por transação atualizados.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar os limites.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Tetos e Limites de Gasto</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.16)' }]}>
              <Feather name="shield" size={18} color="#60A5FA" />
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardTitle}>Limite por Transação</Text>
              <Text style={styles.cardHint}>
                Avisa antes de confirmar qualquer despesa individual acima deste valor.
              </Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.currencyInput}
              value={maxTxText}
              onChangeText={(txt) => setMaxTxText(formatCurrencyInput(txt))}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor="#64748B"
              selectionColor="#60A5FA"
            />
            {maxTxText ? (
              <TouchableOpacity onPress={() => setMaxTxText('')} style={styles.clearBtn} activeOpacity={0.7}>
                <Feather name="x" size={14} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.helperText}>
            Deixe vazio ou em 0,00 para desativar a confirmação de transações altas.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.16)' }]}>
              <Feather name="calendar" size={18} color="#A78BFA" />
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardTitle}>Teto de Gasto Diário</Text>
              <Text style={styles.cardHint}>
                Receba alertas no celular ao ultrapassar seu teto de gastos no dia.
              </Text>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionHeading}>TETO PADRÃO (TODOS OS DIAS)</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.currencyInput}
              value={defaultDailyText}
              onChangeText={(txt) => setDefaultDailyText(formatCurrencyInput(txt))}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor="#64748B"
              selectionColor="#60A5FA"
            />
            {defaultDailyText ? (
              <TouchableOpacity onPress={() => setDefaultDailyText('')} style={styles.clearBtn} activeOpacity={0.7}>
                <Feather name="x" size={14} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.helperText}>
            Valor base aplicado a todos os dias sem limite específico abaixo.
          </Text>

          <View style={styles.sectionDivider} />

          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionHeading}>PERSONALIZAR POR DIA DA SEMANA</Text>
            <Text style={styles.sectionSubheading}>
              Defina valores específicos (ex: finais de semana mais flexíveis).
            </Text>
          </View>

          <View style={styles.weekdaysList}>
            {WEEKDAYS.map((w) => {
              const isWeekend = w.day === 0 || w.day === 6;
              const val = weekdayTexts[w.day] ?? '';
              return (
                <View key={w.day} style={styles.weekdayRow}>
                  <View style={styles.weekdayLeft}>
                    <View style={[styles.dayBadge, isWeekend ? styles.dayBadgeWeekend : null]}>
                      <Text style={[styles.dayBadgeText, isWeekend ? styles.dayBadgeTextWeekend : null]}>
                        {w.short}
                      </Text>
                    </View>
                    <Text style={styles.weekdayName}>{w.label}</Text>
                  </View>

                  <View style={styles.weekdayInputContainer}>
                    <Text style={styles.weekdayPrefix}>R$</Text>
                    <TextInput
                      style={styles.weekdayInput}
                      value={val}
                      onChangeText={(txt) =>
                        setWeekdayTexts((prev) => ({
                          ...prev,
                          [w.day]: formatCurrencyInput(txt),
                        }))
                      }
                      keyboardType="numeric"
                      placeholder="Padrão"
                      placeholderTextColor="#64748B"
                      selectionColor="#60A5FA"
                    />
                    {val ? (
                      <TouchableOpacity
                        onPress={() =>
                          setWeekdayTexts((prev) => {
                            const next = { ...prev };
                            delete next[w.day];
                            return next;
                          })
                        }
                        style={styles.weekdayClearBtn}
                        activeOpacity={0.7}>
                        <Feather name="x" size={12} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Feather name="check" size={18} color="#FFFFFF" style={styles.saveIcon} />
          <Text style={styles.saveBtnText}>Salvar Limites</Text>
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: {
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navPlaceholder: {
    width: 38,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardHint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  sectionHeading: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionTitleBlock: {
    gap: 3,
  },
  sectionSubheading: {
    color: '#64748B',
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#60A5FA',
  },
  currencyInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
  },
  clearBtn: {
    padding: 4,
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
  },
  weekdaysList: {
    gap: 10,
    marginTop: 4,
  },
  weekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 10,
  },
  weekdayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dayBadge: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 38,
    alignItems: 'center',
  },
  dayBadgeWeekend: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  dayBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  dayBadgeTextWeekend: {
    color: '#FBBF24',
  },
  weekdayName: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  weekdayInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    height: 38,
    width: 130,
    paddingHorizontal: 8,
    gap: 4,
  },
  weekdayPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  weekdayInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
    padding: 0,
  },
  weekdayClearBtn: {
    padding: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
