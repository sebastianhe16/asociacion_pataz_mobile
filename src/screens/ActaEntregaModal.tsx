import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { WarehouseMovementRecord } from '../core/types';
import { colors, spacing } from '../core/theme';
import { shareDeliveryActPdf } from '../services/pdf/actaPdfService';
import { parseSignaturePaths, createPassportHash } from '../services/warehouse/passportIntegrity';

interface ActaEntregaModalProps {
  visible: boolean;
  movement: WarehouseMovementRecord | null;
  onClose: () => void;
}

type IntegrityState = 'checking' | 'verified' | 'invalid';
interface IntegrityResult {
  movementId: string;
  state: IntegrityState;
  error: string | null;
}

interface ExportResult {
  movementId: string;
  message: string;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' });
}

function PassportField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function ActaEntregaModal({
  visible,
  movement,
  onClose,
}: ActaEntregaModalProps) {
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const integrity = movement && integrityResult?.movementId === movement.id
    ? integrityResult.state
    : 'checking';
  const integrityError = movement && integrityResult?.movementId === movement.id
    ? integrityResult.error
    : null;
  const exportMessage = movement && exportResult?.movementId === movement.id
    ? exportResult.message
    : null;

  useEffect(() => {
    if (!visible || !movement) {
      return undefined;
    }

    let active = true;

    const verify = async () => {
      if (!movement.hashSha256 || !movement.receptorDni || !movement.firmaSvgPaths) {
        setIntegrityResult({
          movementId: movement.id,
          state: 'invalid',
          error: 'Faltan datos necesarios para verificar el sello local.',
        });
        return;
      }

      try {
        const computedHash = await createPassportHash({
          id: movement.id,
          insumoCodigo: movement.insumoCodigo,
          cantidad: movement.cantidad,
          almacenId: movement.almacenId,
          receptorDni: movement.receptorDni,
          latitud: movement.latitud,
          longitud: movement.longitud,
          timestamp: movement.timestamp,
          firmaSvgPaths: movement.firmaSvgPaths,
        });
        if (active) {
          setIntegrityResult({
            movementId: movement.id,
            state: computedHash === movement.hashSha256 ? 'verified' : 'invalid',
            error: null,
          });
        }
      } catch (error) {
        if (active) {
          setIntegrityResult({
            movementId: movement.id,
            state: 'invalid',
            error: error instanceof Error
              ? error.message
              : 'No se pudo verificar el sello local.',
          });
        }
      }
    };

    void Promise.resolve().then(verify);
    return () => {
      active = false;
    };
  }, [movement, visible]);

  const exportPdf = async () => {
    if (!movement) {
      return;
    }

    setIsExporting(true);
    try {
      await shareDeliveryActPdf(movement);
      setExportResult({
        movementId: movement.id,
        message: 'Acta PDF preparada para guardar o compartir.',
      });
    } catch (error) {
      setExportResult({
        movementId: movement.id,
        message: error instanceof Error ? error.message : 'No se pudo generar el acta PDF.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const signaturePaths = parseSignaturePaths(movement?.firmaSvgPaths ?? null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ASOCIACIÓN PATAZ</Text>
            <Text style={styles.title}>Acta Digital de Entrega</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar acta"
            onPress={onClose}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        {movement && (
          <>
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.integrityCard}>
                <View style={styles.integrityIcon}>
                  <MaterialCommunityIcons
                    name={integrity === 'verified' ? 'shield-check' : 'shield-alert-outline'}
                    size={22}
                    color={integrity === 'verified' ? colors.online : colors.error}
                  />
                </View>
                <View style={styles.integrityCopy}>
                  <Text style={styles.integrityTitle}>
                    {integrity === 'checking'
                      ? 'Verificando integridad local…'
                      : integrity === 'verified'
                        ? 'Integridad local verificada'
                        : 'Integridad no verificada'}
                  </Text>
                  {integrityError && <Text style={styles.errorText}>{integrityError}</Text>}
                  <Text style={styles.integrityHint}>
                    El hash aporta trazabilidad local; no es una firma digital certificada.
                  </Text>
                </View>
                {integrity === 'checking' && <ActivityIndicator color={colors.primary} />}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Detalle de la entrega</Text>
                <View style={styles.fieldGrid}>
                  <PassportField label="Almacén origen" value={movement.almacenNombre} />
                  <PassportField label="Fecha y hora" value={formatTimestamp(movement.timestamp)} />
                  <PassportField
                    label="Insumo"
                    value={`${movement.insumoNombre} · ${movement.insumoCodigo}`}
                  />
                  <PassportField label="Cantidad" value={String(movement.cantidad)} />
                  <PassportField label="Destino" value={movement.destinoCaserio ?? 'No especificado'} />
                  <PassportField label="Responsable" value={movement.responsable} />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Receptor</Text>
                <View style={styles.fieldGrid}>
                  <PassportField label="Nombre completo" value={movement.receptorNombre ?? 'No registrado'} />
                  <PassportField label="DNI" value={movement.receptorDni ?? 'No registrado'} />
                  <PassportField label="Cargo u organización" value={movement.receptorCargo ?? 'No registrado'} />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Ubicación de entrega</Text>
                <View style={styles.fieldGrid}>
                  <PassportField
                    label="Latitud"
                    value={movement.latitud === null ? 'No registrada' : movement.latitud.toFixed(6)}
                  />
                  <PassportField
                    label="Longitud"
                    value={movement.longitud === null ? 'No registrada' : movement.longitud.toFixed(6)}
                  />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Evidencia fotográfica</Text>
                {movement.fotoUri ? (
                  <Image source={{ uri: movement.fotoUri }} style={styles.photo} />
                ) : (
                  <Text style={styles.mutedText}>No se adjuntó una fotografía.</Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Firma del receptor</Text>
                {signaturePaths ? (
                  <View style={styles.signature}>
                    <Svg width="100%" height="100%" viewBox="0 0 320 140">
                      {signaturePaths.map((path, index) => (
                        <Path
                          key={`${index}-${path.length}`}
                          d={path}
                          fill="none"
                          stroke={colors.primaryDark}
                          strokeWidth={2.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </Svg>
                  </View>
                ) : (
                  <Text style={styles.errorText}>La firma guardada no se puede interpretar.</Text>
                )}
                <Text style={styles.mutedText}>
                  {movement.receptorNombre} · DNI {movement.receptorDni}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Sello criptográfico SHA-256</Text>
                <Text selectable style={styles.hash}>
                  {movement.hashSha256 ?? 'No disponible'}
                </Text>
                <View style={styles.complianceNote}>
                  <MaterialCommunityIcons name="file-document-check-outline" size={18} color={colors.offline} />
                  <Text style={styles.complianceText}>
                    Registro documental de apoyo APCI/SUNAT, sujeto a revisión institucional.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              {exportMessage && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={exportMessage.startsWith('Acta') ? styles.successText : styles.errorText}
                >
                  {exportMessage}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={isExporting || integrity !== 'verified'}
                onPress={exportPdf}
                style={[
                  styles.exportButton,
                  (isExporting || integrity !== 'verified') && styles.disabledButton,
                ]}
              >
                {isExporting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="file-pdf-box" size={21} color={colors.onPrimary} />
                    <Text style={styles.exportButtonText}>Descargar / Compartir Acta en PDF</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    fontSize: 19,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  integrityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  integrityIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  integrityCopy: { flex: 1, gap: 4 },
  integrityTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  integrityHint: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  field: {
    flexBasis: '45%',
    flexGrow: 1,
    gap: 3,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  photo: {
    width: '100%',
    height: 190,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  signature: {
    height: 125,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  mutedText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  hash: {
    color: colors.primaryDark,
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 16,
  },
  complianceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.warningBackground,
  },
  complianceText: {
    flex: 1,
    color: colors.offline,
    fontSize: 10,
    lineHeight: 15,
  },
  errorText: {
    color: colors.error,
    fontSize: 11,
    lineHeight: 16,
  },
  successText: {
    color: colors.online,
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  exportButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    backgroundColor: colors.primary,
  },
  exportButtonText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: { opacity: 0.6 },
});
