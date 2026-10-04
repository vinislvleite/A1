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

export interface DeleteTransactionData {
  id: string;
  description: string;
  value: number;
  type: 'receita' | 'despesa';
  accountName?: string;
  categoryName?: string;
  date?: string;
}

export interface DeleteTransactionModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  transaction?: DeleteTransactionData | null;
}

const formatCurrency = (val: number): string =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const [datePart] = isoString.split('T');
    const [year, month, day] = datePart.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
  } catch {
    return isoString;
  }
  return isoString;
};

export const DeleteTransactionModal: React.FC<DeleteTransactionModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  isLoading = false,
  transaction,
}) => {
  const isExpense = transaction?.type === 'despesa';
  const formattedValue = transaction
    ? `${isExpense ? '- ' : '+ '}${formatCurrency(transaction.value)}`
    : '';

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
            <Feather name="trash-2" size={32} color="#EF4444" />
          </View>

          <Text style={styles.title}>Excluir Transação</Text>
          <Text style={styles.description}>
            Tem certeza de que deseja excluir esta movimentação? Esta ação não pode ser desfeita.
          </Text>

          {transaction ? (
            <View style={styles.detailsBox}>
              <View style={styles.detailsHeader}>
                <Text style={styles.descriptionText} numberOfLines={1}>
                  {transaction.description}
                </Text>
                <Text
                  style={[
                    styles.valueText,
                    { color: isExpense ? '#F87171' : '#10B981' },
                  ]}
                >
                  {formattedValue}
                </Text>
              </View>

              <View style={styles.metaRow}>
                {transaction.categoryName ? (
                  <View style={styles.tagBadge}>
                    <Feather name="tag" size={12} color="#94A3B8" />
                    <Text style={styles.tagText}>{transaction.categoryName}</Text>
                  </View>
                ) : null}

                {transaction.accountName ? (
                  <View style={styles.tagBadge}>
                    <Feather name="credit-card" size={12} color="#94A3B8" />
                    <Text style={styles.tagText}>{transaction.accountName}</Text>
                  </View>
                ) : null}

                {transaction.date ? (
                  <View style={styles.tagBadge}>
                    <Feather name="calendar" size={12} color="#94A3B8" />
                    <Text style={styles.tagText}>{formatDate(transaction.date)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.warningBox}>
            <Feather name="alert-triangle" size={14} color="#F59E0B" />
            <Text style={styles.warningText}>
              O saldo da conta e os orçamentos mensais serão recalculados automaticamente.
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isLoading}
              activeOpacity={0.7}
              testID="cancel-delete-button"
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={onConfirm}
              disabled={isLoading}
              activeOpacity={0.8}
              testID="confirm-delete-button"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="trash-2" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.deleteText}>Excluir</Text>
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
    maxWidth: 380,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  title: {
    fontSize: 20,
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
    marginBottom: 16,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 14,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 8,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 8,
    width: '100%',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#FCD34D',
    flex: 1,
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
  deleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonIcon: {
    marginRight: 6,
  },
});
