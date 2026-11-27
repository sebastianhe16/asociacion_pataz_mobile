import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  EstadoEnvio,
  HitoTracking,
  WarehouseMovementRecord,
} from '../core/types';
import { colors, spacing } from '../core/theme';
import { InfoBanner, StepIndicator } from '../components/StepIndicator';
import {
  advanceShipmentTracking,
  getWarehouseMovementDetails,
} from '../database/db';
import { useAuth } from '../services/auth/AuthProvider';
import { useNetworkStatus } from '../services/sync/NetworkProvider';
import { useSyncStatus } from '../services/sync/SyncProvider';

const STEPS: { estado: EstadoEnvio; titulo: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { estado: 'REGISTRADO_ALMACEN', titulo: 'Registrado en Almacén', icon: 'warehouse' },
  { estado: 'EN_TRANSITO', titulo: 'En Tránsito', icon: 'truck-fast-outline' },
  { estado: 'EN_PUNTO_ENTREGA', titulo: 'En Punto de Entrega', icon: 'map-marker-check-outline' },
  { estado: 'ENTREGADO', titulo: 'Entregado', icon: 'check-decagram-outline' },
];

interface TrackingEnvioModalProps {
  visible: boolean;
  movement: WarehouseMovementRecord | null;
  onClose: () => void;
  onUpdated?: (movement: WarehouseMovementRecord) => void;
}

function parseHistory(value: string | null): HitoTracking[] {
  if (!value) {
    return [];
  }
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('El historial de seguimiento no tiene un formato válido.');
  }
  return parsed.filter((entry: unknown): entry is HitoTracking => {
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }
    const milestone = entry as Record<string, unknown>;
    return typeof milestone.estado === 'string'
      && STEPS.some((step) => step.estado === milestone.estado)
      && typeof milestone.titulo === 'string'
      && typeof milestone.descripcion === 'string'
      && typeof milestone.fechaHora === 'string'
      && typeof milestone.responsable === 'string';
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
}

