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
import { ConfirmacaoDuplaOptions } from './types';

interface DoubleConfirmDialogViewProps {
  visible: boolean;
  options: ConfirmacaoDuplaOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DoubleConfirmDialogView: React.FC<DoubleConfirmDialogViewProps> = ({
  visible,
  options,
  onConfirm,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  if (!visible) return null;

  const handleStep1Confirm = () => {
    setStep(2);
  };

  const handleStep2Confirm = () => {
    setStep(1);
    onConfirm();
  };

  const handleCancel = () => {
    setStep(1);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
      accessibilityRole="alert"
    >
      <Pressable style={styles.backdrop}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {step === 1 ? (
            <>
              <View style={[styles.iconCircle, styles.iconWarning]}>
                <Feather name="alert-triangle" size={30} color="#F59E0B" />
              </View>

              <Text style={styles.title}>
                {options.tituloPasso1 ?? 'Atenção: Ação Irreversível'}
              </Text>
              <Text style={styles.message}>{options.mensagemPasso1}</Text>

              {options.detalheDestaque ? (
                <View style={styles.detailBox}>
                  <Text style={styles.detailText}>{options.detalheDestaque}</Text>
                </View>
              ) : null}

              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryBtnText}>
                    {options.rotuloCancelar ?? 'Cancelar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#F59E0B' }]}
                  onPress={handleStep1Confirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    {options.rotuloConfirmarPasso1 ?? 'Continuar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.iconCircle, styles.iconDanger]}>
                <Feather name="trash-2" size={32} color="#EF4444" />
              </View>

              <Text style={styles.title}>
                {options.tituloPasso2 ?? 'Confirmação Final'}
              </Text>

              <View style={styles.dangerAlertBox}>
                <Feather name="alert-octagon" size={20} color="#EF4444" />
                <Text style={styles.dangerAlertText}>
                  Esta ação não pode ser desfeita após a confirmação.
                </Text>
              </View>

              <Text style={styles.message}>{options.mensagemPasso2}</Text>

              <View style={styles.actionsCol}>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.dangerBtn]}
                  onPress={handleStep2Confirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    {options.rotuloConfirmarPasso2 ?? 'Sim, Excluir Definitivamente'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelLinkBtn}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelLinkText}>Cancelar e voltar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
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
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  iconDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  detailBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 20,
  },
  detailText: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  dangerAlertBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    padding: 12,
    marginBottom: 16,
  },
  dangerAlertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  actionsCol: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
  primaryBtn: {
    flex: 1.2,
    minHeight: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: {
    width: '100%',
    backgroundColor: '#F87171',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelLinkBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
