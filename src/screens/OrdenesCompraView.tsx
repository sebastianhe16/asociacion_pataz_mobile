import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { EstadoOrdenCompra, OrdenCompra } from '../core/types';
import { colors, spacing } from '../core/theme';
import {
  getPurchaseOrders,
  markPurchaseOrderAttended,
  reviewPurchaseOrder,
} from '../database/db';
import { useAuth } from '../services/auth/AuthProvider';
import { useSyncStatus } from '../services/sync/SyncProvider';
import DetalleOrdenCompraModal from './DetalleOrdenCompraModal';
import NuevaOrdenCompraModal from './NuevaOrdenCompraModal';

type OrderFilter = 'TODAS' | EstadoOrdenCompra;

const ORDER_FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'APROBADA', label: 'Aprobadas' },
  { value: 'ATENDIDA', label: 'Atendidas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
];

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export default function OrdenesCompraView() {
  const { user } = useAuth();
  const { refreshPendingCount } = useSyncStatus();
  const [orders, setOrders] = useState<OrdenCompra[]>([]);
  const [filter, setFilter] = useState<OrderFilter>('TODAS');
  const [selectedOrder, setSelectedOrder] = useState<OrdenCompra | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await getPurchaseOrders());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las órdenes locales.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getPurchaseOrders()
      .then((rows) => {
        if (active) {
          setOrders(rows);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudieron cargar las órdenes locales.',
          );
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
  }, []);

  const pendingCount = useMemo(
    () => orders.filter((order) => order.estado === 'PENDIENTE').length,
    [orders],
  );
  const visibleOrders = useMemo(
    () => filter === 'TODAS' ? orders : orders.filter((order) => order.estado === filter),
    [filter, orders],
  );

  async function handleReview(decision: 'APROBADA' | 'RECHAZADA', observation: string) {
    if (!selectedOrder || !user) {
      throw new Error('No se pudo identificar la orden o la sesión actual.');
    }
    await reviewPurchaseOrder(selectedOrder.id, decision, observation, user);
    setSelectedOrder(null);
    await Promise.all([loadOrders(), refreshPendingCount()]);
  }

  async function handleAttend() {
    if (!selectedOrder || !user) {
      throw new Error('No se pudo identificar la orden o la sesión actual.');
    }
    await markPurchaseOrderAttended(selectedOrder.id, user);
    setSelectedOrder(null);
    await Promise.all([loadOrders(), refreshPendingCount()]);
  }

  async function handleCreated() {
    setIsCreating(false);
    await Promise.all([loadOrders(), refreshPendingCount()]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>ABASTECIMIENTO</Text>
          <Text style={styles.title}>Órdenes de compra</Text>
          <Text style={styles.subtitle}>Requerimientos y flujo de aprobación por roles.</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{orders.length}</Text>
          <Text style={styles.summaryLabel}>Órdenes registradas</Text>
        </View>
        <View style={[styles.summaryCard, styles.pendingSummary]}>
          <Text style={[styles.summaryValue, styles.pendingValue]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pendientes de aprobación</Text>
        </View>
      </View>

      {user?.roleKey === 'CAMPO' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear nueva orden de compra"
          onPress={() => setIsCreating(true)}
          style={styles.createButton}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
          <Text style={styles.createButtonText}>Nueva orden de compra</Text>
        </Pressable>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
      >
        {ORDER_FILTERS.map((option) => {
          const selected = filter === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option.value)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                {option.label}
              </Text>
              {option.value === 'PENDIENTE' && pendingCount > 0 && (
                <View style={[styles.filterBadge, selected && styles.filterBadgeSelected]}>
                  <Text style={[styles.filterBadgeText, selected && styles.filterBadgeTextSelected]}>
                    {pendingCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Cargando órdenes locales…</Text>
        </View>
      ) : visibleOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="file-document-outline" size={25} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === 'TODAS' ? 'Aún no hay órdenes registradas' : `No hay órdenes ${filter.toLocaleLowerCase()}`}
          </Text>
          <Text style={styles.emptyCopy}>
            {user?.roleKey === 'CAMPO'
              ? 'Crea un requerimiento para iniciar el flujo de aprobación.'
              : 'Los requerimientos nuevos aparecerán aquí.'}
          </Text>
        </View>
      ) : (
        <View style={styles.orderList}>
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => setSelectedOrder(order)}
            />
          ))}
        </View>
      )}

      {user && (
        <NuevaOrdenCompraModal
          visible={isCreating}
          user={user}
          onClose={() => setIsCreating(false)}
          onCreated={() => void handleCreated()}
        />
      )}
      {user && (
        <DetalleOrdenCompraModal
          visible={selectedOrder !== null}
          order={selectedOrder}
          user={user}
          onClose={() => setSelectedOrder(null)}
          onReview={handleReview}
          onAttend={handleAttend}
        />
      )}
    </View>
  );
}

