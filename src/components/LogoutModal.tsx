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

export interface LogoutModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  isLoading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="log-out" size={32} color="#EF4444" />
          </View>

          <Text style={styles.title}>Encerrar Sessão</Text>
          <Text style={styles.description}>
            Deseja realmente sair da sua conta? Seus dados continuam salvos e seguros localmente no seu dispositivo.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={onConfirm}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="log-out" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.logoutText}>Sim, Sair</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  logoutButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonIcon: {
    marginRight: 6,
  },
});
