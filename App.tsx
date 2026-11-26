import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './src/database/db';
import { AuthProvider, useAuth } from './src/services/auth/AuthProvider';
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
      <ResponsiveViewport>
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
      </ResponsiveViewport>
    );
  }

  if (!databaseReady) {
    return (
      <ResponsiveViewport>
        <SafeAreaProvider>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.message}>Preparando el trabajo sin conexión…</Text>
          </View>
        </SafeAreaProvider>
      </ResponsiveViewport>
    );
  }

  return (
    <ResponsiveViewport>
      <SafeAreaProvider>
        <AuthProvider>
          <NetworkProvider>
            <SyncProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </SyncProvider>
          </NetworkProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ResponsiveViewport>
  );
}

function ResponsiveViewport({ children }: PropsWithChildren) {
  return Platform.OS === 'web'
    ? (
      <View style={styles.webViewport}>
        <View style={styles.webApp}>{children}</View>
      </View>
    )
    : <View style={styles.mobileViewport}>{children}</View>;
}

function RootNavigator() {
  const { user, isLoading } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Protected guard={isLoading || !user} redirectTo="/(tabs)">
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={isLoading || user !== null} redirectTo="/login">
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  mobileViewport: {
    flex: 1,
  },
  webViewport: {
    flex: 1,
    minHeight: '100vh',
    paddingVertical: 24,
    backgroundColor: '#e9ecef',
  },
  webApp: {
    flex: 1,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.background,
    shadowColor: '#16231d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
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
