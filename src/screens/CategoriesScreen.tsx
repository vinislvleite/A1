import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  StatusBar,
  ScrollView,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { Category } from '../domain/entities/Category';
import { ConfirmModal } from '../components/ConfirmModal';
import { dialog } from '../components/dialogs';

const AVAILABLE_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#2563EB',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#D946EF',
  '#EC4899',
  '#F43F5E',
  '#FB7185',
  '#A3E635',
  '#38BDF8',
  '#C084FC',
  '#94A3B8',
  '#64748B',
];

const AVAILABLE_ICONS: (keyof typeof Feather.glyphMap)[] = [
  'coffee',
  'shopping-bag',
  'shopping-cart',
  'package',
  'navigation',
  'truck',
  'map-pin',
  'compass',
  'send',
  'globe',
  'home',
  'key',
  'tool',
  'tv',
  'wifi',
  'zap',
  'phone',
  'smartphone',
  'film',
  'music',
  'camera',
  'headphones',
  'smile',
  'feather',
  'sun',
  'moon',
  'star',
  'activity',
  'heart',
  'shield',
  'umbrella',
  'book',
  'book-open',
  'briefcase',
  'award',
  'clipboard',
  'file-text',
  'layers',
  'dollar-sign',
  'credit-card',
  'tag',
  'gift',
  'percent',
  'trending-up',
  'trending-down',
  'pie-chart',
  'user',
  'users',
  'bell',
  'calendar',
  'clock',
  'grid',
];

const mapCategoryIcon = (iconName: string): keyof typeof Feather.glyphMap => {
  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    shopping: 'shopping-bag',
    'shopping-bag': 'shopping-bag',
  };
  if (iconMap[iconName]) return iconMap[iconName];
  if (AVAILABLE_ICONS.includes(iconName as keyof typeof Feather.glyphMap)) {
    return iconName as keyof typeof Feather.glyphMap;
  }
  return 'tag';
};

