import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../core/theme';
import { useNetworkStatus } from '../services/sync/NetworkProvider';
import { useSyncStatus } from '../services/sync/SyncProvider';

export function ConnectionStatusBar() {
  const { isOnline, simulationMode, serviceError, setSimulationMode } = useNetworkStatus();
  const { pendingCount } = useSyncStatus();

  const toggleSimulation = useCallback(async () => {
    const nextMode = isOnline ? 'OFFLINE' : 'ONLINE';
    try {
      await setSimulationMode(nextMode);
    } catch (error) {
      Alert.alert(
        'No se pudo cambiar el modo de red',
        error instanceof Error ? error.message : 'Revisa el almacenamiento local.',
      );
    }
  }, [isOnline, setSimulationMode]);

  const resetSimulation = useCallback(async () => {
    try {
      await setSimulationMode(null);
    } catch (error) {
      Alert.alert(
        'No se pudo restablecer la red',
        error instanceof Error ? error.message : 'Revisa el almacenamiento local.',
      );
    }
  }, [setSimulationMode]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.row}>
        <View style={styles.statusGroup}>
          <View style={[styles.indicator, isOnline ? styles.online : styles.offline]} />
          <View>
            <Text style={styles.statusText}>{isOnline ? 'EN LÍNEA' : 'SIN CONEXIÓN'}</Text>
            <Text style={styles.pendingText}>
              {pendingCount} {pendingCount === 1 ? 'registro pendiente' : 'registros pendientes'}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Simular modo ${isOnline ? 'offline' : 'online'}`}
          onPress={toggleSimulation}
          style={styles.modeButton}
        >
          <Text style={styles.modeButtonText}>
            {simulationMode ? `Simular ${simulationMode}` : 'Simular red'}
          </Text>
        </Pressable>
      </View>
      {simulationMode && (
        <Pressable
          accessibilityRole="button"
          onPress={resetSimulation}
          style={styles.resetButton}
        >
          <Text style={styles.resetText}>Volver al estado real de red</Text>
        </Pressable>
      )}
      {serviceError && <Text style={styles.errorText}>{serviceError}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  online: { backgroundColor: '#55D681' },
  offline: { backgroundColor: '#F6B844' },
  statusText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  pendingText: {
    color: '#E4EEE5',
    fontSize: 13,
    marginTop: 2,
  },
  modeButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderColor: '#A8C9AF',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  modeButtonText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  resetButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  resetText: {
    color: '#D5E8D8',
    textDecorationLine: 'underline',
    fontSize: 12,
  },
  errorText: {
    color: '#FFD4CF',
    fontSize: 12,
    paddingBottom: spacing.xs,
  },
});
