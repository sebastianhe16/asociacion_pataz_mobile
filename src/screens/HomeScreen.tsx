import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../core/theme';
import {
  getInTransitShipments,
  getProjectCount,
  getRecentManagerialDecisions,
  getRecentActivities,
  getShipmentStatusCounts,
  getWarehouseMovementDetails,
  getWarehouseStatusSummaries,
  type InventoryBalance,
  type RecentActivity,
  type ShipmentStatusCounts,
  type WarehouseStatusSummary,
} from '../database/db';
import type {
  DecisionGerencial,
  WarehouseMovementRecord,
} from '../core/types';
import { useAuth } from '../services/auth/AuthProvider';
import { useSyncStatus } from '../services/sync/SyncProvider';
import {
  getDonationSurplusOpportunities,
  getInventoryBalances,
  type DonationSurplusOpportunity,
} from '../services/inventory/desbalanceService';
import ActaEntregaModal from './ActaEntregaModal';
import TrackingEnvioModal from './TrackingEnvioModal';
import DecisionGerencialModal from '../components/DecisionGerencialModal';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ExecutiveDecisionTarget =
  | { mode: 'DONATION'; item: DonationSurplusOpportunity }
  | { mode: 'DEFICIT'; item: InventoryBalance };

interface DashboardData {
  projectCount: number;
  balances: InventoryBalance[];
  donationOpportunities: DonationSurplusOpportunity[];
  shipmentCounts: ShipmentStatusCounts;
  inTransitShipments: WarehouseMovementRecord[];
  decisions: DecisionGerencial[];
  activities: RecentActivity[];
  warehouseSummaries: WarehouseStatusSummary[];
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { pendingCount } = useSyncStatus();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [warehouseSummaries, setWarehouseSummaries] = useState<WarehouseStatusSummary[]>([]);
  const [actaMovement, setActaMovement] = useState<WarehouseMovementRecord | null>(null);
  const [actaVisible, setActaVisible] = useState(false);
  const [trackingMovement, setTrackingMovement] = useState<WarehouseMovementRecord | null>(null);
  const [executiveData, setExecutiveData] = useState<{
    projectCount: number;
    balances: InventoryBalance[];
    donationOpportunities: DonationSurplusOpportunity[];
    shipmentCounts: ShipmentStatusCounts;
    inTransitShipments: WarehouseMovementRecord[];
    decisions: DecisionGerencial[];
  } | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<ExecutiveDecisionTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (): Promise<DashboardData> => {
    const [balances, activities, warehouseSummaries, shipmentCounts, inTransitShipments, decisions] =
      await Promise.all([
        getInventoryBalances(),
        getRecentActivities(),
        getWarehouseStatusSummaries(),
        getShipmentStatusCounts(),
        getInTransitShipments(),
        getRecentManagerialDecisions(),
      ]);
    const [donationOpportunities, projectCount] = await Promise.all([
      getDonationSurplusOpportunities(balances),
      getProjectCount(),
    ]);
    return {
      projectCount,
      balances,
      donationOpportunities,
      shipmentCounts,
      inTransitShipments,
      decisions,
      activities,
      warehouseSummaries,
    };
  }, []);

  const applyDashboardData = useCallback((data: DashboardData) => {
    setExecutiveData({
      projectCount: data.projectCount,
      balances: data.balances,
      donationOpportunities: data.donationOpportunities,
      shipmentCounts: data.shipmentCounts,
      inTransitShipments: data.inTransitShipments,
      decisions: data.decisions,
    });
    setActivities(data.activities);
    setWarehouseSummaries(data.warehouseSummaries);
  }, []);

  const refreshDashboardData = useCallback(async () => {
    try {
      applyDashboardData(await fetchDashboardData());
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el panel gerencial local.');
    } finally {
      setIsLoading(false);
    }
  }, [applyDashboardData, fetchDashboardData]);

  useEffect(() => {
    let active = true;
    fetchDashboardData()
      .then((data) => {
        if (active) {
          applyDashboardData(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el panel gerencial local.');
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
  }, [applyDashboardData, fetchDashboardData, pendingCount]);

  async function openActivityActa(activity: RecentActivity) {
    if (activity.hasActa !== 1) {
      return;
    }
    try {
      const movement = await getWarehouseMovementDetails(activity.id);
      if (!movement?.hashSha256) {
        throw new Error('El acta de esta salida no está disponible en la base local.');
      }
      setActaMovement(movement);
      setActaVisible(true);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el acta de entrega.');
    }
  }

  async function openActivityTracking(activity: RecentActivity) {
    if (!activity.codigoEnvio) {
      return;
    }
    try {
      const movement = await getWarehouseMovementDetails(activity.id);
      if (!movement?.codigoEnvio) {
        throw new Error('El seguimiento de este envío no está disponible en la base local.');
      }
      setTrackingMovement(movement);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el seguimiento del envío.');
    }
  }

  const deficits = executiveData?.balances.filter((item) => item.estadoBalance === 'DEFICIT') ?? [];
  const inTransitShipments = executiveData?.inTransitShipments ?? [];
  const itemCount = executiveData?.balances.length ?? 0;
  const serviceLevel = itemCount > 0
    ? Math.round(((itemCount - deficits.length) / itemCount) * 100)
    : 0;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primaryDark, '#2B7054']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.welcomeBanner}
        >
          <View style={styles.bannerDecoration} />
          <View style={styles.bannerTopline}>
            <View style={styles.bannerIcon}>
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={23}
                color={colors.onPrimary}
              />
            </View>
            <Text style={styles.bannerEyebrow}>ASOCIACIÓN PATAZ · GESTIÓN</Text>
          </View>
          <Text style={styles.welcomeTitle}>
            Panel ejecutivo{user ? ` · ${user.nombreCompleto.split(' ')[0]}` : ''}
          </Text>
          <Text style={styles.welcomeDescription}>
            Decisiones sobre recursos, cobertura y resultados
          </Text>
          <View style={styles.bannerAccent} />
        </LinearGradient>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Indicadores gerenciales</Text>
            <Text style={styles.sectionSubtitle}>Optimización de recursos · Seguimiento de resultados</Text>
          </View>
          {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            icon="scale-balance"
            value={executiveData ? `${serviceLevel}%` : '—'}
            label="Nivel de servicio"
            detail={`${Math.max(0, itemCount - deficits.length)} de ${itemCount} insumos sin déficit`}
          />
          <MetricCard
            icon="truck-fast-outline"
            value={executiveData
              ? `${executiveData.shipmentCounts.inTransit} / ${executiveData.shipmentCounts.delivered}`
              : '—'}
            label="En ruta / entregados"
            detail="Envíos con seguimiento registrado"
          />
          <MetricCard
            icon="folder-multiple-outline"
            value={executiveData ? String(executiveData.projectCount).padStart(2, '0') : '—'}
            label="Proyectos activos"
            detail="Intervenciones registradas"
          />
        </View>
        {error && <Text style={styles.errorMessage}>{error}</Text>}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Oportunidades y Decisiones Sugeridas</Text>
            <Text style={styles.sectionSubtitle}>Alertas que requieren evaluación directiva</Text>
          </View>
        </View>
        {isLoading && !executiveData ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.opportunityList}
          >
            {executiveData?.donationOpportunities.map((item) => (
              <DonationOpportunityCard
                key={`donation-${item.id}`}
                item={item}
                onPress={() => setDecisionTarget({ mode: 'DONATION', item })}
              />
            ))}
            {deficits.map((item) => (
              <DeficitOpportunityCard
                key={`deficit-${item.id}`}
                item={item}
                onPress={() => setDecisionTarget({ mode: 'DEFICIT', item })}
              />
            ))}
            {inTransitShipments.length > 0
              ? inTransitShipments.map((movement) => (
                <ShipmentOpportunityCard
                  key={`shipment-${movement.id}`}
                  movement={movement}
                  shipmentCount={executiveData?.shipmentCounts.inTransit ?? 0}
                  onPress={() => setTrackingMovement(movement)}
                />
              ))
              : (
                <ShipmentOpportunityCard
                  movement={null}
                  shipmentCount={0}
                  onPress={() => undefined}
                />
              )}
            {executiveData?.donationOpportunities.length === 0 && deficits.length === 0 && inTransitShipments.length === 0 && (
              <View style={styles.opportunityEmpty}>
                <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.online} />
                <Text style={styles.opportunityEmptyText}>
                  No hay alertas de déficit ni envíos pendientes de monitoreo.
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Actividad reciente</Text>
            <Text style={styles.sectionSubtitle}>Movimientos y registros de campo</Text>
          </View>
        </View>
        {isLoading && !executiveData ? (
          <View style={styles.loadingCard}><ActivityIndicator color={colors.primary} /></View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyActivity}>
            <MaterialCommunityIcons name="history" size={24} color={colors.textSecondary} />
            <Text style={styles.emptyActivityText}>Aún no hay movimientos ni fichas registrados.</Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {activities.map((activity) => (
              <ActivityRow
                key={`${activity.entityType}-${activity.id}`}
                activity={activity}
                onOpenActa={() => void openActivityActa(activity)}
                onOpenTracking={() => void openActivityTracking(activity)}
              />
            ))}
          </View>
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Estado de sedes</Text>
            <Text style={styles.sectionSubtitle}>Inventario en las bases logísticas</Text>
          </View>
        </View>
        <View style={styles.siteGrid}>
          {warehouseSummaries.map((warehouse) => (
            <WarehouseStatusCard key={warehouse.id} warehouse={warehouse} />
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Últimas Decisiones Gerenciales</Text>
            <Text style={styles.sectionSubtitle}>Bitácora de gobierno y asignación de recursos</Text>
          </View>
        </View>
        {executiveData?.decisions.length ? (
          <View style={styles.decisionList}>
            {executiveData.decisions.map((decision) => (
              <DecisionHistoryCard key={decision.id} decision={decision} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyActivity}>
            <MaterialCommunityIcons name="clipboard-text-clock-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.emptyActivityText}>Las decisiones aprobadas aparecerán en esta bitácora.</Text>
          </View>
        )}
      </ScrollView>
      <ActaEntregaModal
        visible={actaVisible}
        movement={actaMovement}
        onClose={() => {
          setActaVisible(false);
          setActaMovement(null);
        }}
      />
      <TrackingEnvioModal
        key={trackingMovement?.id ?? 'tracking'}
        visible={trackingMovement !== null}
        movement={trackingMovement}
        onClose={() => setTrackingMovement(null)}
        onUpdated={(updated) => {
          setTrackingMovement(updated);
          setActivities((current) => current.map((activity) =>
            activity.id === updated.id
              ? { ...activity, estadoEnvio: updated.estadoEnvio }
              : activity,
          ));
        }}
      />
      {decisionTarget && (
        <DecisionGerencialModal
          key={`${decisionTarget.mode}-${decisionTarget.item.id}`}
          visible
          mode={decisionTarget.mode}
          item={decisionTarget.item}
          onClose={() => setDecisionTarget(null)}
          onSaved={() => void refreshDashboardData()}
        />
      )}
    </SafeAreaView>
  );
}

interface MetricCardProps {
  icon: IconName;
  value: string;
  label: string;
  detail: string;
}

function MetricCard({ icon, value, label, detail }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function DonationOpportunityCard({
  item,
  onPress,
}: {
  item: DonationSurplusOpportunity;
  onPress: () => void;
}) {
  return (
    <View style={[styles.opportunityCard, styles.donationCard]}>
      <View style={styles.opportunityHeader}>
        <View style={[styles.opportunityIcon, styles.donationIcon]}>
          <MaterialCommunityIcons name="gift-outline" size={20} color={colors.online} />
        </View>
        <Text style={[styles.opportunityType, styles.donationType]}>OPORTUNIDAD POR DONACIÓN</Text>
      </View>
      <Text style={styles.opportunityTitle}>
        +{item.excedenteDonado} {item.unidad} disponibles
      </Text>
      <Text style={styles.opportunityLocation}>{item.almacenNombre} · {item.nombre}</Text>
      <Text style={styles.opportunityDescription}>
        Inventario disponible por donación permite abrir un nuevo proyecto comunitario o ampliar cobertura en caserío.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.opportunityButton, styles.donationButton]}
      >
        <Text style={styles.opportunityButtonText}>Evaluar y Abrir Proyecto</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

function DeficitOpportunityCard({
  item,
  onPress,
}: {
  item: InventoryBalance;
  onPress: () => void;
}) {
  return (
    <View style={[styles.opportunityCard, styles.deficitCard]}>
      <View style={styles.opportunityHeader}>
        <View style={[styles.opportunityIcon, styles.deficitIcon]}>
          <MaterialCommunityIcons name="alert-outline" size={20} color={colors.error} />
        </View>
        <Text style={[styles.opportunityType, styles.deficitType]}>DESBALANCE CRÍTICO</Text>
      </View>
      <Text style={styles.opportunityTitle} numberOfLines={2}>{item.nombre}</Text>
      <Text style={styles.opportunityLocation}>{item.almacenNombre} · {item.codigo}</Text>
      <Text style={styles.deficitComparison}>
        {item.stockActual} disponibles vs. {item.cantidadSolicitada} solicitados
      </Text>
      <Text style={styles.opportunityDescription}>
        Déficit de {Math.abs(item.diferencia)} {item.unidad}. Puede afectar la continuidad de las actividades asignadas.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.opportunityButton, styles.deficitButton]}
      >
        <Text style={styles.opportunityButtonText}>Tomar Decisión de Compra</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

function ShipmentOpportunityCard({
  movement,
  shipmentCount,
  onPress,
}: {
  movement: WarehouseMovementRecord | null;
  shipmentCount: number;
  onPress: () => void;
}) {
  return (
    <View style={[styles.opportunityCard, styles.shipmentCard]}>
      <View style={styles.opportunityHeader}>
        <View style={[styles.opportunityIcon, styles.shipmentIcon]}>
          <MaterialCommunityIcons name="truck-fast-outline" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.opportunityType, styles.shipmentType]}>ENVÍOS EN RUTA</Text>
      </View>
      {movement ? (
        <>
          <Text style={styles.opportunityTitle}>{movement.codigoEnvio}</Text>
          <Text style={styles.opportunityLocation}>
            {movement.almacenNombre} → {movement.destinoCaserio ?? 'Destino pendiente'}
          </Text>
          <Text style={styles.opportunityDescription}>
            {movement.insumoNombre} · {movement.cantidad} {movement.insumoUnidad}. {shipmentCount} {shipmentCount === 1 ? 'paquete en tránsito' : 'paquetes en tránsito'}.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={[styles.opportunityButton, styles.shipmentButton]}
          >
            <Text style={styles.opportunityButtonText}>Monitorear Recorrido</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.onPrimary} />
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.opportunityTitle}>Sin paquetes en ruta</Text>
          <Text style={styles.opportunityLocation}>Los envíos activos aparecerán aquí.</Text>
          <Text style={styles.opportunityDescription}>
            El monitoreo se habilita al registrar la etapa «En Tránsito».
          </Text>
          <View style={[styles.opportunityButton, styles.shipmentButtonDisabled]}>
            <Text style={styles.opportunityButtonText}>Sin seguimiento pendiente</Text>
          </View>
        </>
      )}
    </View>
  );
}

function DecisionHistoryCard({ decision }: { decision: DecisionGerencial }) {
  const icon = decision.tipo === 'NUEVO_PROYECTO_DONACION'
    ? 'sprout-outline'
    : decision.tipo === 'ABASTECIMIENTO_DESBALANCE'
      ? 'cart-check'
      : 'swap-horizontal';
  const timestamp = new Date(decision.fechaHora);
  const date = Number.isNaN(timestamp.getTime())
    ? decision.fechaHora
    : timestamp.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <View style={styles.decisionCard}>
      <View style={styles.decisionIcon}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.decisionCopy}>
        <View style={styles.decisionHeading}>
          <Text style={styles.decisionTitle} numberOfLines={2}>{decision.titulo}</Text>
          <View style={styles.approvedBadge}>
            <Text style={styles.approvedBadgeText}>APROBADA</Text>
          </View>
        </View>
        <Text style={styles.decisionDetail}>{decision.detalle}</Text>
        <Text style={styles.decisionMeta}>
          {decision.cantidadInvolucrada !== null
            ? `${decision.cantidadInvolucrada} · ${decision.insumoRelacionado ?? 'Insumo'} · `
            : ''}
          {decision.caserioOProyectoDestino ?? 'Gestión de recursos'}
        </Text>
        <Text style={styles.decisionTimestamp}>{date} · {decision.decididoPorNombre}</Text>
      </View>
    </View>
  );
}

function ActivityRow({
  activity,
  onOpenActa,
  onOpenTracking,
}: {
  activity: RecentActivity;
  onOpenActa: () => void;
  onOpenTracking: () => void;
}) {
  const status = activity.syncStatus === 'SYNCED'
    ? { label: 'Sincronizado', color: colors.online, backgroundColor: colors.accentLight }
    : activity.syncStatus === 'ERROR'
      ? { label: 'Revisar', color: colors.error, backgroundColor: colors.dangerBackground }
      : { label: 'Pendiente', color: colors.offline, backgroundColor: colors.warningBackground };

  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
        <MaterialCommunityIcons
          name={activity.entityType === 'MOVIMIENTO_ALMACEN' ? 'swap-vertical' : 'clipboard-text-outline'}
          size={19}
          color={colors.primary}
        />
      </View>
      <View style={styles.activityCopy}>
        <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
        <Text style={styles.activityDetail} numberOfLines={1}>{activity.detail}</Text>
        <Text style={styles.activityTimestamp}>{formatTimestamp(activity.timestamp)}</Text>
      </View>
      <View style={[styles.activityStatus, { backgroundColor: status.backgroundColor }]}>
        <Text style={[styles.activityStatusText, { color: status.color }]}>{status.label}</Text>
      </View>
      <View style={styles.activityActions}>
        {activity.codigoEnvio && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir seguimiento ${activity.codigoEnvio}`}
            onPress={onOpenTracking}
            style={styles.activityActionButton}
          >
            <MaterialCommunityIcons name="truck-fast-outline" size={15} color={colors.primary} />
            <Text style={styles.activityActionText}>Tracking</Text>
          </Pressable>
        )}
        {activity.hasActa === 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${activity.title}. Abrir acta de entrega`}
            onPress={onOpenActa}
            style={styles.activityActionButton}
          >
            <MaterialCommunityIcons name="file-certificate-outline" size={15} color={colors.primary} />
            <Text style={styles.activityActionText}>Acta</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function WarehouseStatusCard({ warehouse }: { warehouse: WarehouseStatusSummary }) {
  const needsAttention = warehouse.lowStockCount > 0;
  return (
    <View style={styles.siteCard}>
      <MaterialCommunityIcons name="warehouse" size={19} color={colors.primary} />
      <Text style={styles.siteName} numberOfLines={1}>{warehouse.nombre}</Text>
      <Text style={styles.siteInventory}>
        {warehouse.itemCount} {warehouse.itemCount === 1 ? 'insumo' : 'insumos'}
      </Text>
      <View style={styles.siteStatus}>
        <View style={[styles.siteStatusDot, needsAttention && styles.siteStatusDotAttention]} />
        <Text style={[styles.siteStatusText, needsAttention && styles.siteStatusTextAttention]}>
          {needsAttention ? `${warehouse.lowStockCount} por revisar` : 'Operativa'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  opportunityList: { gap: spacing.sm, paddingRight: spacing.md },
  opportunityCard: {
    width: 290,
    minHeight: 245,
    justifyContent: 'space-between',
    gap: 9,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  donationCard: { borderColor: '#CDE5D2', borderTopWidth: 4, borderTopColor: colors.online },
  deficitCard: { borderColor: '#F1D2CF', borderTopWidth: 4, borderTopColor: colors.error },
  shipmentCard: { borderColor: '#D5E1E9', borderTopWidth: 4, borderTopColor: colors.primary },
  opportunityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  opportunityIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  donationIcon: { backgroundColor: colors.accentLight },
  deficitIcon: { backgroundColor: colors.dangerBackground },
  shipmentIcon: { backgroundColor: colors.primaryLight },
  opportunityType: { flex: 1, fontSize: 9, fontWeight: '800', letterSpacing: 0.55 },
  donationType: { color: colors.online },
  deficitType: { color: colors.error },
  shipmentType: { color: colors.primary },
  opportunityTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  opportunityLocation: { color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
  opportunityDescription: { flex: 1, color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
  deficitComparison: {
    padding: 8,
    borderRadius: 9,
    color: colors.error,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: colors.dangerBackground,
  },
  opportunityButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 11,
  },
  donationButton: { backgroundColor: colors.online },
  deficitButton: { backgroundColor: colors.error },
  shipmentButton: { backgroundColor: colors.primary },
  shipmentButtonDisabled: { backgroundColor: colors.textSecondary },
  opportunityButtonText: { flexShrink: 1, color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
  opportunityEmpty: {
    width: 290,
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  opportunityEmptyText: { flex: 1, color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  welcomeBanner: {
    minHeight: 160,
    overflow: 'hidden',
    justifyContent: 'center',
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bannerDecoration: {
    position: 'absolute',
    top: -64,
    right: -44,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bannerTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  bannerEyebrow: {
    color: '#DCEBE2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  welcomeTitle: {
    maxWidth: 290,
    color: colors.onPrimary,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 29,
  },
  welcomeDescription: {
    color: '#E1EEE8',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  bannerAccent: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 72,
    height: 5,
    borderTopLeftRadius: 5,
    backgroundColor: '#8FC5A6',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minHeight: 150,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  metricIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
  },
  metricValue: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    marginTop: 3,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  metricDetail: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
  },
  errorMessage: {
    color: colors.error,
    fontSize: 12,
  },
  loadingCard: {
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyActivity: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyActivityText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  activityList: {
    gap: spacing.sm,
  },
  activityRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activityActions: { alignItems: 'flex-end', gap: 7 },
  activityActionButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  activityActionText: { color: colors.primary, fontSize: 8, fontWeight: '800' },
  activityIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  activityDetail: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  activityTimestamp: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  activityStatus: {
    maxWidth: 82,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activityStatusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  decisionList: { gap: spacing.sm },
  decisionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  decisionIcon: {
    width: 37,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
  },
  decisionCopy: { flex: 1, gap: 5 },
  decisionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  decisionTitle: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  approvedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.accentLight,
  },
  approvedBadgeText: { color: colors.online, fontSize: 7, fontWeight: '800' },
  decisionDetail: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
  decisionMeta: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  decisionTimestamp: { color: colors.textSecondary, fontSize: 8 },
  siteGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  siteCard: {
    flex: 1,
    minHeight: 112,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 5,
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  siteName: {
    maxWidth: '100%',
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  siteInventory: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  siteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  siteStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.online,
  },
  siteStatusDotAttention: {
    backgroundColor: colors.offline,
  },
  siteStatusText: {
    flexShrink: 1,
    color: colors.online,
    fontSize: 9,
    fontWeight: '700',
  },
  siteStatusTextAttention: {
    color: colors.offline,
  },
});
