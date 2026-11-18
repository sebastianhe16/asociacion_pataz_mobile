import { useEffect, useState, type ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
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
import { getDatabase } from '../database/db';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface SummaryCounts {
  warehouses: number;
  projects: number;
}

interface MetricCardProps {
  icon: IconName;
  value: string;
  label: string;
  detail: string;
  status: string;
}

function MetricCard({ icon, value, label, detail, status }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
      <View style={styles.metricStatus}>
        <View style={styles.statusDot} />
        <Text style={styles.metricStatusText}>{status}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const [counts, setCounts] = useState<SummaryCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getDatabase()
      .then(async (database) => {
        const result = await database.getFirstAsync<SummaryCounts>(
          `SELECT
            (SELECT COUNT(*) FROM almacenes) AS warehouses,
            (SELECT COUNT(*) FROM proyectos) AS projects`,
        );
        if (active && result) {
          setCounts(result);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen local.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
            <Text style={styles.bannerEyebrow}>ASOCIACIÓN PATAZ  ·  P1</Text>
          </View>
          <Text style={styles.welcomeTitle}>Bienvenido, especialista de campo</Text>
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
          {error ? (
            <MaterialCommunityIcons
              accessibilityLabel="No se pudieron cargar las métricas"
              name="alert-circle-outline"
              size={20}
              color={colors.error}
            />
          ) : !counts ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null}
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            icon="warehouse"
            value={counts ? String(counts.warehouses).padStart(2, '0') : '—'}
            label="Almacenes base"
            detail="Lavasen · Marañón · Pataz"
            status="Operativos"
          />
          <MetricCard
            icon="chart-box-outline"
            value={counts ? String(counts.projects).padStart(2, '0') : '—'}
            label="Proyectos activos"
            detail="En ejecución en caseríos"
            status="En territorio"
          />
          <MetricCard
            icon="shield-lock-outline"
            value="LOCAL"
            label="Offline-first"
            detail="SQLite local"
            status="Base activa"
          />
        </View>
        {error && <Text style={styles.errorMessage}>{error}</Text>}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Accesos directos</Text>
            <Text style={styles.sectionSubtitle}>Herramientas para la operación diaria</Text>
          </View>
        </View>

        <View style={styles.shortcuts}>
          <Link href="/warehouses" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
            >
              <View style={[styles.shortcutIcon, styles.warehouseIcon]}>
                <MaterialCommunityIcons name="warehouse" size={23} color={colors.primary} />
              </View>
              <View style={styles.shortcutCopy}>
                <Text style={styles.shortcutTitle}>Control Logístico de Almacenes</Text>
                <Text style={styles.shortcutDescription}>Entradas, salidas y escaneo QR</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={23}
                color={colors.textSecondary}
              />
            </Pressable>
          </Link>

          <Link href="/field" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
            >
              <View style={[styles.shortcutIcon, styles.fieldIcon]}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={23}
                  color={colors.accent}
                />
              </View>
              <View style={styles.shortcutCopy}>
                <Text style={styles.shortcutTitle}>Fichas de Campo · 27 Proyectos</Text>
                <Text style={styles.shortcutDescription}>Registro offline en caseríos y GPS</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={23}
                color={colors.textSecondary}
              />
            </Pressable>
          </Link>

          <Link href="/sync" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
            >
              <View style={[styles.shortcutIcon, styles.syncIcon]}>
                <MaterialCommunityIcons
                  name="cloud-sync-outline"
                  size={23}
                  color={colors.earth}
                />
              </View>
              <View style={styles.shortcutCopy}>
                <Text style={styles.shortcutTitle}>Sincronización SISGEAP</Text>
                <Text style={styles.shortcutDescription}>Cola de transacciones y auditoría</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={23}
                color={colors.textSecondary}
              />
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    minHeight: 192,
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
    minHeight: 162,
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
    minHeight: 27,
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
  },
  metricStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 'auto',
    paddingTop: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.online,
  },
  metricStatusText: {
    flexShrink: 1,
    color: colors.online,
    fontSize: 9,
    fontWeight: '700',
  },
  errorMessage: {
    color: colors.error,
    fontSize: 12,
  },
  shortcuts: {
    gap: spacing.sm,
  },
  shortcut: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  shortcutPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  shortcutIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  warehouseIcon: {
    backgroundColor: colors.primaryLight,
  },
  fieldIcon: {
    backgroundColor: colors.accentLight,
  },
  syncIcon: {
    backgroundColor: colors.earthLight,
  },
  shortcutCopy: {
    flex: 1,
    gap: 4,
  },
  shortcutTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  shortcutDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
});
