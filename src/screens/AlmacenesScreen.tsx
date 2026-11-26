import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  Almacen,
  CategoriaInsumo,
  OrigenMovimiento,
  TipoMovimiento,
  WarehouseMovementRecord,
} from '../core/types';
import { colors, spacing, typography } from '../core/theme';
import {
  findInventoryItemByCode,
  getAllInventoryItems,
  getInventoryByWarehouse,
  getRecentWarehouseMovements,
  getWarehouses,
  registerWarehouseMovement,
  type InventoryItem,
  type InventoryBalance,
} from '../database/db';
import SignaturePad from '../components/SignaturePad';
import ActaEntregaModal from './ActaEntregaModal';
import OrdenesCompraView from './OrdenesCompraView';
import { persistEvidencePhoto } from '../services/warehouse/evidencePhotoService';
import { useSyncStatus } from '../services/sync/SyncProvider';
import { useAuth } from '../services/auth/AuthProvider';
import { getInventoryBalances } from '../services/inventory/desbalanceService';
import TrackingEnvioModal from './TrackingEnvioModal';

type CategoryFilter = 'Todas' | CategoriaInsumo | 'Desbalances';

const CATEGORY_FILTERS: CategoryFilter[] = ['Todas', 'Agrícola', 'Salud', 'Educación', 'Desbalances'];

const categoryIcon: Record<CategoriaInsumo, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Agrícola: 'sprout',
  Salud: 'medical-bag',
  Educación: 'school-outline',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

