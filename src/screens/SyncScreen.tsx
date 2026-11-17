import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../core/theme';
import { useNetworkStatus } from '../services/sync/NetworkProvider';
import { useSyncStatus } from '../services/sync/SyncProvider';
import { PlaceholderLine, PlaceholderScreen } from './PlaceholderScreen';

export default function SyncScreen() {
  const { isOnline } = useNetworkStatus();
  const { pendingCount, isSyncing, lastResult, errorMessage, synchronize } = useSyncStatus();

  return (
    <PlaceholderScreen
      title="Sincronización SISGEAP"
      subtitle="Cola local auditable y envío simulado por lotes, ordenado por timestamp."
    >
      <PlaceholderLine>Registros pendientes o con error: {pendingCount}</PlaceholderLine>
      <PlaceholderLine>
        Estado: {isOnline ? 'listo para sincronizar' : 'sin conexión'}
      </PlaceholderLine>
      {lastResult && (
        <PlaceholderLine>
          Último envío: {lastResult.syncedCount} sincronizados · {lastResult.remainingCount}{' '}
          pendientes.
        </PlaceholderLine>
      )}
      {errorMessage && <PlaceholderLine>Error: {errorMessage}</PlaceholderLine>}
      <View style={styles.actionArea}>
        <Pressable
          accessibilityRole="button"
          disabled={isSyncing}
          onPress={() => void synchronize()}
          style={[styles.button, isSyncing && styles.disabledButton]}
        >
          {isSyncing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonLabel}>Enviar cola de sincronización</Text>
          )}
        </Pressable>
        {!isOnline && (
          <Text style={styles.helper}>
            Activa «Simular ONLINE» en la barra superior para probar el envío sin internet.
          </Text>
        )}
      </View>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  actionArea: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  helper: {
    color: colors.offline,
    fontSize: 14,
    lineHeight: 21,
  },
});
