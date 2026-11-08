import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PermissionExplanationOptions } from './types';

interface PermissionExplanationDialogViewProps {
  visible: boolean;
  options: PermissionExplanationOptions;
  onFinish: (granted: boolean) => void;
}

export const PermissionExplanationDialogView: React.FC<
  PermissionExplanationDialogViewProps
> = ({ visible, options, onFinish }) => {
  const [deniedState, setDeniedState] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  if (!visible) return null;

  const handleProceed = async () => {
    try {
      setIsRequesting(true);
      const granted = await options.aoPermitir();
      if (granted) {
        setDeniedState(false);
        onFinish(true);
      } else {
        setDeniedState(true);
      }
    } catch {
      setDeniedState(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {}
    setDeniedState(false);
    onFinish(false);
  };

  const handleCancel = () => {
    setDeniedState(false);
    onFinish(false);
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
          {!deniedState ? (
            <>
              <View style={styles.iconCircle}>
                <Feather
                  name={options.icone ?? 'shield'}
                  size={30}
                  color="#60A5FA"
                />
              </View>

              <Text style={styles.title}>{options.titulo}</Text>
              <Text style={styles.message}>{options.mensagem}</Text>

              {options.motivo ? (
                <View style={styles.reasonCard}>
                  <Feather name="info" size={16} color="#60A5FA" />
                  <Text style={styles.reasonText}>{options.motivo}</Text>
                </View>
              ) : null}

              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                  disabled={isRequesting}
                >
                  <Text style={styles.secondaryBtnText}>
                    {options.rotuloCancelar ?? 'Agora não'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleProceed}
                  activeOpacity={0.85}
                  disabled={isRequesting}
                >
                  <Text style={styles.primaryBtnText}>
                    {options.rotuloConfirmar ?? 'Continuar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.iconCircle, styles.iconDenied]}>
                <Feather name="settings" size={30} color="#F59E0B" />
              </View>

              <Text style={styles.title}>Permissão Necessária</Text>
              <Text style={styles.message}>
                Para utilizar este recurso, é necessário conceder a permissão nas configurações do seu celular.
              </Text>

              <View style={styles.actionsCol}>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.primaryBtnFull]}
                  onPress={handleOpenSettings}
                  activeOpacity={0.85}
                >
                  <Feather name="external-link" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Abrir Configurações</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelLinkBtn}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelLinkText}>Cancelar</Text>
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
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: 'rgba(37, 99, 235, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconDenied: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
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
    marginBottom: 18,
  },
  reasonCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 20,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
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
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnFull: {
    width: '100%',
    flexDirection: 'row',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelLinkBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
