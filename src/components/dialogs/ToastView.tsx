import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ActiveToast } from './types';

interface ToastViewProps {
  toast: ActiveToast | null;
}

export const ToastView: React.FC<ToastViewProps> = ({ toast }) => {
  if (!toast) return null;

  let iconName: keyof typeof Feather.glyphMap = 'info';
  let iconColor = '#60A5FA';
  let borderColor = '#334155';

  if (toast.tipo === 'sucesso') {
    iconName = 'check-circle';
    iconColor = '#10B981';
    borderColor = 'rgba(16, 185, 129, 0.4)';
  } else if (toast.tipo === 'erro') {
    iconName = 'alert-circle';
    iconColor = '#EF4444';
    borderColor = 'rgba(239, 68, 68, 0.4)';
  }

  return (
    <View style={styles.toastContainer} pointerEvents="none">
      <View style={[styles.toastCard, { borderColor }]}>
        <Feather name={iconName} size={18} color={iconColor} />
        <Text style={styles.toastMessage}>{toast.mensagem}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 420,
    width: '100%',
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 19,
  },
});