export default function TrackingEnvioModal({
  visible,
  movement,
  onClose,
  onUpdated,
}: TrackingEnvioModalProps) {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { synchronize } = useSyncStatus();
  const [currentMovement, setCurrentMovement] = useState<WarehouseMovementRecord | null>(movement);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const canAdvance = user?.roleKey === 'ADMIN' || user?.roleKey === 'LOGISTICA';
  const movementId = movement?.id;

  useEffect(() => {
    if (!visible || !movementId) {
      return;
    }
    let active = true;
    getWarehouseMovementDetails(movementId)
      .then((latest) => {
        if (active && latest) {
          setCurrentMovement(latest);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el seguimiento.');
        }
      });
    return () => {
      active = false;
    };
  }, [movementId, visible]);

  const parsedHistory = useMemo(() => {
    try {
      return {
        history: parseHistory(currentMovement?.historialTrackingJson ?? null),
        error: null,
      };
    } catch (cause: unknown) {
      return {
        history: [],
        error: cause instanceof Error ? cause.message : 'El historial no es válido.',
      };
    }
  }, [currentMovement?.historialTrackingJson]);
  const history = parsedHistory.history;
  const currentStep = STEPS.findIndex((step) => step.estado === currentMovement?.estadoEnvio);
  const nextStep = STEPS[currentStep + 1];

  async function advanceTracking() {
    if (!currentMovement || !user) {
      setError('No se pudo identificar el envío o la sesión actual.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await advanceShipmentTracking(currentMovement.id, note, user);
      setCurrentMovement(updated);
      setNote('');
      const syncResult = isOnline ? await synchronize() : null;
      const latest = await getWarehouseMovementDetails(updated.id);
      const finalMovement = latest ?? updated;
      setCurrentMovement(finalMovement);
      setConfirmationMessage(syncResult !== null && syncResult.remainingCount === 0
        ? 'Etapa actualizada y sincronizada con SISGEAP.'
        : 'Etapa actualizada en el dispositivo; queda pendiente de sincronización.');
      onUpdated?.(finalMovement);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el seguimiento.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="truck-fast-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SEGUIMIENTO DE ENVÍO</Text>
            <Text style={styles.title}>{currentMovement?.codigoEnvio ?? 'Envío'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar seguimiento"
            onPress={onClose}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={21} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentMovement ? (
            <>
              <StepIndicator
                steps={['Almacén', 'En Ruta', 'En Destino', 'Entregado']}
                currentStep={Math.max(currentStep, 0)}
              />
              {confirmationMessage && (
                <InfoBanner
                  message={confirmationMessage}
                  tone={confirmationMessage.includes('sincronizada') ? 'success' : 'warning'}
                  icon="check-circle-outline"
                />
              )}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="warehouse" size={18} color={colors.primary} />
                  <View style={styles.summaryCopy}>
                    <Text style={styles.summaryLabel}>SEDE DE ORIGEN</Text>
                    <Text style={styles.summaryValue}>{currentMovement.almacenNombre}</Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.primary} />
                  <View style={styles.summaryCopy}>
                    <Text style={styles.summaryLabel}>DESTINO</Text>
                    <Text style={styles.summaryValue}>{currentMovement.destinoCaserio ?? 'Sin destino indicado'}</Text>
                  </View>
                </View>
                <View style={styles.parcelDetail}>
                  <Text style={styles.parcelName}>{currentMovement.insumoNombre}</Text>
                  <Text style={styles.parcelQuantity}>
                    {currentMovement.cantidad} {currentMovement.insumoUnidad} · {currentMovement.insumoCodigo}
                  </Text>
                </View>
              </View>

              <View style={styles.statusBanner}>
                <View style={styles.statusPulse}>
                  <MaterialCommunityIcons
                    name={STEPS[Math.max(currentStep, 0)]?.icon ?? 'package-variant'}
                    size={19}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusLabel}>ESTADO ACTUAL</Text>
                  <Text style={styles.statusTitle}>
                    {STEPS[Math.max(currentStep, 0)]?.titulo ?? 'Estado no disponible'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Historial de seguimiento</Text>
              <View style={styles.timeline}>
                {STEPS.map((step, index) => {
                  const milestone = history.find((entry) => entry.estado === step.estado);
                  const completed = index <= currentStep;
                  const active = index === currentStep;
                  return (
                    <View key={step.estado} style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <View
                          style={[
                            styles.timelineDot,
                            completed && styles.timelineDotCompleted,
                            active && styles.timelineDotActive,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={completed ? 'check' : step.icon}
                            size={13}
                            color={completed ? colors.onPrimary : colors.textSecondary}
                          />
                        </View>
                        {index < STEPS.length - 1 && (
                          <View style={[styles.timelineLine, completed && styles.timelineLineCompleted]} />
                        )}
                      </View>
                      <View style={[styles.milestoneCard, !completed && styles.milestoneCardPending]}>
                        <Text style={[styles.milestoneTitle, !completed && styles.milestoneTitlePending]}>
                          {step.titulo}
                        </Text>
                        {milestone ? (
                          <>
                            <Text style={styles.milestoneDescription}>{milestone.descripcion}</Text>
                            <Text style={styles.milestoneDate}>{formatDate(milestone.fechaHora)}</Text>
                            <Text style={styles.milestoneResponsible}>Responsable: {milestone.responsable}</Text>
                          </>
                        ) : (
                          <Text style={styles.milestoneWaiting}>Etapa pendiente</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {nextStep && canAdvance && (
                <View style={styles.advanceSection}>
                  <Text style={styles.sectionTitle}>Actualizar etapa</Text>
                  <TextInput
                    accessibilityLabel="Nota de control de envío"
                    value={note}
                    onChangeText={setNote}
                    placeholder={`Nota para «${nextStep.titulo}»`}
                    placeholderTextColor={colors.textSecondary}
                    style={styles.noteInput}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() => void advanceTracking()}
                    style={[styles.advanceButton, isSaving && styles.disabledButton]}
                  >
                    {isSaving ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="arrow-right-circle-outline" size={19} color={colors.onPrimary} />
                        <Text style={styles.advanceButtonText}>
                          {currentStep === 0
                            ? 'Confirmar salida a ruta (En Tránsito)'
                            : currentStep === 1
                              ? 'Confirmar llegada a destino (En Punto de Entrega)'
                              : 'Confirmar entrega final en destino'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
              {currentStep === STEPS.length - 1 && (
                <View style={styles.deliveredBanner}>
                  <MaterialCommunityIcons name="check-decagram" size={19} color={colors.online} />
                  <Text style={styles.deliveredText}>Entrega registrada</Text>
                </View>
              )}
              {!canAdvance && currentStep < STEPS.length - 1 && (
                <Text style={styles.accessNote}>
                  La actualización de etapas está disponible para Administración y Logística.
                </Text>
              )}
            </>
          ) : (
            <View style={styles.loading}>
              <Text style={styles.mutedText}>No se encontró el registro del envío.</Text>
            </View>
          )}
          {(error ?? parsedHistory.error) && (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {error ?? parsedHistory.error}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
  },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  mutedText: { color: colors.textSecondary, fontSize: 12 },
  summaryCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryCopy: { flex: 1, gap: 2 },
  summaryLabel: { color: colors.textSecondary, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  summaryValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  parcelDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  parcelName: { flex: 1, color: colors.textSecondary, fontSize: 11 },
  parcelQuantity: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  statusPulse: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  statusCopy: { gap: 3 },
  statusLabel: { color: colors.primary, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  statusTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 85, flexDirection: 'row', gap: 11 },
  timelineRail: { width: 27, alignItems: 'center' },
  timelineDot: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
    zIndex: 1,
  },
  timelineDotCompleted: { borderColor: colors.online, backgroundColor: colors.online },
  timelineDotActive: { borderWidth: 3, borderColor: '#B9DCC4' },
  timelineLine: { width: 2, flex: 1, marginVertical: -1, backgroundColor: colors.border },
  timelineLineCompleted: { backgroundColor: colors.online },
  milestoneCard: {
    flex: 1,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  milestoneCardPending: { backgroundColor: '#F8F9F8' },
  milestoneTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  milestoneTitlePending: { color: colors.textSecondary },
  milestoneDescription: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
  milestoneDate: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  milestoneResponsible: { color: colors.textSecondary, fontSize: 9 },
  milestoneWaiting: { color: colors.textSecondary, fontSize: 9 },
  advanceSection: { gap: spacing.sm, paddingTop: spacing.xs },
  noteInput: {
    minHeight: 82,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.surface,
  },
  advanceButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  advanceButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' },
  disabledButton: { opacity: 0.7 },
  deliveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
  },
  deliveredText: { color: colors.online, fontSize: 12, fontWeight: '800' },
  accessNote: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  errorText: {
    padding: 10,
    borderRadius: 10,
    color: colors.error,
    fontSize: 11,
    backgroundColor: colors.dangerBackground,
  },
});
