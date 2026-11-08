import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  EventBudgetUseCase,
  EventBudgetProgress,
} from '../domain/usecases/EventBudgetUseCase';
import { BudgetRepository } from '../data/repositories/BudgetRepository';
import { formatMoneyValue } from '../components/MoneyText';
import { usePrivacyMode } from '../context/PrivacyContext';

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

export function EventsScreen() {
  usePrivacyMode();
  const [events, setEvents] = useState<EventBudgetProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [limitText, setLimitText] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10));

  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const useCase = new EventBudgetUseCase();
      const list = await useCase.listEventsWithProgress();
      setEvents(list);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os eventos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const handleCreateEvent = async () => {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do evento (ex: Viagem Férias).');
      return;
    }
    const val = parseFloat(limitText.replace(/\./g, '').replace(',', '.')) || 0;
    if (val <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor de limite maior que zero.');
      return;
    }
    if (!startDate.trim() || !endDate.trim()) {
      Alert.alert('Período obrigatório', 'Informe as datas de início e término do evento.');
      return;
    }
    try {
      const useCase = new EventBudgetUseCase();
      await useCase.createEvent({
        name: name.trim(),
        limit_value: val,
        start_date: startDate.trim(),
        end_date: endDate.trim(),
      });
      setName('');
      setLimitText('');
      await loadEvents();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar evento.';
      Alert.alert('Atenção', msg);
    }
  };

  const handleDeleteEvent = (id: string) => {
    Alert.alert(
      'Excluir Evento',
      'Tem certeza de que deseja excluir este evento? As transações vinculadas continuarão registradas normalmente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const repo = new BudgetRepository();
            await repo.deleteEvent(id);
            await loadEvents();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: ListRenderItemInfo<EventBudgetProgress>) => {
    const pct = Math.min(100, Math.max(0, item.percentageSpent));
    const barColor = item.isExceeded
      ? '#EF4444'
      : item.isWarning
        ? '#F59E0B'
        : '#10B981';

    const statusBadge = item.isExceeded
      ? { label: 'Excedido', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.16)' }
      : item.isWarning
        ? { label: 'Atenção (>80%)', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)' }
        : { label: 'Dentro do Teto', color: '#10B981', bg: 'rgba(16, 185, 129, 0.16)' };

    const remaining = Math.max(0, item.event.limit_value - item.spentValue);

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventTopRow}>
          <View style={styles.eventIconBox}>
            <Feather name="bookmark" size={18} color="#60A5FA" />
          </View>
          <View style={styles.eventInfo}>
            <View style={styles.eventTitleRow}>
              <Text style={styles.eventName} numberOfLines={1}>
                {item.event.name}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                  {statusBadge.label}
                </Text>
              </View>
            </View>
            <View style={styles.eventDateRow}>
              <Feather name="calendar" size={12} color="#94A3B8" />
              <Text style={styles.eventDates}>
                {item.event.start_date} até {item.event.end_date} • {item.transactions.length} gasto(s)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteEvent(item.event.id)}
            activeOpacity={0.7}>
            <Feather name="trash-2" size={15} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${pct}%`, backgroundColor: barColor },
              ]}
            />
          </View>
        </View>

        <View style={styles.eventBottomRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Gasto Realizado</Text>
            <Text style={[styles.statValue, { color: barColor }]}>
              {formatCurrency(item.spentValue)} <Text style={styles.statPct}>({item.percentageSpent}%)</Text>
            </Text>
          </View>
          <View style={[styles.statCol, styles.statColRight]}>
            <Text style={styles.statLabel}>
              {item.isExceeded ? 'Excedido em' : 'Restante'}
            </Text>
            <Text style={styles.statValue}>
              {formatCurrency(item.isExceeded ? item.spentValue - item.event.limit_value : remaining)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Orçamento por Evento</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.event.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Feather name="compass" size={18} color="#60A5FA" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Novo Evento Especial</Text>
                <Text style={styles.cardHint}>
                  Acompanhe gastos de viagens, reformas ou ocasiões sem afetar o limite das categorias.
                </Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nome do Evento</Text>
              <View style={styles.inputBox}>
                <Feather name="bookmark" size={16} color="#60A5FA" />
                <TextInput
                  style={styles.inputText}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Viagem Férias, Reforma, Casamento"
                  placeholderTextColor="#64748B"
                  selectionColor="#60A5FA"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Teto de Gastos do Evento</Text>
              <View style={styles.amountBox}>
                <Text style={styles.currencyPrefix}>R$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={limitText}
                  onChangeText={(t) => setLimitText(formatCurrencyInput(t))}
                  keyboardType="numeric"
                  placeholder="0,00"
                  placeholderTextColor="#64748B"
                  selectionColor="#60A5FA"
                />
              </View>
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>Data de Início</Text>
                <View style={styles.inputBox}>
                  <Feather name="calendar" size={16} color="#60A5FA" />
                  <TextInput
                    style={styles.inputText}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#64748B"
                    selectionColor="#60A5FA"
                  />
                </View>
              </View>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>Data de Término</Text>
                <View style={styles.inputBox}>
                  <Feather name="calendar" size={16} color="#60A5FA" />
                  <TextInput
                    style={styles.inputText}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#64748B"
                    selectionColor="#60A5FA"
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleCreateEvent}
              activeOpacity={0.85}>
              <Feather name="plus-circle" size={18} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Criar Orçamento de Evento</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color="#2563EB" style={{ marginTop: 24 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Feather name="calendar" size={28} color="#475569" />
              </View>
              <Text style={styles.emptyTitle}>Nenhum evento cadastrado</Text>
              <Text style={styles.emptySubtitle}>
                Cadastre um evento acima para acompanhar os gastos em tempo real com teto exclusivo.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  navTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  navPlaceholder: { width: 38 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 14,
    marginBottom: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardHeaderText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cardHint: { color: '#94A3B8', fontSize: 12, lineHeight: 17 },
  cardDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  inputBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
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
  amountBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#60A5FA',
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    gap: 6,
  },
  createBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  eventCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  eventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eventDates: {
    color: '#94A3B8',
    fontSize: 11,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    gap: 6,
  },
  progressTrack: {
    height: 7,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  eventBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
  },
  statCol: {
    gap: 2,
  },
  statColRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statPct: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
