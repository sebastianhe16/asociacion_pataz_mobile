import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  Almacen,
  NuevaOrdenCompraInput,
  OrdenCompraItem,
  PrioridadOrdenCompra,
  ProyectoCampoResumen,
} from '../core/types';
import type { UsuarioSesion } from '../core/types/auth';
import { colors, spacing } from '../core/theme';
import {
  createPurchaseOrder,
  getAllInventoryItems,
  getProjectSummaries,
  getWarehouses,
  type InventoryItem,
} from '../database/db';

interface OrderItemDraft {
  id: string;
  insumoId: string | null;
  nombre: string;
  cantidad: string;
  unidad: string;
  isCatalogPickerOpen: boolean;
}

interface NuevaOrdenCompraModalProps {
  visible: boolean;
  user: UsuarioSesion;
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITIES: PrioridadOrdenCompra[] = ['NORMAL', 'ALTA', 'URGENTE'];

function createEmptyItem(): OrderItemDraft {
  return {
    id: Crypto.randomUUID(),
    insumoId: null,
    nombre: '',
    cantidad: '',
    unidad: 'unidad',
    isCatalogPickerOpen: false,
  };
}

export default function NuevaOrdenCompraModal({
  visible,
  user,
  onClose,
  onCreated,
}: NuevaOrdenCompraModalProps) {
  const [projects, setProjects] = useState<ProyectoCampoResumen[]>([]);
  const [warehouses, setWarehouses] = useState<Almacen[]>([]);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [priority, setPriority] = useState<PrioridadOrdenCompra>('NORMAL');
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState<OrderItemDraft[]>([createEmptyItem()]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let active = true;
    Promise.all([getProjectSummaries(), getWarehouses(), getAllInventoryItems()])
      .then(([projectRows, warehouseRows, catalogRows]) => {
        if (active) {
          setProjects(projectRows);
          setWarehouses(warehouseRows);
          setCatalog(catalogRows);
          setProjectId((current) => current || projectRows[0]?.id || '');
          setWarehouseId((current) => current || warehouseRows[0]?.id || '');
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos locales.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const selectedProject = projects.find((project) => project.id === projectId);
  const filteredCatalog = useMemo(
    () => catalog.filter((item) => item.almacenId === warehouseId),
    [catalog, warehouseId],
  );

  function updateItem(itemId: string, updates: Partial<OrderItemDraft>) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    );
  }

  function selectCatalogItem(draft: OrderItemDraft, catalogItem: InventoryItem) {
    updateItem(draft.id, {
      insumoId: catalogItem.id,
      nombre: catalogItem.nombre,
      unidad: catalogItem.unidad,
      isCatalogPickerOpen: false,
    });
  }

  async function submit() {
    setError(null);
    const parsedItems: OrdenCompraItem[] = items.map((item) => ({
      insumoId: item.insumoId,
      nombre: item.nombre.trim(),
      cantidad: Number(item.cantidad.replace(',', '.')),
      unidad: item.unidad.trim(),
    }));
    if (!projectId || !warehouseId) {
      setError('Selecciona el proyecto y el almacén de destino.');
      return;
    }
    if (parsedItems.some((item) => !item.nombre || !item.unidad || !Number.isFinite(item.cantidad) || item.cantidad <= 0)) {
      setError('Completa cada material con nombre, unidad y cantidad mayor que cero.');
      return;
    }

    const input: NuevaOrdenCompraInput = {
      proyectoId: projectId,
      almacenDestinoId: warehouseId,
      prioridad: priority,
      justificacion: justification,
      items: parsedItems,
    };
    setIsSaving(true);
    try {
      await createPurchaseOrder(input, user);
      setItems([createEmptyItem()]);
      setJustification('');
      setPriority('NORMAL');
      setError(null);
      onCreated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo registrar la orden.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>REQUERIMIENTO LOCAL</Text>
              <Text style={styles.title}>Nueva orden de compra</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.helper}>Cargando proyectos y almacenes…</Text>
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>Proyecto *</Text>
                  <View style={styles.choiceList}>
                    {projects.map((project) => (
                      <ChoiceButton
                        key={project.id}
                        label={project.nombre}
                        detail={`${project.eje} · ${project.caserio}`}
                        selected={project.id === projectId}
                        onPress={() => setProjectId(project.id)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Almacén de destino *</Text>
                  <View style={styles.chipRow}>
                    {warehouses.map((warehouse) => (
                      <Pressable
                        key={warehouse.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: warehouse.id === warehouseId }}
                        onPress={() => {
                          setWarehouseId(warehouse.id);
                          setItems((current) =>
                            current.map((item) => ({
                              ...item,
                              insumoId: null,
                              nombre: '',
                              unidad: 'unidad',
                              isCatalogPickerOpen: false,
                            })),
                          );
                        }}
                        style={[styles.chip, warehouse.id === warehouseId && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, warehouse.id === warehouseId && styles.chipTextSelected]}>
                          {warehouse.nombre}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.label}>Materiales solicitados *</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setItems((current) => [...current, createEmptyItem()])}
                      style={styles.addButton}
                    >
                      <MaterialCommunityIcons name="plus" size={17} color={colors.primary} />
                      <Text style={styles.addButtonText}>Agregar</Text>
                    </Pressable>
                  </View>
                  {items.map((item, index) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>Material {index + 1}</Text>
                        {items.length > 1 && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Eliminar material ${index + 1}`}
                            onPress={() => setItems((current) => current.filter(({ id }) => id !== item.id))}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.error} />
                          </Pressable>
                        )}
                      </View>
                      <View style={styles.materialModeRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => updateItem(item.id, { isCatalogPickerOpen: !item.isCatalogPickerOpen })}
                          style={styles.materialModeButton}
                        >
                          <MaterialCommunityIcons name="archive-search-outline" size={18} color={colors.primary} />
                          <Text style={styles.materialModeText}>
                            {item.insumoId ? 'Cambiar del catálogo' : 'Elegir del catálogo'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            updateItem(item.id, {
                              insumoId: null,
                              nombre: '',
                              unidad: '',
                              isCatalogPickerOpen: false,
                            })
                          }
                          style={styles.customModeButton}
                        >
                          <Text style={styles.customModeText}>Personalizado</Text>
                        </Pressable>
                      </View>
                      {item.isCatalogPickerOpen && (
                        <View style={styles.catalogList}>
                          {filteredCatalog.map((catalogItem) => (
                            <Pressable
                              key={catalogItem.id}
                              accessibilityRole="button"
                              onPress={() => selectCatalogItem(item, catalogItem)}
                              style={styles.catalogOption}
                            >
                              <View style={styles.catalogCopy}>
                                <Text style={styles.catalogName}>{catalogItem.nombre}</Text>
                                <Text style={styles.helper}>{catalogItem.codigo} · Disponible {catalogItem.stockActual} {catalogItem.unidad}</Text>
                              </View>
                              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                            </Pressable>
                          ))}
                          {filteredCatalog.length === 0 && (
                            <Text style={styles.helper}>No hay insumos catalogados en esta sede.</Text>
                          )}
                        </View>
                      )}
                      <TextInput
                        accessibilityLabel={`Nombre del material ${index + 1}`}
                        value={item.nombre}
                        onChangeText={(nombre) => updateItem(item.id, { nombre, insumoId: null })}
                        placeholder="Nombre del material"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.input}
                        editable={!item.insumoId}
                      />
                      <View style={styles.itemNumbers}>
                        <TextInput
                          accessibilityLabel={`Cantidad del material ${index + 1}`}
                          value={item.cantidad}
                          onChangeText={(cantidad) => updateItem(item.id, { cantidad: cantidad.replace(/[^\d.,]/g, '') })}
                          placeholder="Cantidad"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.quantityInput]}
                        />
                        <TextInput
                          accessibilityLabel={`Unidad del material ${index + 1}`}
                          value={item.unidad}
                          onChangeText={(unidad) => updateItem(item.id, { unidad, insumoId: null })}
                          placeholder="Unidad"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.unitInput]}
                          editable={!item.insumoId}
                        />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Prioridad</Text>
                  <View style={styles.chipRow}>
                    {PRIORITIES.map((option) => (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected: option === priority }}
                        onPress={() => setPriority(option)}
                        style={[styles.chip, priority === option && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, priority === option && styles.chipTextSelected]}>
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Justificación técnica *</Text>
                  <TextInput
                    accessibilityLabel="Justificación técnica"
                    value={justification}
                    onChangeText={setJustification}
                    placeholder="Describe la necesidad del proyecto y el uso de los materiales."
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, styles.multilineInput]}
                    multiline
                    textAlignVertical="top"
                    maxLength={700}
                  />
                </View>
                {selectedProject && (
                  <Text style={styles.helper}>
                    Solicitante: {user.nombreCompleto} · Caserío: {selectedProject.caserio}
                  </Text>
                )}
              </>
            )}

            {error && (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={19} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={isLoading || isSaving}
              onPress={() => void submit()}
              style={[styles.submitButton, (isLoading || isSaving) && styles.disabledButton]}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.onPrimary} />
              )}
              <Text style={styles.submitButtonText}>
                {isSaving ? 'Guardando localmente…' : 'Enviar a aprobación'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ChoiceButton({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{label}</Text>
        <Text style={styles.helper}>{detail}</Text>
      </View>
      {selected && <MaterialCommunityIcons name="check-circle" size={19} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  section: { gap: 8 },
  label: { color: colors.text, fontSize: 13, fontWeight: '800' },
  choiceList: { gap: 7 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  choiceCopy: { flex: 1, gap: 3 },
  choiceTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  helper: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  chipTextSelected: { color: colors.onPrimary },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 4 },
  addButtonText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  itemCard: {
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  materialModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  materialModeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  materialModeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  customModeButton: { padding: 6, borderRadius: 8, backgroundColor: colors.background },
  customModeText: { color: colors.textSecondary, fontSize: 9, fontWeight: '700' },
  catalogList: { maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  catalogOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catalogCopy: { flex: 1, gap: 2 },
  catalogName: { color: colors.text, fontSize: 10, fontWeight: '700' },
  input: {
    minHeight: 44,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 12,
  },
  itemNumbers: { flexDirection: 'row', gap: 8 },
  quantityInput: { flex: 1 },
  unitInput: { flex: 1 },
  multilineInput: { minHeight: 100, paddingTop: 11 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.dangerBackground,
  },
  errorText: { flex: 1, color: colors.error, fontSize: 11, lineHeight: 16 },
  submitButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  disabledButton: { opacity: 0.6 },
  submitButtonText: { color: colors.onPrimary, fontSize: 13, fontWeight: '800' },
  loading: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 9 },
});
