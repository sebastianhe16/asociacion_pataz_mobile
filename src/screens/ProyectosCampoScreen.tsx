import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EjeProyecto, ProyectoCampoResumen } from '../core/types';
import { colors, spacing, typography } from '../core/theme';
import { getProjectSummaries } from '../database/db';
import { useSyncStatus } from '../services/sync/SyncProvider';
import NuevaFichaCampoScreen from './NuevaFichaCampoScreen';

interface ProjectGroupConfig {
  eje: EjeProyecto;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  backgroundColor: string;
}

const PROJECT_GROUPS: ProjectGroupConfig[] = [
  {
    eje: 'Salud',
    title: 'Salud y nutrición',
    subtitle: 'Lucha contra la anemia y bienestar comunitario',
    icon: 'heart-pulse',
    color: '#A43D38',
    backgroundColor: '#F9EAE8',
  },
  {
    eje: 'Agricultura',
    title: 'Agricultura sostenible',
    subtitle: 'Semillas, plantones y producción familiar',
    icon: 'sprout',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  {
    eje: 'Educación',
    title: 'Educación',
    subtitle: 'Acompañamiento y oportunidades de aprendizaje',
    icon: 'school-outline',
    color: '#76512C',
    backgroundColor: '#F4EBDD',
  },
  {
    eje: 'Agua y saneamiento',
    title: 'Agua y saneamiento',
    subtitle: 'Agua segura, higiene y sistemas rurales',
    icon: 'water-outline',
    color: '#24647C',
    backgroundColor: '#E4F1F5',
  },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudieron cargar los proyectos locales.';
}

export default function ProyectosCampoScreen() {
  const [projects, setProjects] = useState<ProyectoCampoResumen[] | null>(null);
  const [activeProject, setActiveProject] = useState<ProyectoCampoResumen | null>(null);
  const [searchText, setSearchText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const { refreshPendingCount } = useSyncStatus();

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await getProjectSummaries());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let active = true;

    getProjectSummaries()
      .then((rows) => {
        if (active) {
          setProjects(rows);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(getErrorMessage(error));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toastVisible) {
      return undefined;
    }
    const timer = setTimeout(() => setToastVisible(false), 4200);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  const filteredProjects = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) {
      return projects ?? [];
    }
    return (projects ?? []).filter(({ codigo, nombre, caserio }) =>
      `${codigo} ${nombre} ${caserio}`.toLocaleLowerCase().includes(query),
    );
  }, [projects, searchText]);

  const projectsByGroup = useMemo(
    () => PROJECT_GROUPS.map((group) => ({
      ...group,
      projects: filteredProjects.filter((project) => project.eje === group.eje),
    })).filter((group) => group.projects.length > 0),
    [filteredProjects],
  );

  const handleFichaSaved = useCallback(() => {
    setActiveProject(null);
    setToastVisible(true);
    void refreshProjects();
    void refreshPendingCount();
  }, [refreshPendingCount, refreshProjects]);

  const totalPending = (projects ?? []).reduce(
    (total, project) => total + project.pendientesSync + project.erroresSync,
    0,
  );

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PROYECTOS COMUNITARIOS · P1</Text>
            <Text style={styles.title}>Trabajo de campo</Text>
            <Text style={styles.subtitle}>
              Selecciona un proyecto para registrar una visita o actividad.
            </Text>
          </View>
          <View style={styles.projectCount}>
            <Text style={styles.projectCountNumber}>{projects?.length ?? '—'}</Text>
            <Text style={styles.projectCountLabel}>PROYECTOS</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Registro preparado para campo</Text>
            <Text style={styles.summaryText}>
              Los formularios se guardan localmente y quedan disponibles sin conexión.
            </Text>
          </View>
          <View style={styles.pendingCount}>
            <Text style={styles.pendingCountNumber}>{totalPending}</Text>
            <Text style={styles.pendingCountLabel}>pendientes</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={21} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel="Buscar proyectos"
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar por proyecto, código o caserío"
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
              <MaterialCommunityIcons name="close-circle" size={19} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => void refreshProjects()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        )}

        {projects === null && !errorMessage ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando proyectos locales…</Text>
          </View>
        ) : projectsByGroup.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="folder-search-outline" size={34} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No encontramos proyectos</Text>
            <Text style={styles.emptyText}>Prueba con otro código, nombre o caserío.</Text>
          </View>
        ) : (
          <View style={styles.groups}>
            {projectsByGroup.map((group) => (
              <View key={group.eje} style={styles.group}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupIcon, { backgroundColor: group.backgroundColor }]}>
                    <MaterialCommunityIcons name={group.icon} size={21} color={group.color} />
                  </View>
                  <View style={styles.groupCopy}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
                  </View>
                  <Text style={styles.groupCount}>{group.projects.length}</Text>
                </View>
                <View style={styles.projectList}>
                  {group.projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onPress={() => setActiveProject(project)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {toastVisible && (
        <View accessibilityLiveRegion="polite" style={styles.toast}>
          <MaterialCommunityIcons name="check-circle" size={21} color={colors.onPrimary} />
          <Text style={styles.toastText}>
            Ficha guardada localmente · Sincronización pendiente
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
            onPress={() => setToastVisible(false)}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="close" size={19} color={colors.onPrimary} />
          </Pressable>
        </View>
      )}

      {activeProject && (
        <NuevaFichaCampoScreen
          visible
          project={activeProject}
          onClose={() => setActiveProject(null)}
          onSaved={handleFichaSaved}
        />
      )}
    </SafeAreaView>
  );
}

interface ProjectCardProps {
  project: ProyectoCampoResumen;
  onPress: () => void;
}

function ProjectCard({ project, onPress }: ProjectCardProps) {
  const pending = project.pendientesSync + project.erroresSync;
  const status = pending > 0
    ? { label: `${pending} pendiente${pending === 1 ? '' : 's'} de sincronizar`, icon: 'cloud-upload-outline' as const, pending: true }
    : project.fichasSincronizadas > 0
      ? { label: 'Sincronizado', icon: 'check-circle-outline' as const, pending: false }
      : { label: 'Sin fichas registradas', icon: 'clipboard-text-outline' as const, pending: false };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.projectCard, pressed && styles.pressedCard]}
    >
      <View style={styles.projectCardTop}>
        <Text style={styles.projectCode}>{project.codigo}</Text>
        <MaterialCommunityIcons name="chevron-right" size={21} color={colors.textSecondary} />
      </View>
      <Text style={styles.projectName}>{project.nombre}</Text>
      <View style={styles.caserioRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.caserioText}>{project.caserio}</Text>
      </View>
      <View style={styles.projectCardFooter}>
        <View style={[styles.syncPill, status.pending ? styles.pendingPill : styles.syncedPill]}>
          <MaterialCommunityIcons
            name={status.icon}
            size={14}
            color={status.pending ? colors.offline : colors.online}
          />
          <Text style={[styles.syncLabel, status.pending ? styles.pendingLabel : styles.syncedLabel]}>
            {status.label}
          </Text>
        </View>
        <Text style={styles.fichaCount}>
          {project.totalFichas} {project.totalFichas === 1 ? 'ficha' : 'fichas'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
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
    letterSpacing: 0.9,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 20,
  },
  projectCount: {
    minWidth: 68,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  projectCountNumber: {
    color: colors.onPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  projectCountLabel: {
    color: '#D6E8DD',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  pendingCount: {
    alignItems: 'center',
    minWidth: 48,
  },
  pendingCountNumber: {
    color: colors.offline,
    fontSize: 19,
    fontWeight: '800',
  },
  pendingCountLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: '700',
  },
  searchBox: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontSize: 13,
  },
  groups: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
  },
  groupIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  groupCopy: { flex: 1, gap: 2 },
  groupTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  groupSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  groupCount: {
    minWidth: 27,
    height: 27,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  projectList: { gap: 9 },
  projectCard: {
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressedCard: { opacity: 0.82 },
  projectCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectCode: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  projectName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 1,
  },
  caserioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  caserioText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  projectCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
  },
  pendingPill: { backgroundColor: colors.warningBackground },
  syncedPill: { backgroundColor: colors.accentLight },
  syncLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  pendingLabel: { color: colors.offline },
  syncedLabel: { color: colors.online },
  fichaCount: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerBackground,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 11,
    lineHeight: 16,
  },
  retryText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    padding: spacing.lg,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
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
    fontWeight: '700',
    lineHeight: 17,
  },
});
