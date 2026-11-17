import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './src/database/db';
import { NetworkProvider } from './src/services/sync/NetworkProvider';
import { SyncProvider } from './src/services/sync/SyncProvider';
import { colors, spacing } from './src/core/theme';

export default function App() {
  const [databaseReady, setDatabaseReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    initDatabase()
      .then(() => {
        if (active) {
          setDatabaseReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setStartupError(
            error instanceof Error ? error.message : 'No se pudo inicializar la base local.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (startupError) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <Text style={styles.title}>No se pudo iniciar Pataz Móvil</Text>
          <Text style={styles.message}>{startupError}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={() => {
              setStartupError(null);
              setDatabaseReady(false);
              initDatabase()
                .then(() => setDatabaseReady(true))
                .catch((error: unknown) => {
                  setStartupError(
                    error instanceof Error ? error.message : 'No se pudo inicializar la base local.',
                  );
                });
            }}
          >
            <Text style={styles.retryLabel}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!databaseReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Preparando el trabajo sin conexión…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <SyncProvider>
          <StatusBar style="light" />
          <Slot />
        </SyncProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  retryLabel: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
