import { useEffect, useState, type ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../core/theme';
import {
  getDatabase,
  getRecentActivities,
  getWarehouseStatusSummaries,
  type RecentActivity,
  type WarehouseStatusSummary,
} from '../database/db';
import { useAuth } from '../services/auth/AuthProvider';
import { useSyncStatus } from '../services/sync/SyncProvider';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface SummaryCounts {
  warehouses: number;
  projects: number;
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
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { pendingCount } = useSyncStatus();
  const [counts, setCounts] = useState<SummaryCounts | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [warehouseSummaries, setWarehouseSummaries] = useState<WarehouseStatusSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const [database, latestActivities, warehouses] = await Promise.all([
          getDatabase(),
          getRecentActivities(),
          getWarehouseStatusSummaries(),
        ]);
        const projectSummary = await database.getFirstAsync<{ projects: number }>(
          'SELECT COUNT(*) AS projects FROM proyectos',
        );
        if (active) {
          setCounts({
            warehouses: warehouses.length,
            projects: projectSummary?.projects ?? 0,
          });
          setActivities(latestActivities);
          setWarehouseSummaries(warehouses);
          setError(null);
        }
      } catch (cause: unknown) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen local.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboardData();
    return () => {
      active = false;
    };
  }, [pendingCount]);

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
            <Text style={styles.bannerEyebrow}>ASOCIACIÓN PATAZ</Text>
          </View>
          <Text style={styles.welcomeTitle}>
            Bienvenido{user ? `, ${user.nombreCompleto.split(' ')[0]}` : ', especialista de campo'}
          </Text>
          <Text style={styles.welcomeDescription}>
            Plataforma de Operaciones Desconectadas{'\n'}Sede La Libertad
          </Text>
          <View style={styles.bannerAccent} />
        </LinearGradient>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Resumen operativo</Text>
            <Text style={styles.sectionSubtitle}>Estado de la operación en territorio</Text>
          </View>
          {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            icon="warehouse"
            value={counts ? String(counts.warehouses).padStart(2, '0') : '—'}
            label="Almacenes base"
            detail="Lavasen · Marañón · Pataz"
          />
          <MetricCard
            icon="chart-box-outline"
            value={counts ? String(counts.projects).padStart(2, '0') : '—'}
            label="Proyectos activos"
            detail="En ejecución en caseríos"
          />
          <MetricCard
            icon="shield-lock-outline"
            value="LOCAL"
            label="Offline-first"
            detail="SQLite disponible"
          />
        </View>
        {error && <Text style={styles.errorMessage}>{error}</Text>}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Actividad reciente</Text>
            <Text style={styles.sectionSubtitle}>Últimos movimientos y registros de campo</Text>
          </View>
        </View>
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyActivity}>
            <MaterialCommunityIcons name="history" size={24} color={colors.textSecondary} />
            <Text style={styles.emptyActivityText}>
              Aún no hay movimientos ni fichas registrados.
            </Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {activities.map((activity) => (
              <ActivityRow key={`${activity.entityType}-${activity.id}`} activity={activity} />
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
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityRow({ activity }: { activity: RecentActivity }) {
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
  welcomeBanner: {
    minHeight: 176,
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
    fontSize: 18,
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
    minHeight: 145,
    padding: 11,
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
    fontSize: 21,
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
