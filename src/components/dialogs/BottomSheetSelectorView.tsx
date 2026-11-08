import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheetSelectorOptions } from './types';

interface BottomSheetSelectorViewProps {
  visible: boolean;
  options: BottomSheetSelectorOptions<string>;
  onSelect: (id: string | null) => void;
}

export const BottomSheetSelectorView: React.FC<BottomSheetSelectorViewProps> = ({
  visible,
  options,
  onSelect,
}) => {
  const [selected, setSelected] = useState<string | undefined>(
    options.valorSelecionado
  );
  const [search, setSearch] = useState('');

  if (!visible) return null;

  const filtered = options.opcoes.filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      item.label.toLowerCase().includes(term) ||
      (item.sublabel && item.sublabel.toLowerCase().includes(term))
    );
  });

  const handleConfirm = () => {
    onSelect(selected ?? null);
  };

  const handleCancel = () => {
    onSelect(null);
  };

  const confirmText = options.rotuloConfirmar ?? 'Selecionar';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.title}>{options.titulo}</Text>
              {options.descricao ? (
                <Text style={styles.description}>{options.descricao}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {options.opcoes.length > 6 ? (
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar opção..."
                placeholderTextColor="#64748B"
                selectionColor="#60A5FA"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x" size={14} color="#64748B" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            style={styles.optionsList}
            contentContainerStyle={styles.optionsListContent}
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((item) => {
              const isSelected = selected === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionItem,
                    isSelected ? styles.optionItemSelected : null,
                  ]}
                  onPress={() => setSelected(item.id)}
                  activeOpacity={0.7}
                >
                  {item.icon ? (
                    <View
                      style={[
                        styles.iconWrap,
                        {
                          backgroundColor: item.color
                            ? `${item.color}22`
                            : 'rgba(37, 99, 235, 0.15)',
                        },
                      ]}
                    >
                      <Feather
                        name={item.icon}
                        size={18}
                        color={item.color ?? '#60A5FA'}
                      />
                    </View>
                  ) : null}

                  <View style={styles.optionTextCol}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected ? styles.optionLabelSelected : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={styles.optionSublabel}>{item.sublabel}</Text>
                    ) : null}
                  </View>

                  {item.badge ? (
                    <View style={styles.badgeWrap}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.radioCircle,
                      isSelected ? styles.radioCircleSelected : null,
                    ]}
                  >
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
              disabled={!selected}
            >
              <Text style={styles.confirmBtnText}>{confirmText}</Text>
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
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#334155',
    maxHeight: '80%',
    paddingBottom: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  optionsList: {
    paddingHorizontal: 20,
  },
  optionsListContent: {
    gap: 8,
    paddingBottom: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  optionItemSelected: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionLabelSelected: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  optionSublabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  badgeWrap: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#2563EB',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  confirmBtn: {
    height: 54,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