export function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryColor, setCategoryColor] = useState(AVAILABLE_COLORS[0]);
  const [categoryIcon, setCategoryIcon] = useState<keyof typeof Feather.glyphMap>(AVAILABLE_ICONS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [blockedActionMessage, setBlockedActionMessage] = useState<string | null>(null);

  const categoryRepo = new CategoryRepository();

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await categoryRepo.findAll();
      setCategories(list);
    } catch {
      dialog.alerta({ titulo: 'Erro', mensagem: 'Falha ao carregar categorias.', tipo: 'erro' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryColor(AVAILABLE_COLORS[0]);
    setCategoryIcon(AVAILABLE_ICONS[0]);
    setModalVisible(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDescription(cat.description ?? '');
    setCategoryColor(cat.color || AVAILABLE_COLORS[0]);
    setCategoryIcon((cat.icon as keyof typeof Feather.glyphMap) || AVAILABLE_ICONS[0]);
    setModalVisible(true);
  };

  const handleOpenCategoryHistory = (cat: Category) => {
    router.push({
      pathname: '/category-history',
      params: { id: cat.id },
    } as unknown as Parameters<typeof router.push>[0]);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      dialog.alerta({ titulo: 'Atenção', mensagem: 'Informe o nome da categoria.', tipo: 'atencao' });
      return;
    }

    setIsSaving(true);
    try {
      const cleanDesc = categoryDescription.trim().slice(0, 140) || undefined;
      if (editingCategory) {
        await categoryRepo.update(editingCategory.id, {
          name: categoryName.trim(),
          description: cleanDesc,
          color: categoryColor,
          icon: categoryIcon,
        });
      } else {
        await categoryRepo.create({
          name: categoryName.trim(),
          description: cleanDesc,
          color: categoryColor,
          icon: categoryIcon,
          is_custom: true,
        });
      }

      setModalVisible(false);
      await loadCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar categoria.';
      dialog.alerta({ titulo: 'Erro', mensagem: message, tipo: 'erro' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    try {
      const txCount = await categoryRepo.countTransactionsByCategoryId(cat.id);
      if (txCount > 0) {
        setBlockedActionMessage(
          `Não é possível excluir esta categoria porque ela possui ${txCount} transação(ões) vinculada(s). Exclua ou altere as transações antes de remover a categoria.`
        );
        return;
      }

      setCategoryToDelete(cat);
    } catch {
      dialog.alerta({
        titulo: 'Erro',
        mensagem: 'Não foi possível verificar as transações associadas.',
        tipo: 'erro',
      });
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    try {
      await categoryRepo.delete(categoryToDelete.id);
      setCategoryToDelete(null);
      loadCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao excluir categoria.';
      dialog.alerta({ titulo: 'Erro', mensagem: message, tipo: 'erro' });
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Category>) => (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        testID={`category-card-${item.id}`}
        style={styles.categoryCard}
        activeOpacity={0.75}
        onPress={() => openEditModal(item)}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconChip, { backgroundColor: `${item.color}25` }]}>
            <Feather
              name={mapCategoryIcon(item.icon)}
              size={18}
              color={item.color || '#60A5FA'}
            />
          </View>
          <View style={styles.catTextGroup}>
            <Text style={styles.catNameText}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.catDescText} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => handleOpenCategoryHistory(item)}>
            <Feather name="bar-chart-2" size={15} color="#60A5FA" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => openEditModal(item)}>
            <Feather name="edit-2" size={15} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => handleDelete(item)}>
            <Feather name="trash-2" size={15} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Categorias</Text>
        <TouchableOpacity
          style={styles.navAddBtn}
          onPress={openCreateModal}
          activeOpacity={0.7}>
          <Feather name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando categorias...</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={40} color="#64748B" />
              <Text style={styles.emptyTitle}>Nenhuma categoria cadastrada</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled">
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nome da Categoria</Text>
                <View style={styles.inputBox}>
                  <Feather name="tag" size={16} color="#60A5FA" />
                  <TextInput
                    style={styles.textInput}
                    value={categoryName}
                    onChangeText={setCategoryName}
                    placeholder="Ex: Assinaturas, Mercado"
                    placeholderTextColor="#64748B"
                    maxLength={30}
                    autoCapitalize="words"
                    selectionColor="#60A5FA"
                    returnKeyType="done"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
                  <Text style={styles.charCountText}>{categoryDescription.length}/140</Text>
                </View>
                <View style={[styles.inputBox, styles.descriptionInputBox]}>
                  <Feather name="align-left" size={16} color="#60A5FA" />
                  <TextInput
                    testID="category-description-input"
                    style={styles.textInput}
                    value={categoryDescription}
                    onChangeText={(t) => setCategoryDescription(t.slice(0, 140))}
                    placeholder="Supermercado, restaurantes"
                    placeholderTextColor="#64748B"
                    maxLength={140}
                    selectionColor="#60A5FA"
                    returnKeyType="done"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Cor</Text>
                <View style={styles.paletteRow}>
                  {AVAILABLE_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorChip,
                        { backgroundColor: c },
                        categoryColor === c ? styles.colorChipSelected : null,
                      ]}
                      onPress={() => setCategoryColor(c)}
                      activeOpacity={0.8}>
                      {categoryColor === c ? (
                        <Feather name="check" size={16} color="#FFFFFF" />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Ícone</Text>
                <View style={styles.iconsGrid}>
                  {AVAILABLE_ICONS.map((i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.iconOption,
                        categoryIcon === i ? styles.iconOptionSelected : null,
                      ]}
                      onPress={() => setCategoryIcon(i)}
                      activeOpacity={0.8}>
                      <Feather
                        name={i}
                        size={20}
                        color={categoryIcon === i ? '#60A5FA' : '#94A3B8'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnSaveModal}
                disabled={isSaving}
                onPress={handleSave}
                activeOpacity={0.85}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnSaveModalText}>
                    {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnCancelModal}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}>
                <Text style={styles.btnCancelModalText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      <ConfirmModal
        visible={Boolean(categoryToDelete)}
        title="Excluir Categoria"
        description={`Deseja realmente excluir a categoria "${categoryToDelete?.name}"?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingCategory}
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => setCategoryToDelete(null)}
      />
      <ConfirmModal
        visible={Boolean(blockedActionMessage)}
        title="Ação Bloqueada"
        description={blockedActionMessage ?? ''}
        confirmText="Entendido"
        variant="warning"
        icon="alert-circle"
        singleButton
        onConfirm={() => setBlockedActionMessage(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  cardWrapper: {
    marginBottom: 10,
  },
  categoryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTextGroup: {
    flex: 1,
  },
  catNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  catDescText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    maxHeight: '88%',
    padding: 20,
    gap: 14,
  },
  modalScrollContent: {
    gap: 14,
    paddingBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  charCountText: {
    fontSize: 11,
    color: '#64748B',
  },
  inputBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  descriptionInputBox: {
    height: 44,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  colorChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChipSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    borderColor: '#60A5FA',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  modalActions: {
    marginTop: 6,
    gap: 8,
  },
  btnSaveModal: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnCancelModal: {
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelModalText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
});