export default function AlmacenesScreen() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Almacen[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('alm-lavasen');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryCatalog, setInventoryCatalog] = useState<InventoryItem[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [recentMovements, setRecentMovements] = useState<WarehouseMovementRecord[]>([]);
  const [loadedWarehouseId, setLoadedWarehouseId] = useState('');
  const [screenError, setScreenError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todas');
  const [movementOpen, setMovementOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<TipoMovimiento>('ENTRADA');
  const [entryOrigin, setEntryOrigin] = useState<OrigenMovimiento>('COMPRA');
  const [quantity, setQuantity] = useState('1');
  const [responsible, setResponsible] = useState('');
  const [destination, setDestination] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientDni, setRecipientDni] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [evidencePhotoUri, setEvidencePhotoUri] = useState<string | null>(null);
  const [signatureSvgPaths, setSignatureSvgPaths] = useState<string | null>(null);
  const [signatureRevision, setSignatureRevision] = useState(0);
  const [passportNotice, setPassportNotice] = useState<string | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [isHandlingPhoto, setIsHandlingPhoto] = useState(false);
  const [actaVisible, setActaVisible] = useState(false);
  const [actaMovement, setActaMovement] = useState<WarehouseMovementRecord | null>(null);
  const [trackingMovement, setTrackingMovement] = useState<WarehouseMovementRecord | null>(null);
  const [orderDeficitPrefill, setOrderDeficitPrefill] = useState<{
    insumoId: string;
    cantidad: number;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeView, setActiveView] = useState<'INVENTARIO' | 'ORDENES'>('INVENTARIO');
  const [permission, requestPermission] = useCameraPermissions();
  const scanHandled = useRef(false);
  const { pendingApprovalOrderCount, refreshPendingCount } = useSyncStatus();

  const selectedWarehouse = warehouses.find(({ id }) => id === selectedWarehouseId);
  const isLoading = loadedWarehouseId !== selectedWarehouseId;

  const loadInventory = useCallback(async (warehouseId: string) => {
    try {
      setInventory(await getInventoryByWarehouse(warehouseId));
      setLoadedWarehouseId(warehouseId);
      setScreenError(null);
    } catch (error) {
      setLoadedWarehouseId(warehouseId);
      setScreenError(getErrorMessage(error));
    }
  }, []);

  const loadInventoryBalances = useCallback(async () => {
    try {
      setInventoryBalances(await getInventoryBalances());
    } catch (error) {
      setScreenError(getErrorMessage(error));
    }
  }, []);

  const loadRecentMovements = useCallback(async (warehouseId: string) => {
    try {
      setRecentMovements(await getRecentWarehouseMovements(warehouseId));
    } catch (error) {
      setScreenError(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let active = true;

    getWarehouses()
      .then((rows) => {
        if (active) {
          setWarehouses(rows);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setScreenError(getErrorMessage(error));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getInventoryBalances()
      .then((rows) => {
        if (active) {
          setInventoryBalances(rows);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setScreenError(getErrorMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getRecentWarehouseMovements(selectedWarehouseId)
      .then((rows) => {
        if (active) {
          setRecentMovements(rows);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setScreenError(getErrorMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedWarehouseId]);

  useEffect(() => {
    let active = true;

    getAllInventoryItems()
      .then((rows) => {
        if (active) {
          setInventoryCatalog(rows);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setScreenError(getErrorMessage(error));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    getInventoryByWarehouse(selectedWarehouseId)
      .then((rows) => {
        if (active) {
          setInventory(rows);
          setLoadedWarehouseId(selectedWarehouseId);
          setScreenError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadedWarehouseId(selectedWarehouseId);
          setScreenError(getErrorMessage(error));
        }
      });

    return () => {
      active = false;
    };
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const visibleInventory = useMemo(() => {
    if (categoryFilter === 'Desbalances') {
      return inventoryBalances.filter((item) => item.estadoBalance === 'DEFICIT');
    }
    const normalizedQuery = searchText.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
      const matchesCategory =
        categoryFilter === 'Todas' || item.categoria === categoryFilter;
      const searchableText = `${item.nombre} ${item.codigo} ${item.categoria}`
        .toLocaleLowerCase();
      return matchesCategory && searchableText.includes(normalizedQuery);
    });
  }, [categoryFilter, inventory, inventoryBalances, searchText]);

  const deficitItems = useMemo(
    () => inventoryBalances.filter((item) => item.estadoBalance === 'DEFICIT'),
    [inventoryBalances],
  );

  const openMovementForm = useCallback((item: InventoryItem | null = null) => {
    setSelectedItem(item);
    setMovementType('ENTRADA');
    setEntryOrigin('COMPRA');
    setQuantity('1');
    setResponsible('');
    setDestination('');
    setRecipientName('');
    setRecipientDni('');
    setRecipientRole('');
    setCoordinates(null);
    setEvidencePhotoUri(null);
    setSignatureSvgPaths(null);
    setSignatureRevision((revision) => revision + 1);
    setPassportNotice(null);
    setActaMovement(null);
    setFormError(null);
    setMovementOpen(true);
  }, []);

  const captureDeliveryLocation = useCallback(async () => {
    setIsCapturingLocation(true);
    setPassportNotice(null);
    try {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (!permissionResult.granted) {
        if (Platform.OS === 'web') {
          setCoordinates({ latitude: -7.7852, longitude: -77.5905 });
          setPassportNotice('El navegador no autorizó el GPS. Se registró la ubicación de referencia de Pataz, La Libertad.');
          return;
        }
        setCoordinates(null);
        setPassportNotice('No se autorizó la ubicación. Puedes registrar la entrega sin coordenadas.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoordinates({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setPassportNotice('Ubicación de entrega registrada.');
    } catch (error) {
      if (Platform.OS === 'web') {
        setCoordinates({ latitude: -7.7852, longitude: -77.5905 });
        setPassportNotice('No fue posible obtener el GPS del navegador. Se registró la ubicación de referencia de Pataz, La Libertad.');
        return;
      }
      setCoordinates(null);
      setPassportNotice(
        `${getErrorMessage(error)} Puedes continuar sin coordenadas GPS.`,
      );
    } finally {
      setIsCapturingLocation(false);
    }
  }, []);

  const chooseEvidencePhoto = useCallback(async (source: 'camera' | 'library') => {
    setIsHandlingPhoto(true);
    setPassportNotice(null);
    try {
      const useBrowserLibrary = Platform.OS === 'web';
      if (source === 'camera' && !useBrowserLibrary) {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          setPassportNotice('Se requiere permiso de cámara para tomar la fotografía.');
          return;
        }
      } else if (!useBrowserLibrary) {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          setPassportNotice('Se requiere permiso de galería para adjuntar la fotografía.');
          return;
        }
      }

      const result = source === 'camera' && !useBrowserLibrary
        ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.65,
        })
        : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.65,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const persistentUri = await persistEvidencePhoto(asset.uri, asset.fileName);
      setEvidencePhotoUri(persistentUri);
      setPassportNotice('Fotografía guardada en el dispositivo.');
    } catch (error) {
      setPassportNotice(getErrorMessage(error));
    } finally {
      setIsHandlingPhoto(false);
    }
  }, []);

  const handleBarcodeScanned = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (scanHandled.current) {
      return;
    }
    scanHandled.current = true;
    setScannerOpen(false);

    try {
      const item = await findInventoryItemByCode(data);
      if (!item) {
        setScreenError(`No se encontró un insumo con el código «${data}».`);
        return;
      }
      setSelectedWarehouseId(item.almacenId);
      openMovementForm(item);
    } catch (error) {
      setScreenError(getErrorMessage(error));
    }
  }, [openMovementForm]);

  const startScanner = useCallback(() => {
    scanHandled.current = false;
    setScannerOpen(true);
  }, []);

  const handleRegisterMovement = useCallback(async () => {
    if (!selectedItem) {
      setFormError('Selecciona o escanea el insumo que tendrá el movimiento.');
      return;
    }

    const parsedQuantity = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormError('Ingresa una cantidad válida mayor que cero.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const movement = await registerWarehouseMovement({
        tipo: movementType,
        origen: movementType === 'ENTRADA' ? entryOrigin : null,
        insumoId: selectedItem.id,
        cantidad: parsedQuantity,
        responsable: responsible,
        destinoCaserio: destination,
        evidencia: movementType === 'SALIDA'
          ? {
            receptorNombre: recipientName,
            receptorDni: recipientDni,
            receptorCargo: recipientRole,
            latitud: coordinates?.latitude ?? null,
            longitud: coordinates?.longitude ?? null,
            fotoUri: evidencePhotoUri,
            firmaSvgPaths: signatureSvgPaths,
          }
          : undefined,
      });
      await loadInventory(selectedItem.almacenId);
      await Promise.all([
        loadInventoryBalances(),
        loadRecentMovements(selectedItem.almacenId),
      ]);
      try {
        setInventoryCatalog(await getAllInventoryItems());
      } catch (error) {
        setScreenError(getErrorMessage(error));
      }
      await refreshPendingCount();
      setMovementOpen(false);
      if (movementType === 'SALIDA') {
        setActaMovement(movement);
        setToastMessage(
          `Salida registrada · ${parsedQuantity} ${selectedItem.unidad}. Pasaporte fiduciario disponible.`,
        );
      } else {
        setToastMessage(`Entrada registrada · ${parsedQuantity} ${selectedItem.unidad}`);
      }
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [
    destination,
    evidencePhotoUri,
    entryOrigin,
    coordinates,
    loadInventory,
    loadInventoryBalances,
    loadRecentMovements,
    movementType,
    quantity,
    recipientDni,
    recipientName,
    recipientRole,
    responsible,
    refreshPendingCount,
    signatureSvgPaths,
    selectedItem,
  ]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segmentedControl}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'INVENTARIO' }}
            onPress={() => setActiveView('INVENTARIO')}
            style={[styles.segmentTab, activeView === 'INVENTARIO' && styles.segmentTabSelected]}
          >
            <MaterialCommunityIcons
              name="warehouse"
              size={17}
              color={activeView === 'INVENTARIO' ? colors.onPrimary : colors.textSecondary}
            />

            <TrackingEnvioModal
              key={trackingMovement?.id ?? 'tracking'}
              visible={trackingMovement !== null}
              movement={trackingMovement}
              onClose={() => setTrackingMovement(null)}
              onUpdated={(updated) => {
                setTrackingMovement(updated);
                setRecentMovements((current) =>
                  current.map((movement) => movement.id === updated.id ? updated : movement),
                );
              }}
            />
            <Text style={[styles.segmentText, activeView === 'INVENTARIO' && styles.segmentTextSelected]}>
              Inventario
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'ORDENES' }}
            onPress={() => setActiveView('ORDENES')}
            style={[styles.segmentTab, activeView === 'ORDENES' && styles.segmentTabSelected]}
          >
            <MaterialCommunityIcons
              name="file-document-multiple-outline"
              size={17}
              color={activeView === 'ORDENES' ? colors.onPrimary : colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeView === 'ORDENES' && styles.segmentTextSelected]}>
              Órdenes de Compra
            </Text>
            {pendingApprovalOrderCount > 0 && (
              <View style={[styles.segmentBadge, activeView === 'ORDENES' && styles.segmentBadgeSelected]}>
                <Text style={[styles.segmentBadgeText, activeView === 'ORDENES' && styles.segmentBadgeTextSelected]}>
                  {pendingApprovalOrderCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        {activeView === 'ORDENES' ? (
          <OrdenesCompraView
            deficitPrefill={orderDeficitPrefill}
            onDeficitPrefillConsumed={() => setOrderDeficitPrefill(null)}
            onOrdersChanged={() => void loadInventoryBalances()}
          />
        ) : (
          <>
        {deficitItems.length > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setCategoryFilter('Desbalances')}
            style={styles.deficitAlert}
          >
            <View style={styles.deficitAlertIcon}>
              <MaterialCommunityIcons name="alert-outline" size={22} color={colors.error} />
            </View>
            <View style={styles.deficitAlertCopy}>
              <Text style={styles.deficitAlertTitle}>Desbalance de inventario</Text>
              <Text style={styles.deficitAlertText}>
                {deficitItems.length} {deficitItems.length === 1 ? 'insumo presenta' : 'insumos presentan'} déficit frente a la demanda.
              </Text>
            </View>
            <View style={styles.deficitAlertAction}>
              <Text style={styles.deficitAlertActionText}>Ver</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.error} />
            </View>
          </Pressable>
        )}
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>CONTROL LOGÍSTICO</Text>
            <Text style={styles.title}>Inventario</Text>
            <Text style={styles.subtitle}>Existencias locales por almacén base.</Text>
          </View>
          <View style={styles.stockCount}>
            <Text style={styles.stockCountNumber}>{inventory.length}</Text>
            <Text style={styles.stockCountLabel}>insumos</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.warehouseList}
        >
          {warehouses.map((warehouse) => {
            const isSelected = warehouse.id === selectedWarehouseId;
            return (
              <Pressable
                key={warehouse.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedWarehouseId(warehouse.id)}
                style={[styles.warehouseCard, isSelected && styles.warehouseCardSelected]}
              >
                <MaterialCommunityIcons
                  name="warehouse"
                  size={20}
                  color={isSelected ? colors.onPrimary : colors.primary}
                />
                <Text style={[styles.warehouseName, isSelected && styles.selectedText]}>
                  {warehouse.nombre}
                </Text>
                <Text style={[styles.warehouseLocation, isSelected && styles.selectedSubtext]}>
                  Base logística
                </Text>
                <Text style={[styles.warehouseRegion, isSelected && styles.selectedSubtext]}>
                  {warehouse.ubicacion.split(',').slice(1).join(',').trim()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actionsRow}>
          <ActionButton
            icon="swap-vertical"
            label="Registrar movimiento"
            onPress={() => openMovementForm()}
            primary
          />
          <ActionButton icon="qrcode-scan" label="Escanear QR" onPress={startScanner} />
        </View>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel="Buscar insumo"
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar por nombre o código"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
              onPress={() => setSearchText('')}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {CATEGORY_FILTERS.map((category) => {
            const selected = category === categoryFilter;
            const isDesbalanceFilter = category === 'Desbalances';
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategoryFilter(category)}
                style={[
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                  isDesbalanceFilter && styles.deficitFilterChip,
                ]}
              >
                <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
                  {category}
                </Text>
                {isDesbalanceFilter && deficitItems.length > 0 && (
                  <View style={[styles.deficitBadge, selected && styles.deficitBadgeSelected]}>
                    <Text style={[styles.deficitBadgeText, selected && styles.deficitBadgeTextSelected]}>
                      {deficitItems.length}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>
              {categoryFilter === 'Desbalances' ? 'Insumos con déficit' : selectedWarehouse?.nombre ?? 'Almacén'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {categoryFilter === 'Desbalances'
                ? `${visibleInventory.length} ${visibleInventory.length === 1 ? 'insumo requiere' : 'insumos requieren'} reposición`
                : `${visibleInventory.length} ${visibleInventory.length === 1 ? 'artículo' : 'artículos'} · Stock disponible`}
            </Text>
          </View>
          <MaterialCommunityIcons name="sort" size={21} color={colors.textSecondary} />
        </View>

        {screenError && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={styles.errorBannerText}>{screenError}</Text>
            <Pressable onPress={() => setScreenError(null)} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={20} color={colors.error} />
            </Pressable>
          </View>
        )}

        {isLoading && categoryFilter !== 'Desbalances' ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando inventario local…</Text>
          </View>
        ) : visibleInventory.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name={categoryFilter === 'Desbalances' ? 'check-circle-outline' : 'package-variant-closed'}
              size={34}
              color={categoryFilter === 'Desbalances' ? colors.online : colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>
              {categoryFilter === 'Desbalances' ? 'No hay insumos con déficit' : 'No hay insumos para mostrar'}
            </Text>
            <Text style={styles.emptyCopy}>
              {categoryFilter === 'Desbalances'
                ? 'La demanda registrada está cubierta por las existencias actuales.'
                : 'Prueba con otro filtro o término de búsqueda.'}
            </Text>
          </View>
        ) : (
          <View style={styles.inventoryList}>
            {visibleInventory.map((item) => (
              categoryFilter === 'Desbalances' ? (
                <DesbalanceCard
                  key={item.id}
                  item={item as InventoryBalance}
                  onCreateOrder={user?.roleKey === 'CAMPO' ? () => {
                    setOrderDeficitPrefill({
                      insumoId: item.id,
                      cantidad: Math.abs((item as InventoryBalance).diferencia),
                    });
                    setActiveView('ORDENES');
                  } : undefined}
                />
              ) : (
                <InventoryCard
                  key={item.id}
                  item={item}
                  onPress={() => openMovementForm(item)}
                />
              )
            ))}
          </View>
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Movimientos recientes</Text>
            <Text style={styles.sectionSubtitle}>Trazabilidad local · {selectedWarehouse?.nombre ?? 'Almacén'}</Text>
          </View>
        </View>
        {recentMovements.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="history" size={21} color={colors.textSecondary} />
            <Text style={styles.emptyCopy}>Aún no hay movimientos registrados en esta sede.</Text>
          </View>
        ) : (
          <View style={styles.movementHistoryList}>
            {recentMovements.map((movement) => (
              <WarehouseMovementCard
                key={movement.id}
                movement={movement}
                onTrack={() => setTrackingMovement(movement)}
                onOpenActa={() => {
                  setActaMovement(movement);
                  setActaVisible(true);
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.offlineNote}>
          <MaterialCommunityIcons name="database-check-outline" size={18} color={colors.primary} />
          <Text style={styles.offlineNoteText}>
            Cambios guardados primero en este dispositivo. La sincronización queda pendiente.
          </Text>
        </View>
          </>
        )}
      </ScrollView>

      {toastMessage && (
        <View accessibilityLiveRegion="polite" style={styles.toast}>
          <MaterialCommunityIcons name="check-circle" size={20} color={colors.onPrimary} />
          <Text style={styles.toastText}>{toastMessage}</Text>
          {actaMovement?.hashSha256 && !actaVisible && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setActaVisible(true)}
              hitSlop={8}
            >
              <Text style={styles.toastActionText}>Ver acta</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setToastMessage(null)} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={19} color={colors.onPrimary} />
          </Pressable>
        </View>
      )}

      <MovementModal
        visible={movementOpen}
        item={selectedItem}
        inventoryItems={inventoryCatalog}
        type={movementType}
        origin={entryOrigin}
        quantity={quantity}
        responsible={responsible}
        destination={destination}
        error={formError}
        isSaving={isSaving}
        onClose={() => setMovementOpen(false)}
        onSetType={setMovementType}
        onSetOrigin={setEntryOrigin}
        onSetQuantity={setQuantity}
        onSetResponsible={setResponsible}
        onSetDestination={setDestination}
        recipientName={recipientName}
        recipientDni={recipientDni}
        recipientRole={recipientRole}
        coordinates={coordinates}
        evidencePhotoUri={evidencePhotoUri}
        signatureSvgPaths={signatureSvgPaths}
        signatureRevision={signatureRevision}
        passportNotice={passportNotice}
        isCapturingLocation={isCapturingLocation}
        isHandlingPhoto={isHandlingPhoto}
        onSetRecipientName={setRecipientName}
        onSetRecipientDni={(value) => setRecipientDni(value.replace(/\D/g, '').slice(0, 8))}
        onSetRecipientRole={setRecipientRole}
        onCaptureLocation={captureDeliveryLocation}
        onTakePhoto={() => chooseEvidencePhoto('camera')}
        onChoosePhoto={() => chooseEvidencePhoto('library')}
        onSetSignature={setSignatureSvgPaths}
        onSelectItem={(item) => {
          setSelectedItem(item);
          setSelectedWarehouseId(item.almacenId);
        }}
        onOpenScanner={startScanner}
        onSubmit={handleRegisterMovement}
      />

      <ActaEntregaModal
        visible={actaVisible}
        movement={actaMovement}
        onClose={() => setActaVisible(false)}
      />

      <ScannerModal
        visible={scannerOpen}
        permission={permission}
        requestPermission={requestPermission}
        onClose={() => setScannerOpen(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />
    </SafeAreaView>
  );
}

interface ActionButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}

function ActionButton({ icon, label, onPress, primary = false }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.actionButton, primary ? styles.primaryAction : styles.secondaryAction]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={primary ? colors.onPrimary : colors.primary}
      />
      <Text style={[styles.actionButtonLabel, primary && styles.primaryActionLabel]}>{label}</Text>
    </Pressable>
  );
}

interface InventoryCardProps {
  item: InventoryItem;
  onPress: () => void;
}

function InventoryCard({ item, onPress }: InventoryCardProps) {
  const isLowStock = item.stockActual <= item.stockMinimo;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.inventoryCard, pressed && styles.pressedCard]}
    >
      <View style={styles.itemIcon}>
        <MaterialCommunityIcons name={categoryIcon[item.categoria]} size={23} color={colors.primary} />
      </View>
      <View style={styles.itemDetails}>
        <View style={styles.itemTitleRow}>
          <Text style={styles.itemName} numberOfLines={2}>{item.nombre}</Text>
          <MaterialCommunityIcons name="chevron-right" size={21} color={colors.textSecondary} />
        </View>
        <View style={styles.itemMetadata}>
          <Text style={styles.itemCode}>{item.codigo}</Text>
          <View style={styles.metadataDot} />
          <Text style={styles.itemCategory}>{item.categoria}</Text>
        </View>
        <View style={styles.itemWarehouse}>
          <MaterialCommunityIcons name="warehouse" size={13} color={colors.textSecondary} />
          <Text style={styles.itemWarehouseText}>{item.almacenNombre}</Text>
        </View>
        <View style={styles.itemBottomRow}>
          <View>
            <Text style={styles.stockCaption}>STOCK ACTUAL</Text>
            <Text style={[styles.stockValue, isLowStock && styles.lowStockValue]}>
              {item.stockActual} <Text style={styles.stockUnit}>{item.unidad}</Text>
            </Text>
          </View>
          <View style={styles.stockStatusWrap}>
            <View style={styles.stockStatusHeading}>
              <View
                style={[
                  styles.stockStatusDot,
                  isLowStock ? styles.criticalDot : styles.availableDot,
                ]}
              />
              <Text style={[styles.stockStatusText, isLowStock && styles.lowStockValue]}>
                {isLowStock ? 'Stock bajo' : 'Disponible'}
              </Text>
            </View>
            <Text style={styles.minimumText}>Mín. {item.stockMinimo}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function DesbalanceCard({
  item,
  onCreateOrder,
}: {
  item: InventoryBalance;
  onCreateOrder?: () => void;
}) {
  return (
    <View style={styles.desbalanceCard}>
      <View style={styles.desbalanceHeading}>
        <View style={styles.itemIcon}>
          <MaterialCommunityIcons name={categoryIcon[item.categoria]} size={22} color={colors.primary} />
        </View>
        <View style={styles.desbalanceCopy}>
          <Text style={styles.desbalanceName}>{item.nombre}</Text>
          <Text style={styles.itemCode}>{item.codigo} · {item.almacenNombre}</Text>
        </View>
        <View style={styles.deficitPill}>
          <Text style={styles.deficitPillText}>{item.diferencia} {item.unidad}</Text>
        </View>
      </View>
      <View style={styles.balanceMetrics}>
        <BalanceMetric label="Stock en almacén" value={`${item.stockActual} ${item.unidad}`} />
        <BalanceMetric label="Cantidad solicitada" value={`${item.cantidadSolicitada} ${item.unidad}`} />
        <BalanceMetric
          label="Déficit exacto"
          value={`${item.diferencia} ${item.unidad}`}
          critical
        />
      </View>
      {onCreateOrder && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Crear orden por déficit de ${Math.abs(item.diferencia)} ${item.unidad} de ${item.nombre}`}
          onPress={onCreateOrder}
          style={styles.createDeficitOrderButton}
        >
          <MaterialCommunityIcons name="file-plus-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.createDeficitOrderText}>Crear Orden por Déficit</Text>
        </Pressable>
      )}
    </View>
  );
}

function BalanceMetric({
  label,
  value,
  critical = false,
}: {
  label: string;
  value: string;
  critical?: boolean;
}) {
  return (
    <View style={styles.balanceMetric}>
      <Text style={styles.balanceMetricLabel}>{label}</Text>
      <Text style={[styles.balanceMetricValue, critical && styles.balanceMetricCritical]}>
        {value}
      </Text>
    </View>
  );
}

function WarehouseMovementCard({
  movement,
  onTrack,
  onOpenActa,
}: {
  movement: WarehouseMovementRecord;
  onTrack: () => void;
  onOpenActa: () => void;
}) {
  const timestamp = new Date(movement.timestamp);
  const formattedTimestamp = Number.isNaN(timestamp.getTime())
    ? movement.timestamp
    : timestamp.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  const stateLabel = movement.estadoEnvio?.replace(/_/g, ' ') ?? '';
  return (
    <View style={styles.movementHistoryCard}>
      <View style={[styles.movementHistoryIcon, movement.tipo === 'SALIDA' && styles.movementHistoryExitIcon]}>
        <MaterialCommunityIcons
          name={movement.tipo === 'SALIDA' ? 'arrow-up-right' : 'arrow-down-left'}
          size={19}
          color={movement.tipo === 'SALIDA' ? colors.error : colors.online}
        />
      </View>
      <View style={styles.movementHistoryCopy}>
        <Text style={styles.movementHistoryTitle} numberOfLines={1}>
          {movement.tipo === 'SALIDA' ? 'Salida' : 'Entrada'} · {movement.insumoNombre}
        </Text>
        <Text style={styles.movementHistoryDetail}>
          {movement.cantidad} · {movement.responsable} · {formattedTimestamp}
        </Text>
        {movement.codigoEnvio && (
          <Text style={styles.shipmentCode}>
            {movement.codigoEnvio} · {stateLabel}
          </Text>
        )}
        <View style={styles.movementHistoryActions}>
          {movement.codigoEnvio && (
            <Pressable accessibilityRole="button" onPress={onTrack} style={styles.trackingAction}>
              <MaterialCommunityIcons name="truck-fast-outline" size={15} color={colors.primary} />
              <Text style={styles.trackingActionText}>Seguimiento</Text>
            </Pressable>
          )}
          {movement.hashSha256 && (
            <Pressable accessibilityRole="button" onPress={onOpenActa} style={styles.actaAction}>
              <MaterialCommunityIcons name="file-certificate-outline" size={15} color={colors.primary} />
              <Text style={styles.trackingActionText}>Acta</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

interface MovementModalProps {
  visible: boolean;
  item: InventoryItem | null;
  inventoryItems: InventoryItem[];
  type: TipoMovimiento;
  origin: OrigenMovimiento;
  quantity: string;
  responsible: string;
  destination: string;
  recipientName: string;
  recipientDni: string;
  recipientRole: string;
  coordinates: { latitude: number; longitude: number } | null;
  evidencePhotoUri: string | null;
  signatureSvgPaths: string | null;
  signatureRevision: number;
  passportNotice: string | null;
  isCapturingLocation: boolean;
  isHandlingPhoto: boolean;
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSetType: (type: TipoMovimiento) => void;
  onSetOrigin: (origin: OrigenMovimiento) => void;
  onSetQuantity: (value: string) => void;
  onSetResponsible: (value: string) => void;
  onSetDestination: (value: string) => void;
  onSetRecipientName: (value: string) => void;
  onSetRecipientDni: (value: string) => void;
  onSetRecipientRole: (value: string) => void;
  onCaptureLocation: () => void;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onSetSignature: (value: string | null) => void;
  onSelectItem: (item: InventoryItem) => void;
  onOpenScanner: () => void;
  onSubmit: () => void;
}

function MovementModal({
  visible,
  item,
  inventoryItems,
  type,
  origin,
  quantity,
  responsible,
  destination,
  recipientName,
  recipientDni,
  recipientRole,
  coordinates,
  evidencePhotoUri,
  signatureSvgPaths,
  signatureRevision,
  passportNotice,
  isCapturingLocation,
  isHandlingPhoto,
  error,
  isSaving,
  onClose,
  onSetType,
  onSetOrigin,
  onSetQuantity,
  onSetResponsible,
  onSetDestination,
  onSetRecipientName,
  onSetRecipientDni,
  onSetRecipientRole,
  onCaptureLocation,
  onTakePhoto,
  onChoosePhoto,
  onSetSignature,
  onSelectItem,
  onOpenScanner,
  onSubmit,
}: MovementModalProps) {
  const [itemSearch, setItemSearch] = useState('');
  const [showItemPicker, setShowItemPicker] = useState(false);
  const filteredItems = inventoryItems.filter((candidate) =>
    `${candidate.nombre} ${candidate.codigo} ${candidate.almacenNombre}`
      .toLocaleLowerCase()
      .includes(itemSearch.trim().toLocaleLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView
          style={styles.modalFlex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeading}>
              <View style={styles.modalHeadingCopy}>
                <Text style={styles.eyebrow}>MOVIMIENTO DE INVENTARIO</Text>
                <Text style={styles.modalTitle}>Registrar movimiento</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar formulario"
                onPress={onClose}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.movementTypeRow}>
              <MovementTypeButton
                active={type === 'ENTRADA'}
                icon="arrow-down-circle-outline"
                label="Entrada"
                onPress={() => onSetType('ENTRADA')}
              />
              <MovementTypeButton
                active={type === 'SALIDA'}
                icon="arrow-up-circle-outline"
                label="Salida"
                onPress={() => onSetType('SALIDA')}
              />
            </View>

            {type === 'ENTRADA' && (
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>Origen de la entrada</Text>
                <View style={styles.originRow}>
                  <OriginButton
                    active={origin === 'COMPRA'}
                    label="Compra"
                    icon="cart-outline"
                    onPress={() => onSetOrigin('COMPRA')}
                  />
                  <OriginButton
                    active={origin === 'DONACION'}
                    label="Donación"
                    icon="hand-heart-outline"
                    onPress={() => onSetOrigin('DONACION')}
                  />
                </View>
              </View>
            )}

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Insumo</Text>
              {item && (
                <View style={styles.selectedItemBox}>
                  <MaterialCommunityIcons name={categoryIcon[item.categoria]} size={22} color={colors.primary} />
                  <View style={styles.selectedItemDetails}>
                    <Text style={styles.selectedItemName}>{item.nombre}</Text>
                    <Text style={styles.selectedItemMeta}>
                      {item.codigo} · {item.almacenNombre}
                    </Text>
                    <Text style={styles.selectedItemStock}>Disponible: {item.stockActual} {item.unidad}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowItemPicker((visible) => !visible)}
                    style={styles.changeItemButton}
                  >
                    <Text style={styles.changeItemLabel}>
                      {showItemPicker ? 'Cerrar' : 'Cambiar'}
                    </Text>
                  </Pressable>
                </View>
              )}
              {(!item || showItemPicker) && (
                <View style={styles.itemPicker}>
                  <View style={styles.itemSearchBox}>
                    <MaterialCommunityIcons
                      name="magnify"
                      size={19}
                      color={colors.textSecondary}
                    />
                    <TextInput
                      accessibilityLabel="Buscar insumo para el movimiento"
                      value={itemSearch}
                      onChangeText={setItemSearch}
                      placeholder="Buscar por nombre o código"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.itemSearchInput}
                    />
                    {itemSearch.length > 0 && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Limpiar búsqueda de insumo"
                        onPress={() => setItemSearch('')}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    )}
                  </View>
                  {filteredItems.length > 0 ? (
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={styles.itemPickerList}
                    >
                      {filteredItems.map((candidate) => (
                        <Pressable
                          accessibilityRole="button"
                          key={candidate.id}
                          onPress={() => {
                            onSelectItem(candidate);
                            setItemSearch('');
                            setShowItemPicker(false);
                          }}
                          style={styles.itemOption}
                        >
                          <View style={styles.itemOptionCopy}>
                            <Text style={styles.itemOptionName} numberOfLines={1}>
                              {candidate.nombre}
                            </Text>
                            <Text style={styles.itemOptionDetail} numberOfLines={1}>
                              {candidate.codigo} · {candidate.almacenNombre}
                            </Text>
                          </View>
                          <Text style={styles.itemOptionStock}>
                            {candidate.stockActual} {candidate.unidad}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.selectionHint}>
                      No hay insumos que coincidan con la búsqueda.
                    </Text>
                  )}
                </View>
              )}
              {!item && (
                <Pressable
                  accessibilityRole="button"
                  onPress={onOpenScanner}
                  style={styles.formScanButton}
                >
                  <MaterialCommunityIcons name="qrcode-scan" size={18} color={colors.primary} />
                  <Text style={styles.formScanButtonText}>Abrir cámara para escanear</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Cantidad</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  accessibilityLabel="Cantidad del movimiento"
                  value={quantity}
                  onChangeText={(value) => onSetQuantity(value.replace(/[^\d.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.quantityInput}
                />
                <Text style={styles.unitSuffix}>{item?.unidad ?? 'unidades'}</Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Responsable</Text>
              <TextInput
                accessibilityLabel="Nombre del responsable"
                value={responsible}
                onChangeText={onSetResponsible}
                placeholder="Nombre completo del técnico"
                placeholderTextColor={colors.textSecondary}
                style={styles.textInput}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>
                Caserío o proyecto de destino{type === 'SALIDA' ? ' *' : ' (opcional)'}
              </Text>
              <TextInput
                accessibilityLabel="Caserío o proyecto de destino"
                value={destination}
                onChangeText={onSetDestination}
                placeholder="Ej. Chagual · Proyecto de anemia"
                placeholderTextColor={colors.textSecondary}
                style={styles.textInput}
                autoCapitalize="sentences"
              />
            </View>

            {type === 'SALIDA' && (
              <View style={styles.passportSection}>
                <View style={styles.passportHeading}>
                  <View style={styles.passportIcon}>
                    <MaterialCommunityIcons
                      name="file-certificate-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.passportHeadingCopy}>
                    <Text style={styles.passportTitle}>Evidencia de Entrega Comunitaria</Text>
                    <Text style={styles.passportSubtitle}>Pasaporte fiduciario</Text>
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Nombre completo del receptor *</Text>
                  <TextInput
                    accessibilityLabel="Nombre completo del receptor"
                    value={recipientName}
                    onChangeText={onSetRecipientName}
                    placeholder="Nombre y apellidos"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.passportInputRow}>
                  <View style={styles.passportHalfInput}>
                    <Text style={styles.inputLabel}>DNI (8 dígitos) *</Text>
                    <TextInput
                      accessibilityLabel="DNI del receptor"
                      value={recipientDni}
                      onChangeText={onSetRecipientDni}
                      placeholder="00000000"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.textInput}
                      keyboardType="number-pad"
                      maxLength={8}
                    />
                  </View>
                  <View style={styles.passportHalfInput}>
                    <Text style={styles.inputLabel}>Cargo / organización *</Text>
                    <TextInput
                      accessibilityLabel="Cargo u organización del receptor"
                      value={recipientRole}
                      onChangeText={onSetRecipientRole}
                      placeholder="CODECO, JASS, beneficiario…"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.textInput}
                      autoCapitalize="sentences"
                    />
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Ubicación de la entrega</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isCapturingLocation}
                    onPress={onCaptureLocation}
                    style={styles.evidenceAction}
                  >
                    {isCapturingLocation ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <MaterialCommunityIcons
                        name="crosshairs-gps"
                        size={19}
                        color={colors.primary}
                      />
                    )}
                    <Text style={styles.evidenceActionText}>
                      {isCapturingLocation ? 'Obteniendo ubicación…' : 'Capturar ubicación GPS'}
                    </Text>
                  </Pressable>
                  {coordinates && (
                    <Text style={styles.evidenceDetail}>
                      {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                    </Text>
                  )}
                  {!coordinates && (
                    <Text style={styles.evidenceDetail}>
                      Si no hay señal GPS en interiores, puedes continuar sin coordenadas.
                    </Text>
                  )}
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Fotografía de entrega</Text>
                  <View style={styles.evidenceButtonsRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isHandlingPhoto}
                      onPress={onTakePhoto}
                      style={styles.evidenceAction}
                    >
                      {isHandlingPhoto ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <MaterialCommunityIcons name="camera-outline" size={19} color={colors.primary} />
                      )}
                      <Text style={styles.evidenceActionText}>Tomar foto</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isHandlingPhoto}
                      onPress={onChoosePhoto}
                      style={styles.evidenceAction}
                    >
                      <MaterialCommunityIcons name="image-outline" size={19} color={colors.primary} />
                      <Text style={styles.evidenceActionText}>Elegir de galería</Text>
                    </Pressable>
                  </View>
                  {evidencePhotoUri && (
                    <Image source={{ uri: evidencePhotoUri }} style={styles.evidenceThumbnail} />
                  )}
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Firma del representante *</Text>
                  <SignaturePad
                    key={signatureRevision}
                    value={signatureSvgPaths}
                    onChange={onSetSignature}
                  />
                </View>

                {passportNotice && (
                  <Text accessibilityLiveRegion="polite" style={styles.passportNotice}>
                    {passportNotice}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.offlineFormNote}>
              <MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.offline} />
              <Text style={styles.offlineFormText}>
                Se guardará localmente como PENDIENTE y se sincronizará cuando haya conexión.
              </Text>
            </View>

            {error && (
              <View style={styles.formError}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={styles.formErrorText}>{error}</Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onSubmit}
              style={[styles.submitButton, isSaving && styles.disabledButton]}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-check-outline" size={20} color={colors.onPrimary} />
                  <Text style={styles.submitButtonText}>Registrar en este dispositivo</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

interface MovementTypeButtonProps {
  active: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}

function MovementTypeButton({ active, icon, label, onPress }: MovementTypeButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.movementTypeButton, active && styles.movementTypeButtonActive]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
      <Text style={[styles.movementTypeText, active && styles.movementTypeTextActive]}>{label}</Text>
    </Pressable>
  );
}

interface OriginButtonProps {
  active: boolean;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}

function OriginButton({ active, label, icon, onPress }: OriginButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.originButton, active && styles.originButtonActive]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={active ? colors.primary : colors.textSecondary}
      />
      <Text style={[styles.movementTypeText, active && styles.movementTypeTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface ScannerModalProps {
  visible: boolean;
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: ReturnType<typeof useCameraPermissions>[1];
  onClose: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
}

function ScannerModal({
  visible,
  permission,
  requestPermission,
  onClose,
  onBarcodeScanned,
}: ScannerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.scannerSafeArea}>
        <View style={styles.scannerHeader}>
          <View>
            <Text style={styles.eyebrow}>IDENTIFICACIÓN DE INSUMOS</Text>
            <Text style={styles.scannerTitle}>Escanear código</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar escáner"
            onPress={onClose}
            style={styles.scannerClose}
          >
            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.cameraFrame}>
          {permission?.granted ? (
            <>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'],
                }}
                onBarcodeScanned={onBarcodeScanned}
              />
              <View pointerEvents="none" style={styles.scanTarget}>
                <View style={styles.scanCornerTopLeft} />
                <View style={styles.scanCornerTopRight} />
                <View style={styles.scanCornerBottomLeft} />
                <View style={styles.scanCornerBottomRight} />
              </View>
            </>
          ) : permission ? (
            <View style={styles.permissionContent}>
              <MaterialCommunityIcons name="camera-lock-outline" size={42} color={colors.primary} />
              <Text style={styles.permissionTitle}>Permiso de cámara requerido</Text>
              <Text style={styles.permissionCopy}>
                Autoriza el acceso para leer códigos QR o de barras de los insumos.
              </Text>
              {permission.canAskAgain && (
                <Pressable
                  accessibilityRole="button"
                  onPress={requestPermission}
                  style={styles.permissionButton}
                >
                  <Text style={styles.permissionButtonText}>Permitir acceso a cámara</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.permissionContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.permissionCopy}>Verificando permisos de cámara…</Text>
            </View>
          )}
        </View>
        <View style={styles.scannerFooter}>
          <MaterialCommunityIcons name="barcode-scan" size={20} color={colors.primary} />
          <Text style={styles.scannerFooterText}>
            Centra el código dentro del marco. También se aceptan códigos de barras compatibles.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  deficitAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: '#F0D8B9',
    borderLeftColor: colors.offline,
    borderRadius: 13,
    backgroundColor: colors.warningBackground,
  },
  deficitAlertIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  deficitAlertCopy: { flex: 1, gap: 3 },
  deficitAlertTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  deficitAlertText: { color: colors.textSecondary, fontSize: 10, lineHeight: 14 },
  deficitAlertAction: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  deficitAlertActionText: { color: colors.error, fontSize: 10, fontWeight: '800' },
  segmentedControl: {
    flexDirection: 'row',
    gap: 5,
    padding: 4,
    borderRadius: 13,
    backgroundColor: '#E8EDE9',
  },
  segmentTab: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 7,
    borderRadius: 10,
  },
  segmentTabSelected: { backgroundColor: colors.primary },
  segmentText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  segmentTextSelected: { color: colors.onPrimary },
  segmentBadge: {
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.warningBackground,
  },
  segmentBadgeSelected: { backgroundColor: colors.onPrimary },
  segmentBadgeText: { color: colors.offline, fontSize: 8, fontWeight: '800' },
  segmentBadgeTextSelected: { color: colors.primary },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  stockCount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 92,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  stockCountNumber: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  stockCountLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  warehouseList: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  warehouseCard: {
    width: 152,
    minHeight: 100,
    justifyContent: 'center',
    gap: 5,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  warehouseCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  warehouseName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  warehouseLocation: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  warehouseRegion: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  selectedText: { color: colors.onPrimary },
  selectedSubtext: { color: '#D8E9DF' },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  primaryAction: { backgroundColor: colors.primary },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryActionLabel: { color: colors.onPrimary },
  searchBox: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontSize: 14,
  },
  filterList: {
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  deficitFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deficitBadge: {
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.dangerBackground,
  },
  deficitBadgeSelected: { backgroundColor: colors.onPrimary },
  deficitBadgeText: { color: colors.error, fontSize: 8, fontWeight: '800' },
  deficitBadgeTextSelected: { color: colors.primary },
  filterLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterLabelSelected: { color: colors.primary },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  inventoryList: { gap: 10 },
  desbalanceCard: {
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#F0D8B9',
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  desbalanceHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  desbalanceCopy: { flex: 1, gap: 4 },
  desbalanceName: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  deficitPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.dangerBackground,
  },
  deficitPillText: { color: colors.error, fontSize: 10, fontWeight: '800' },
  balanceMetrics: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  balanceMetric: { flex: 1, gap: 4 },
  balanceMetricLabel: { color: colors.textSecondary, fontSize: 8, lineHeight: 11 },
  balanceMetricValue: { color: colors.text, fontSize: 10, fontWeight: '800' },
  balanceMetricCritical: { color: colors.error },
  createDeficitOrderButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  createDeficitOrderText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
  movementHistoryList: { gap: 8 },
  movementHistoryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },
  movementHistoryIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.accentLight,
  },
  movementHistoryExitIcon: { backgroundColor: colors.dangerBackground },
  movementHistoryCopy: { flex: 1, gap: 4 },
  movementHistoryTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  movementHistoryDetail: { color: colors.textSecondary, fontSize: 9, lineHeight: 14 },
  shipmentCode: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  movementHistoryActions: { flexDirection: 'row', gap: 12, marginTop: 3 },
  trackingAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actaAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackingActionText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  inventoryCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pressedCard: { opacity: 0.8 },
  itemIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  itemDetails: { flex: 1, gap: 7 },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  itemName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  itemMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  itemCode: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  metadataDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
  },
  itemCategory: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  itemWarehouse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemWarehouseText: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
    gap: spacing.sm,
  },
  stockCaption: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stockValue: {
    color: colors.primary,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 1,
  },
  lowStockValue: { color: colors.error },
  stockUnit: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  stockStatusWrap: {
    alignItems: 'flex-end',
    gap: 3,
  },
  stockStatusHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stockStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  availableDot: { backgroundColor: colors.accent },
  criticalDot: { backgroundColor: colors.error },
  stockStatusText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  minimumText: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCopy: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerBackground,
  },
  errorBannerText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    lineHeight: 17,
  },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  offlineNoteText: {
    flex: 1,
    color: colors.primary,
    fontSize: 11,
    lineHeight: 16,
  },
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  toastText: {
    flex: 1,
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  toastActionText: {
    color: '#D5F0DE',
    fontSize: 11,
    fontWeight: '800',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalFlex: { flex: 1 },
  modalContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeadingCopy: { gap: 4 },
  modalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.surface,
  },
  movementTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  originRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  originButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  originButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  movementTypeButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  movementTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  movementTypeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  movementTypeTextActive: { color: colors.primary },
  formSection: { gap: 7 },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedItemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedItemDetails: { flex: 1, gap: 3 },
  selectedItemName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedItemMeta: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  selectedItemStock: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  selectionHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  itemPicker: {
    gap: 7,
  },
  itemSearchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  itemSearchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontSize: 12,
  },
  itemPickerList: {
    maxHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemOptionCopy: {
    flex: 1,
    gap: 3,
  },
  itemOptionName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  itemOptionDetail: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  itemOptionStock: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  changeItemButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
  },
  changeItemLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  formScanButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  formScanButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  quantityInput: {
    flex: 1,
    height: 48,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  unitSuffix: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  textInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 13,
  },
  offlineFormNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.warningBackground,
  },
  offlineFormText: {
    flex: 1,
    color: colors.offline,
    fontSize: 11,
    lineHeight: 16,
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.dangerBackground,
  },
  formErrorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  submitButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  disabledButton: { opacity: 0.65 },
  passportSection: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  passportHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  passportIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  passportHeadingCopy: { flex: 1, gap: 2 },
  passportTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  passportSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  passportInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  passportHalfInput: {
    flex: 1,
    gap: 7,
  },
  evidenceButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  evidenceAction: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  evidenceActionText: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  evidenceDetail: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  evidenceThumbnail: {
    width: '100%',
    height: 170,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  passportNotice: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  scannerSafeArea: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  scannerHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  scannerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 3,
  },
  scannerClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.surface,
  },
  cameraFrame: {
    flex: 1,
    minHeight: 300,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#13241B',
  },
  camera: { flex: 1 },
  scanTarget: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    right: '12%',
    height: 170,
  },
  scanCornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 34,
    height: 34,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 10,
  },
  scanCornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 34,
    height: 34,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 10,
  },
  scanCornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 34,
    height: 34,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 10,
  },
  scanCornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 10,
  },
  permissionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionCopy: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  permissionButton: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 11,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  permissionButtonText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  scannerFooter: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  scannerFooterText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
