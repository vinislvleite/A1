import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DatePickerOptions } from './types';
import {
  formatDate,
  formatMonthYear,
  fromIsoDate,
  toIsoDate,
  parseBrDate,
} from '../../utils/date';

interface DatePickerDialogViewProps {
  visible: boolean;
  options: DatePickerOptions;
  onSelect: (dateStr: string | null) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const parseInputDate = (input?: Date | string): Date => {
  if (!input) return new Date();
  if (input instanceof Date) return input;
  const brParsed = parseBrDate(input);
  if (brParsed.valid && brParsed.isoDate) {
    return fromIsoDate(brParsed.isoDate);
  }
  return fromIsoDate(input);
};

export const DatePickerDialogView: React.FC<DatePickerDialogViewProps> = ({
  visible,
  options,
  onSelect,
}) => {
  const initialDate = parseInputDate(options.dataInicial);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth() + 1);
  const [selectedYmd, setSelectedYmd] = useState(() => toIsoDate(initialDate));

  if (!visible) return null;

  const minDate = options.dataMinima ? parseInputDate(options.dataMinima) : null;
  const maxDate = options.dataMaxima ? parseInputDate(options.dataMaxima) : null;
  const minYmd = minDate ? toIsoDate(minDate) : null;
  const maxYmd = maxDate ? toIsoDate(maxDate) : null;

  const todayYmd = toIsoDate(new Date());

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  const days: { day: number; ymd: string; disabled: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let disabled = false;
    if (minYmd && ymd < minYmd) disabled = true;
    if (maxYmd && ymd > maxYmd) disabled = true;
    days.push({ day: d, ymd, disabled });
  }

  const handleConfirm = () => {
    onSelect(formatDate(selectedYmd));
  };

  const handleCancel = () => {
    onSelect(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.headerTitle}>
            {options.titulo ?? 'Selecione a Data'}
          </Text>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={handlePrevMonth}
              activeOpacity={0.7}
              accessibilityLabel="Mês anterior"
            >
              <Feather name="chevron-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.monthYearTitle}>
              {formatMonthYear(viewMonth, viewYear)}
            </Text>

            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={handleNextMonth}
              activeOpacity={0.7}
              accessibilityLabel="Próximo mês"
            >
              <Feather name="chevron-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((wd) => (
              <Text key={wd} style={styles.weekdayText}>
                {wd}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}

            {days.map((item) => {
              const isSelected = item.ymd === selectedYmd;
              const isToday = item.ymd === todayYmd;

              return (
                <TouchableOpacity
                  key={item.ymd}
                  style={[
                    styles.dayCell,
                    isSelected ? styles.dayCellSelected : null,
                    !isSelected && isToday ? styles.dayCellToday : null,
                    item.disabled ? styles.dayCellDisabled : null,
                  ]}
                  onPress={() => setSelectedYmd(item.ymd)}
                  disabled={item.disabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected ? styles.dayTextSelected : null,
                      !isSelected && isToday ? styles.dayTextToday : null,
                      item.disabled ? styles.dayTextDisabled : null,
                    ]}
                  >
                    {item.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>
                {options.rotuloCancelar ?? 'Cancelar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>
                {options.rotuloConfirmar ?? 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  navArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  weekdaysRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#2563EB',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#60A5FA',
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  dayTextSelected: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayTextToday: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#64748B',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
  confirmBtn: {
    flex: 1.2,
    minHeight: 54,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
