import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  AprobarDecisionGerencialInput,
  EjeProyecto,
} from '../core/types';
import type { InventoryBalance } from '../database/db';
import type { DonationSurplusOpportunity } from '../services/inventory/desbalanceService';
import { approveManagerialDecision } from '../database/db';
import { colors, spacing } from '../core/theme';
import { useAuth } from '../services/auth/AuthProvider';

type DecisionMode = 'DONATION' | 'DEFICIT';
type ProjectAxis = Extract<EjeProyecto, 'Salud' | 'Agricultura' | 'Educación'>;

interface DecisionGerencialModalProps {
  visible: boolean;
  mode: DecisionMode;
  item: InventoryBalance | DonationSurplusOpportunity;
  onClose: () => void;
  onSaved: () => void;
}

const PROJECT_AXES: ProjectAxis[] = ['Salud', 'Agricultura', 'Educación'];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo registrar la decisión gerencial.';
}

export default function DecisionGerencialModal({
  visible,
  mode,
  item,
  onClose,
  onSaved,
}: DecisionGerencialModalProps) {
  const { user } = useAuth();
  const maxQuantity = mode === 'DONATION' && 'excedenteDonado' in item
    ? item.excedenteDonado
    : Math.abs(item.diferencia);
  const [projectName, setProjectName] = useState('');
  const [caserio, setCaserio] = useState('');
  const [axis, setAxis] = useState<ProjectAxis>('Agricultura');
  const [quantity, setQuantity] = useState(String(maxQuantity));
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isDonation = mode === 'DONATION';
  const isAdmin = user?.roleKey === 'ADMIN';

  async function approveDecision() {
    if (!user || !isAdmin) {
      Alert.alert(
        'Aprobación restringida',
        'Se requiere perfil de Gerencia/Administración para aprobar esta decisión.',
      );
      return;
    }
    const parsedQuantity = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > maxQuantity) {
      setError(`Ingresa una cantidad entre 1 y ${maxQuantity} ${item.unidad}.`);
      return;
    }
    if (resolution.trim().length < 8) {
      setError('Describe brevemente el criterio o resolución gerencial.');
      return;
    }
    if (isDonation && (projectName.trim().length < 4 || caserio.trim().length < 2)) {
      setError('Completa el nombre del proyecto y el caserío de intervención.');
      return;
    }

    const input: AprobarDecisionGerencialInput = {
      tipo: isDonation ? 'NUEVO_PROYECTO_DONACION' : 'ABASTECIMIENTO_DESBALANCE',
      titulo: isDonation
        ? `Apertura de proyecto: ${projectName.trim()}`
        : `Abastecimiento por déficit: ${item.nombre}`,
      detalle: resolution.trim(),
      insumoId: item.id,
      insumoRelacionado: `${item.nombre} (${item.codigo})`,
      cantidadInvolucrada: parsedQuantity,
      caserioOProyectoDestino: isDonation
        ? `${projectName.trim()} · ${caserio.trim()}`
        : item.almacenNombre,
      ...(isDonation
        ? {
          nuevoProyecto: {
            nombre: projectName.trim(),
            eje: axis,
            caserio: caserio.trim(),
          },
        }
        : {}),
    };

    setIsSaving(true);
    setError(null);
    try {
      await approveManagerialDecision(input, user);
      setSuccess(
        isDonation
          ? `Proyecto «${projectName.trim()}» creado y resolución registrada.`
          : `Decisión de abastecimiento registrada para ${item.nombre}.`,
      );
      onSaved();
    } catch (cause: unknown) {
      setError(getErrorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  }

  function closeModal() {
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeModal}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons
                name={isDonation ? 'sprout-outline' : 'cart-check'}
                size={21}
                color={colors.primary}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>RESOLUCIÓN EJECUTIVA</Text>
              <Text style={styles.title}>
                {isDonation ? 'Apertura de proyecto' : 'Abastecimiento por déficit'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar decisión gerencial"
              onPress={closeModal}
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
            <View style={styles.contextCard}>
              <View style={styles.contextTopline}>
                <View style={styles.contextIcon}>
                  <MaterialCommunityIcons
                    name={isDonation ? 'gift-outline' : 'alert-outline'}
                    size={20}
                    color={isDonation ? colors.online : colors.error}
                  />
                </View>
                <View style={styles.contextCopy}>
                  <Text style={styles.contextName}>{item.nombre}</Text>
                  <Text style={styles.contextLocation}>{item.almacenNombre} · {item.codigo}</Text>
                </View>
              </View>
              <View style={styles.contextMetrics}>
                <ContextMetric label="Stock" value={`${item.stockActual} ${item.unidad}`} />
                <ContextMetric label="Solicitado" value={`${item.cantidadSolicitada} ${item.unidad}`} />
                <ContextMetric
                  label={isDonation ? 'Excedente' : 'Déficit'}
                  value={`${isDonation ? '+' : ''}${isDonation ? maxQuantity : item.diferencia} ${item.unidad}`}
                  accent
                />
              </View>
            </View>

            {success ? (
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <MaterialCommunityIcons name="check-decagram" size={30} color={colors.online} />
                </View>
                <Text style={styles.successTitle}>Decisión aprobada</Text>
                <Text style={styles.successText}>{success}</Text>
                <Pressable accessibilityRole="button" onPress={closeModal} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Listo</Text>
                </Pressable>
              </View>
            ) : !isAdmin ? (
              <View style={styles.restrictedCard}>
                <MaterialCommunityIcons name="lock-outline" size={22} color={colors.offline} />
                <View style={styles.restrictedCopy}>
                  <Text style={styles.restrictedTitle}>Aprobación reservada</Text>
                  <Text style={styles.restrictedText}>
                    Se requiere perfil de Gerencia/Administración para aprobar y registrar esta resolución.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {isDonation ? (
                  <>
                    <Field label="Nombre del nuevo proyecto *">
                      <TextInput
                        accessibilityLabel="Nombre del nuevo proyecto"
                        value={projectName}
                        onChangeText={setProjectName}
                        placeholder="Ej. Ampliación agrícola comunitaria"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.textInput}
                        autoCapitalize="sentences"
                      />
                    </Field>
                    <Field label="Eje de intervención *">
                      <View style={styles.axisRow}>
                        {PROJECT_AXES.map((option) => (
                          <Pressable
                            key={option}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: axis === option }}
                            onPress={() => setAxis(option)}
                            style={[styles.axisChip, axis === option && styles.axisChipSelected]}
                          >
                            <Text style={[styles.axisText, axis === option && styles.axisTextSelected]}>
                              {option}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </Field>
                    <Field label="Caserío de intervención *">
                      <TextInput
                        accessibilityLabel="Caserío de intervención"
                        value={caserio}
                        onChangeText={setCaserio}
                        placeholder="Nombre del caserío"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.textInput}
                        autoCapitalize="words"
                      />
                    </Field>
                  </>
                ) : (
                  <View style={styles.impactNote}>
                    <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
                    <Text style={styles.impactText}>
                      Registra la decisión ejecutiva para cubrir la brecha identificada. La orden de compra conserva su flujo de aprobación independiente.
                    </Text>
                  </View>
                )}

                <Field label={`Cantidad a asignar · máximo ${maxQuantity} ${item.unidad}`}>
                  <View style={styles.quantityBox}>
                    <TextInput
                      accessibilityLabel="Cantidad involucrada en la decisión"
                      value={quantity}
                      onChangeText={(value) => setQuantity(value.replace(/[^\d.,]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.quantityInput}
                    />
                    <Text style={styles.unitText}>{item.unidad}</Text>
                  </View>
                </Field>
                <Field label="Resolución gerencial *">
                  <TextInput
                    accessibilityLabel="Resolución gerencial"
                    value={resolution}
                    onChangeText={setResolution}
                    placeholder={
                      isDonation
                        ? 'Criterio y alcance de la intervención aprobada'
                        : 'Justificación y criterio de abastecimiento'
                    }
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.textInput, styles.multilineInput]}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                </Field>
                {error && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text>}
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void approveDecision()}
                  style={[styles.primaryButton, isSaving && styles.disabledButton]}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check-circle-outline" size={19} color={colors.onPrimary} />
                      <Text style={styles.primaryButtonText}>
                        {isDonation ? 'Aprobar Apertura de Proyecto' : 'Aprobar Decisión de Compra'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ContextMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.contextMetric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  contextCard: {
    gap: spacing.sm,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  contextTopline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contextIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  contextCopy: { flex: 1, gap: 3 },
  contextName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  contextLocation: { color: colors.textSecondary, fontSize: 9 },
  contextMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  contextMetric: { flex: 1, gap: 3 },
  metricLabel: { color: colors.textSecondary, fontSize: 9 },
  metricValue: { color: colors.text, fontSize: 10, fontWeight: '800' },
  metricAccent: { color: colors.primary },
  field: { gap: 7 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  textInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.surface,
  },
  multilineInput: { minHeight: 92, paddingTop: 11 },
  axisRow: { flexDirection: 'row', gap: 7 },
  axisChip: {
    flex: 1,
    minHeight: 37,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  axisChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  axisText: { color: colors.textSecondary, fontSize: 9, fontWeight: '700' },
  axisTextSelected: { color: colors.primary },
  quantityBox: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  quantityInput: { flex: 1, height: 45, color: colors.text, fontSize: 15, fontWeight: '800' },
  unitText: { color: colors.textSecondary, fontSize: 11 },
  impactNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
  },
  impactText: { flex: 1, color: colors.primaryDark, fontSize: 10, lineHeight: 15 },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
  disabledButton: { opacity: 0.7 },
  errorText: {
    padding: 10,
    borderRadius: 10,
    color: colors.error,
    fontSize: 11,
    backgroundColor: colors.dangerBackground,
  },
  successCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  successIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: colors.accentLight,
  },
  successTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  successText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  restrictedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: 13,
    borderWidth: 1,
    borderColor: '#F0D8B9',
    borderRadius: 13,
    backgroundColor: colors.warningBackground,
  },
  restrictedCopy: { flex: 1, gap: 4 },
  restrictedTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  restrictedText: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
});
