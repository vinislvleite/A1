import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  singleButton?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  description,
  confirmText = 'Excluir',
  cancelText = 'Cancelar',
  icon,
  variant = 'danger',
  isLoading = false,
  singleButton = false,
  onConfirm,
  onCancel = () => {},
}) => {
  const getThemeProps = () => {
    switch (variant) {
      case 'warning':
        return {
          defaultIcon: 'alert-triangle' as keyof typeof Feather.glyphMap,
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.25)',
          btnBg: '#F59E0B',
        };
      case 'primary':
        return {
          defaultIcon: 'check-circle' as keyof typeof Feather.glyphMap,
          color: '#3B82F6',
          bg: 'rgba(37, 99, 235, 0.12)',
          border: 'rgba(37, 99, 235, 0.25)',
          btnBg: '#2563EB',
        };
      case 'danger':
      default:
        return {
          defaultIcon: 'trash-2' as keyof typeof Feather.glyphMap,
          color: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.25)',
          btnBg: '#EF4444',
        };
    }
  };

  const theme = getThemeProps();
  const iconName = icon ?? theme.defaultIcon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.bg, borderColor: theme.border },
            ]}
          >
            <Feather name={iconName} size={30} color={theme.color} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.buttonRow}>
            {!singleButton && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: theme.btnBg }]}
              onPress={onConfirm}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather
                    name={iconName}
                    size={15}
                    color="#FFFFFF"
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.confirmText}>{confirmText}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonIcon: {
    marginRight: 6,
  },
});
