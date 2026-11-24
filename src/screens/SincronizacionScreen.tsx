import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../core/theme';
import type { SyncLog, SyncQueueEntry } from '../core/types';
import { getRecentSyncLogs } from '../database/db';
import { useNetworkStatus } from '../services/sync/NetworkProvider';
import { useSyncStatus } from '../services/sync/SyncProvider';

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

export default function SincronizacionScreen() {
  const { isOnline, serviceError: networkError } = useNetworkStatus();
  const {
    pendingCount,
    pendingMovementCount,
    pendingFieldCount,
    pendingOrderCount,
    queue,
    isQueueLoading,
    isSyncing,
    lastResult,
    errorMessage,
    refreshPendingCount,
    synchronize,
  } = useSyncStatus();
  const [recentLogs, setRecentLogs] = useState<SyncLog[]>([]);
  const [isLogLoading, setIsLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);

  const refreshLogs = useCallback(async () => {
    try {
      setRecentLogs(await getRecentSyncLogs());
      setLogError(null);
    } catch (error) {
      setLogError(
        error instanceof Error ? error.message : 'No se pudo cargar el historial de sincronización.',
      );
    } finally {
      setIsLogLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getRecentSyncLogs()
      .then((logs) => {
        if (active) {
          setRecentLogs(logs);
          setLogError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLogError(
            error instanceof Error
              ? error.message
              : 'No se pudo cargar el historial de sincronización.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLogLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [pendingCount, refreshLogs]);

  const successVisible =
    lastResult !== null && lastResult.syncedCount > 0 && pendingCount === 0;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>INTEGRACIÓN ERP</Text>
            <Text style={styles.title}>Sincronización SISGEAP</Text>
            <Text style={styles.subtitle}>
              Cola local, envío por lotes y trazabilidad auditable.
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="cloud-sync-outline" size={25} color={colors.primary} />
          </View>
        </View>

        <View style={[styles.connectionCard, isOnline ? styles.onlineCard : styles.offlineCard]}>
          <View style={styles.connectionTopRow}>
            <View style={styles.connectionState}>
              <View style={[styles.connectionDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
              <View>
                <Text style={styles.connectionEyebrow}>CONECTIVIDAD</Text>
                <Text style={styles.connectionTitle}>{isOnline ? 'En línea' : 'Sin conexión'}</Text>
              </View>
            </View>
            <View style={[styles.connectionIcon, isOnline ? styles.onlineIcon : styles.offlineIcon]}>
              <MaterialCommunityIcons
                name={isOnline ? 'wifi' : 'wifi-off'}
                size={21}
                color={isOnline ? colors.online : colors.offline}
              />
            </View>
          </View>

          {networkError && <Text style={styles.inlineError}>{networkError}</Text>}
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalIcon}>
            <MaterialCommunityIcons name="tray-arrow-up" size={22} color={colors.onPrimary} />
          </View>
          <View style={styles.totalCopy}>
            <Text style={styles.totalLabel}>REGISTROS EN COLA</Text>
            <Text style={styles.totalDescription}>Pendientes o con error por reintentar</Text>
          </View>
          <Text style={styles.totalValue}>{pendingCount}</Text>
        </View>

        <View style={styles.counterRow}>
          <CounterCard
            icon="warehouse"
            label="Movimientos de almacén"
            value={pendingMovementCount}
            tint={colors.primaryLight}
            iconColor={colors.primary}
          />
          <CounterCard
            icon="clipboard-text-outline"
            label="Fichas de campo"
            value={pendingFieldCount}
            tint="#E4F1F5"
            iconColor="#24647C"
          />
          <CounterCard
            icon="file-document-outline"
            label="Órdenes de compra"
            value={pendingOrderCount}
            tint="#FFF0DF"
            iconColor="#A85B12"
          />
        </View>

        {successVisible && (
          <View accessibilityLiveRegion="polite" style={styles.successBanner}>
            <MaterialCommunityIcons name="check-decagram" size={22} color={colors.online} />
            <Text style={styles.successText}>
              Sincronización con SISGEAP completada con éxito - Trazabilidad auditada
            </Text>
          </View>
        )}

        {errorMessage && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.syncActions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSyncing || pendingCount === 0 || !isOnline}
            onPress={() => void synchronize()}
            style={[
              styles.syncButton,
              (isSyncing || pendingCount === 0 || !isOnline) && styles.syncButtonDisabled,
            ]}
          >
            {isSyncing ? (
              <>
                <ActivityIndicator color={colors.onPrimary} />
                <Text style={styles.syncButtonText}>Procesando lotes SISGEAP…</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="cloud-upload-outline" size={21} color={colors.onPrimary} />
                <Text style={styles.syncButtonText}>Sincronizar ahora</Text>
              </>
            )}
          </Pressable>
          {!isOnline && (
            <Text style={styles.syncHint}>
              Conéctate a internet para enviar los registros pendientes.
            </Text>
          )}
          {pendingCount === 0 && !isSyncing && (
            <Text style={styles.syncHint}>No hay registros pendientes por enviar.</Text>
          )}
        </View>

        <View style={styles.queueHeader}>
          <View style={styles.queueHeadingCopy}>
            <Text style={styles.queueTitle}>Cola de transacciones</Text>
            <Text style={styles.queueSubtitle}>
              Orden cronológico · paquetes locales
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualizar cola"
            onPress={() => {
              void refreshPendingCount();
              setIsLogLoading(true);
              void refreshLogs();
            }}
            style={styles.refreshButton}
          >
            <MaterialCommunityIcons name="refresh" size={19} color={colors.primary} />
          </Pressable>
        </View>

        {isQueueLoading && queue.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Leyendo transacciones locales…</Text>
          </View>
        ) : queue.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="check-all" size={25} color={colors.online} />
            </View>
            <Text style={styles.emptyTitle}>Cola al día</Text>
            <Text style={styles.emptyText}>
              No hay movimientos, fichas u órdenes esperando sincronización.
            </Text>
          </View>
        ) : (
          <View style={styles.queueList}>
            {queue.map((entry) => (
              <QueueCard key={`${entry.entityType}-${entry.id}`} entry={entry} />
            ))}
          </View>
        )}

        <View style={styles.queueHeader}>
          <View style={styles.queueHeadingCopy}>
            <Text style={styles.queueTitle}>Últimos registros sincronizados</Text>
            <Text style={styles.queueSubtitle}>Resultado y hora de cada envío</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualizar historial de sincronización"
            onPress={() => {
              setIsLogLoading(true);
              void refreshLogs();
            }}
            style={styles.refreshButton}
          >
            <MaterialCommunityIcons name="refresh" size={19} color={colors.primary} />
          </Pressable>
        </View>
        {isLogLoading && recentLogs.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Cargando historial…</Text>
          </View>
        ) : recentLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="history" size={25} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Sin registros de sincronización</Text>
            <Text style={styles.emptyText}>
              El historial aparecerá cuando se procesen registros pendientes.
            </Text>
          </View>
        ) : (
          <View style={styles.queueList}>
            {recentLogs.map((log) => (
              <SyncLogCard key={log.id} log={log} />
            ))}
          </View>
        )}
        {logError && <Text style={styles.inlineError}>{logError}</Text>}

        {lastResult && (
          <View style={styles.lastSync}>
            <MaterialCommunityIcons name="history" size={16} color={colors.textSecondary} />
            <Text style={styles.lastSyncText}>
              Último lote: {lastResult.syncedCount} enviados · {lastResult.remainingCount} restantes
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SyncLogCard({ log }: { log: SyncLog }) {
  const isSuccessful = log.syncStatus === 'SUCCESS';
  return (
    <View style={styles.queueCard}>
      <View
        style={[
          styles.queueCardIcon,
          isSuccessful ? styles.logSuccessIcon : styles.logErrorIcon,
        ]}
      >
        <MaterialCommunityIcons
          name={getEntityIcon(log.entityType)}
          size={19}
          color={isSuccessful ? colors.online : colors.error}
        />
      </View>
      <View style={styles.queueCardBody}>
        <View style={styles.queueCardTop}>
          <Text style={styles.queueType}>
            {getEntityLabel(log.entityType)}
          </Text>
          <View style={[styles.statusPill, isSuccessful ? styles.syncedPill : styles.errorPill]}>
            <Text style={[styles.statusLabel, isSuccessful ? styles.syncedStatus : styles.errorStatus]}>
              {isSuccessful ? 'SINCRONIZADO' : 'ERROR'}
            </Text>
          </View>
        </View>
        <Text style={styles.queueEntryTitle}>
          {isSuccessful ? 'Envío completado' : 'Envío con error'}
        </Text>
        <Text style={styles.queueEntryDetail}>Registro {log.entityId.slice(0, 8)}</Text>
        <View style={styles.timestampRow}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.timestampText}>{formatTimestamp(log.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
}

interface CounterCardProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: number;
  tint: string;
  iconColor: string;
}

function CounterCard({ icon, label, value, tint, iconColor }: CounterCardProps) {
  return (
    <View style={styles.counterCard}>
      <View style={[styles.counterIcon, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon} size={19} color={iconColor} />
      </View>
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
      <Text style={styles.counterStatus}>Pendientes de envío</Text>
    </View>
  );
}

function QueueCard({ entry }: { entry: SyncQueueEntry }) {
  const hasError = entry.syncStatus === 'ERROR';

  return (
    <View style={styles.queueCard}>
      <View style={styles.queueCardIcon}>
        <MaterialCommunityIcons
          name={getEntityIcon(entry.entityType)}
          size={19}
          color={getEntityColor(entry.entityType)}
        />
      </View>
      <View style={styles.queueCardBody}>
        <View style={styles.queueCardTop}>
          <Text style={styles.queueType}>
            {getEntityLabel(entry.entityType)}
          </Text>
          <View style={[styles.statusPill, hasError ? styles.errorPill : styles.pendingPill]}>
            <Text style={[styles.statusLabel, hasError ? styles.errorStatus : styles.pendingStatus]}>
              {hasError ? 'ERROR · REINTENTO' : 'PENDIENTE DE SINCRONIZAR'}
            </Text>
          </View>
        </View>
        <Text style={styles.queueEntryTitle}>{entry.title}</Text>
        <Text style={styles.queueEntryDetail}>{entry.detail}</Text>
        <View style={styles.timestampRow}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.timestampText}>{formatTimestamp(entry.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
}

function getEntityIcon(entityType: SyncQueueEntry['entityType']) {
  if (entityType === 'MOVIMIENTO_ALMACEN') {
    return 'swap-vertical';
  }
  if (entityType === 'ORDEN_COMPRA') {
    return 'file-document-outline';
  }
  return 'clipboard-text-outline';
}

function getEntityLabel(entityType: SyncQueueEntry['entityType']): string {
  if (entityType === 'MOVIMIENTO_ALMACEN') {
    return 'MOVIMIENTO DE ALMACÉN';
  }
  if (entityType === 'ORDEN_COMPRA') {
    return 'ORDEN DE COMPRA';
  }
  return 'FICHA DE CAMPO';
}

function getEntityColor(entityType: SyncQueueEntry['entityType']): string {
  if (entityType === 'MOVIMIENTO_ALMACEN') {
    return colors.primary;
  }
  return entityType === 'ORDEN_COMPRA' ? '#A85B12' : '#24647C';
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  headerIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
  },
  connectionCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  onlineCard: { borderLeftWidth: 4, borderLeftColor: colors.online },
  offlineCard: { borderLeftWidth: 4, borderLeftColor: colors.offline },
  connectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  connectionDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  onlineDot: { backgroundColor: colors.online },
  offlineDot: { backgroundColor: colors.offline },
  connectionEyebrow: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  connectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 1,
  },
  connectionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  onlineIcon: { backgroundColor: colors.accentLight },
  offlineIcon: { backgroundColor: colors.warningBackground },
  inlineError: {
    color: colors.error,
    fontSize: 10,
    marginTop: 6,
  },
  totalCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: colors.primaryDark,
  },
  totalIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#315F4D',
  },
  totalCopy: { flex: 1, gap: 4 },
  totalLabel: {
    color: '#D8E9DF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  totalDescription: {
    color: '#F3F7F4',
    fontSize: 10,
  },
  totalValue: {
    color: colors.onPrimary,
    fontSize: 29,
    fontWeight: '800',
  },
  counterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  counterCard: {
    flex: 1,
    minHeight: 138,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  counterIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  counterValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
    marginTop: 7,
  },
  counterLabel: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  counterStatus: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 3,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C4E3C8',
    backgroundColor: colors.accentLight,
  },
  successText: {
    flex: 1,
    color: colors.online,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.dangerBackground,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 11,
    lineHeight: 16,
  },
  syncActions: { gap: 7 },
  syncButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: colors.primary,
  },
  syncButtonDisabled: { opacity: 0.55 },
  syncButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  syncHint: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  queueHeadingCopy: { flex: 1, gap: 3 },
  queueTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  queueSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  refreshButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  queueList: { gap: 9 },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  queueCardIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  queueCardBody: { flex: 1, gap: 4 },
  queueCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  queueType: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  statusPill: {
    maxWidth: '62%',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
  },
  pendingPill: { backgroundColor: colors.warningBackground },
  errorPill: { backgroundColor: colors.dangerBackground },
  syncedPill: { backgroundColor: colors.accentLight },
  statusLabel: {
    fontSize: 8,
    fontWeight: '800',
  },
  pendingStatus: { color: colors.offline },
  errorStatus: { color: colors.error },
  syncedStatus: { color: colors.online },
  logSuccessIcon: { backgroundColor: colors.accentLight },
  logErrorIcon: { backgroundColor: colors.dangerBackground },
  queueEntryTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  queueEntryDetail: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timestampText: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  loading: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    gap: 7,
    padding: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.accentLight,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  lastSync: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 2,
  },
  lastSyncText: {
    color: colors.textSecondary,
    fontSize: 10,
  },
});
