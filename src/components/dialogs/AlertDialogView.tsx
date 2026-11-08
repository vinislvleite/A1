import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ConfirmOptions, AlertaOptions } from './types';

interface AlertDialogViewProps {
  visible: boolean;
  isConfirm: boolean;
  confirmOptions?: ConfirmOptions;
  alertaOptions?: AlertaOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AlertDialogView: React.FC<AlertDialogViewProps> = ({
  visible,
  isConfirm,
  confirmOptions,
  alertaOptions,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const isDanger = isConfirm && confirmOptions?.variante === 'perigo';
  const isWarning =
    (isConfirm && confirmOptions?.variante === 'atencao') ||
    (!isConfirm && alertaOptions?.tipo === 'atencao');
  const isSuccess = !isConfirm && alertaOptions?.tipo === 'sucesso';
  const isError = !isConfirm && alertaOptions?.tipo === 'erro';

  let iconName: keyof typeof Feather.glyphMap = 'info';
  let iconColor = '#3B82F6';
  let iconBg = 'rgba(37, 99, 235, 0.15)';
  let iconBorder = 'rgba(37, 99, 235, 0.3)';
  let primaryBtnBg = '#2563EB';

  if (isDanger || isError) {
    iconName = isDanger ? 'trash-2' : 'alert-circle';
    iconColor = '#EF4444';
    iconBg = 'rgba(239, 68, 68, 0.15)';
    iconBorder = 'rgba(239, 68, 68, 0.3)';
    primaryBtnBg = '#F87171';
  } else if (isWarning) {
    iconName = 'alert-triangle';
    iconColor = '#F59E0B';
    iconBg = 'rgba(245, 158, 11, 0.15)';
    iconBorder = 'rgba(245, 158, 11, 0.3)';
    primaryBtnBg = '#F59E0B';
  } else if (isSuccess) {
    iconName = 'check-circle';
    iconColor = '#10B981';
    iconBg = 'rgba(16, 185, 129, 0.15)';
    iconBorder = 'rgba(16, 185, 129, 0.3)';
    primaryBtnBg = '#10B981';
  }

  const customIcon = isConfirm ? confirmOptions?.icone : alertaOptions?.icone;
  if (customIcon) {
    iconName = customIcon;
  }

  const title = isConfirm ? confirmOptions?.titulo ?? '' : alertaOptions?.titulo ?? '';
  const message = isConfirm ? confirmOptions?.mensagem ?? '' : alertaOptions?.mensagem ?? '';
  const confirmText = isConfirm
    ? confirmOptions?.rotuloConfirmar ?? (isDanger ? 'Excluir' : 'Confirmar')
    : alertaOptions?.rotuloBotao ?? 'OK';
  const cancelText = confirmOptions?.rotuloCancelar ?? 'Cancelar';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
      accessibilityRole="alert"
    >
      <Pressable
        style={styles.backdrop}
        onPress={isDanger ? undefined : onCancel}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: iconBg, borderColor: iconBorder },
            ]}
          >
            <Feather name={iconName} size={30} color={iconColor} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actionsContainer}>
            {isConfirm && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onCancel}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text style={styles.secondaryBtnText}>{cancelText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: primaryBtnBg },
                !isConfirm && styles.primaryBtnFull,
              ]}
              onPress={onConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              <Text style={styles.primaryBtnText}>{confirmText}</Text>
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
    marginBottom: 24,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
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
  primaryBtnFull: {
    flex: 1,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
