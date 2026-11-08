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
import { TimePickerOptions } from './types';

interface TimePickerDialogViewProps {
  visible: boolean;
  options: TimePickerOptions;
  onSelect: (timeStr: string | null) => void;
}

export const TimePickerDialogView: React.FC<TimePickerDialogViewProps> = ({
  visible,
  options,
  onSelect,
}) => {
  const getInitialParts = (): [number, number] => {
    if (options.horaInicial && /^([01]\d|2[0-3]):[0-5]\d$/.test(options.horaInicial)) {
      const [h, m] = options.horaInicial.split(':').map(Number);
      return [h, m];
    }
    const d = new Date();
    return [d.getHours(), d.getMinutes()];
  };

  const [initialHours, initialMinutes] = getInitialParts();
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');

  if (!visible) return null;

  const handleAdjustHours = (delta: number) => {
    setHours((prev) => {
      const next = (prev + delta + 24) % 24;
      return next;
    });
  };

  const handleAdjustMinutes = (delta: number) => {
    setMinutes((prev) => {
      const next = (prev + delta + 60) % 60;
      return next;
    });
  };

  const handleSetNow = () => {
    const d = new Date();
    setHours(d.getHours());
    setMinutes(d.getMinutes());
  };

  const handleConfirm = () => {
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    onSelect(timeStr);
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
            {options.titulo ?? 'Selecione o Horário (24h)'}
          </Text>

          <View style={styles.timeDisplayRow}>
            <View style={styles.columnControls}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustHours(1)}
                activeOpacity={0.7}
              >
                <Feather name="chevron-up" size={24} color="#60A5FA" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeDigitBox,
                  mode === 'hours' ? styles.timeDigitBoxActive : null,
                ]}
                onPress={() => setMode('hours')}
                activeOpacity={0.8}
              >
                <Text style={styles.timeDigitText}>
                  {String(hours).padStart(2, '0')}
                </Text>
                <Text style={styles.digitSublabel}>Horas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustHours(-1)}
                activeOpacity={0.7}
              >
                <Feather name="chevron-down" size={24} color="#60A5FA" />
              </TouchableOpacity>
            </View>

            <Text style={styles.colonSeparator}>:</Text>

            <View style={styles.columnControls}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustMinutes(5)}
                activeOpacity={0.7}
              >
                <Feather name="chevron-up" size={24} color="#60A5FA" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeDigitBox,
                  mode === 'minutes' ? styles.timeDigitBoxActive : null,
                ]}
                onPress={() => setMode('minutes')}
                activeOpacity={0.8}
              >
                <Text style={styles.timeDigitText}>
                  {String(minutes).padStart(2, '0')}
                </Text>
                <Text style={styles.digitSublabel}>Minutos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustMinutes(-5)}
                activeOpacity={0.7}
              >
                <Feather name="chevron-down" size={24} color="#60A5FA" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.quickChipsRow}>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={handleSetNow}
              activeOpacity={0.75}
            >
              <Feather name="clock" size={13} color="#60A5FA" />
              <Text style={styles.quickChipText}>Agora</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleAdjustMinutes(15)}
              activeOpacity={0.75}
            >
              <Text style={styles.quickChipText}>+15 min</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleAdjustMinutes(30)}
              activeOpacity={0.75}
            >
              <Text style={styles.quickChipText}>+30 min</Text>
            </TouchableOpacity>
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
    padding: 24,
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
    marginBottom: 20,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  columnControls: {
    alignItems: 'center',
    gap: 8,
  },
  adjustBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigitBox: {
    width: 84,
    height: 84,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigitBoxActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  timeDigitText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  digitSublabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: -2,
  },
  colonSeparator: {
    fontSize: 36,
    fontWeight: '800',
    color: '#60A5FA',
    paddingBottom: 8,
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
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