function OrderCard({ order, onPress }: { order: OrdenCompra; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
    >
      <View style={styles.orderCardHeading}>
        <View style={styles.orderCodeWrap}>
          <MaterialCommunityIcons name="file-document-outline" size={17} color={colors.primary} />
          <Text style={styles.orderCode}>{order.codigoOrden}</Text>
        </View>
        <StatusPill status={order.estado} />
      </View>
      <Text style={styles.projectName}>{order.proyectoNombre}</Text>
      <View style={styles.orderDetailRow}>
        <MaterialCommunityIcons name="account-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.orderDetailText} numberOfLines={1}>{order.solicitanteNombre}</Text>
      </View>
      <View style={styles.orderCardFooter}>
        <View style={styles.orderDetailRow}>
          <MaterialCommunityIcons name="warehouse" size={14} color={colors.textSecondary} />
          <Text style={styles.orderDetailText}>{order.almacenDestinoNombre}</Text>
        </View>
        <View style={styles.priorityLabel}>
          <View style={[styles.priorityDot, order.prioridad === 'URGENTE' && styles.urgentDot]} />
          <Text style={styles.priorityText}>{order.prioridad}</Text>
        </View>
      </View>
      <View style={styles.orderBottomRow}>
        <Text style={styles.orderDate}>{formatDate(order.fechaSolicitud)}</Text>
        <Text style={styles.itemCount}>{order.items.length} {order.items.length === 1 ? 'material' : 'materiales'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={19} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

function StatusPill({ status }: { status: EstadoOrdenCompra }) {
  return (
    <View style={[styles.statusPill, statusStyle[status]]}>
      <Text style={[styles.statusText, statusTextStyle[status]]}>{status}</Text>
    </View>
  );
}

const statusStyle: Record<EstadoOrdenCompra, object> = {
  PENDIENTE: { backgroundColor: colors.warningBackground },
  APROBADA: { backgroundColor: colors.accentLight },
  RECHAZADA: { backgroundColor: colors.dangerBackground },
  ATENDIDA: { backgroundColor: '#E4F1F5' },
};

const statusTextStyle: Record<EstadoOrdenCompra, object> = {
  PENDIENTE: { color: colors.offline },
  APROBADA: { color: colors.online },
  RECHAZADA: { color: colors.error },
  ATENDIDA: { color: '#24647C' },
};

const styles = StyleSheet.create({
  container: { gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1,
    minHeight: 68,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  pendingSummary: { backgroundColor: colors.warningBackground, borderColor: '#F0D8B9' },
  summaryValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  pendingValue: { color: colors.offline },
  summaryLabel: { color: colors.textSecondary, fontSize: 9, lineHeight: 13 },
  filterList: { alignItems: 'center', gap: 7, paddingRight: spacing.md },
  filterChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  filterTextSelected: { color: colors.onPrimary },
  filterBadge: { minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.warningBackground },
  filterBadgeSelected: { backgroundColor: '#FFFFFF' },
  filterBadgeText: { color: colors.offline, fontSize: 8, fontWeight: '800' },
  filterBadgeTextSelected: { color: colors.primary },
  createButton: {
    minHeight: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  createButtonText: { color: colors.onPrimary, fontSize: 13, fontWeight: '800' },
  orderList: { gap: 9 },
  orderCard: {
    gap: 7,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderCardPressed: { opacity: 0.82 },
  orderCardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  orderCodeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderCode: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 8, fontWeight: '800' },
  projectName: { color: colors.text, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  orderDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  orderDetailText: { color: colors.textSecondary, fontSize: 9 },
  orderCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  priorityLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priorityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  urgentDot: { backgroundColor: colors.error },
  priorityText: { color: colors.textSecondary, fontSize: 8, fontWeight: '800' },
  orderBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  orderDate: { flex: 1, color: colors.textSecondary, fontSize: 8 },
  itemCount: { color: colors.textSecondary, fontSize: 8 },
  errorBanner: { flexDirection: 'row', gap: 7, padding: 10, borderRadius: 10, backgroundColor: colors.dangerBackground },
  errorText: { flex: 1, color: colors.error, fontSize: 10 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.textSecondary, fontSize: 10 },
  emptyState: { alignItems: 'center', gap: 7, padding: spacing.lg, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.background },
  emptyTitle: { color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
