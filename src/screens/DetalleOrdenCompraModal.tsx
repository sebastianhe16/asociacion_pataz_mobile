import { useState } from 'react';
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
import type { EstadoOrdenCompra, OrdenCompra } from '../core/types';
import type { UsuarioSesion } from '../core/types/auth';
import { colors, spacing } from '../core/theme';
import { InfoBanner, StepIndicator } from '../components/StepIndicator';

interface DetalleOrdenCompraModalProps {
  visible: boolean;
  order: OrdenCompra | null;
  user: UsuarioSesion;
  onClose: () => void;
  onReview: (decision: 'APROBADA' | 'RECHAZADA', observation: string) => Promise<void>;
  onAttend: () => Promise<void>;
  onRegisterExit: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export default function DetalleOrdenCompraModal({
  visible,
  order,
  user,
  onClose,
  onReview,
  onAttend,
  onRegisterExit,
}: DetalleOrdenCompraModalProps) {
  const [observation, setObservation] = useState('');
  const [busyAction, setBusyAction] = useState<'APROBADA' | 'RECHAZADA' | 'ATENDIDA' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!order) {
    return null;
  }

  const canReview = user.roleKey === 'ADMIN' && order.estado === 'PENDIENTE';
  const canAttend =
    (user.roleKey === 'CAMPO' || user.roleKey === 'LOGISTICA') &&
    order.estado === 'APROBADA';
  const orderStep = order.estado === 'ATENDIDA' ? 2 : order.estado === 'APROBADA' ? 1 : 0;

  async function runAction(action: 'APROBADA' | 'RECHAZADA' | 'ATENDIDA') {
    setError(null);
    setBusyAction(action);
    try {
      if (action === 'ATENDIDA') {
        await onAttend();
      } else {
        await onReview(action, observation);
      }
      setObservation('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo actualizar la orden.');
    } finally {
      setBusyAction(null);
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
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ORDEN DE COMPRA</Text>
            <Text style={styles.title}>{order.codigoOrden}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar detalle" onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, statusStyle[order.estado]]}>
              <Text style={[styles.statusText, statusTextStyle[order.estado]]}>{order.estado}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Flujo de atención</Text>
              <StepIndicator
                steps={['Solicitada', 'Aprobada', 'Atendida']}
                currentStep={orderStep}
              />
            </View>
            <Text style={styles.priority}>Prioridad {order.prioridad.toLocaleLowerCase()}</Text>
          </View>

          <InfoCard icon="clipboard-text-outline" title="Proyecto" value={order.proyectoNombre} detail={`Destino: ${order.almacenDestinoNombre}`} />
          <InfoCard icon="account-outline" title="Solicitante" value={order.solicitanteNombre} detail={`Solicitada: ${formatDate(order.fechaSolicitud)}`} />
          <InfoCard icon="text-box-check-outline" title="Justificación" value={order.justificacion} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Materiales solicitados</Text>
            {order.items.map((item, index) => (
              <View key={`${order.id}-item-${index}`} style={styles.orderItem}>
                <View style={styles.orderItemCopy}>
                  <Text style={styles.orderItemName}>{item.nombre}</Text>
                  <Text style={styles.detailText}>{item.insumoId ? 'Insumo del catálogo' : 'Material requerido'}</Text>
                </View>
                <Text style={styles.orderItemQuantity}>{item.cantidad} {item.unidad}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trazabilidad</Text>
            <TimelineRow label="Solicitud" value={formatDate(order.fechaSolicitud)} />
            <TimelineRow label="Revisión" value={formatDate(order.fechaRevision)} />
            {order.aprobadoPorNombre && <TimelineRow label="Revisado por" value={order.aprobadoPorNombre} />}
            {order.observacionRevision && <TimelineRow label="Observación" value={order.observacionRevision} />}
            {order.fechaAtendida && <TimelineRow label="Atendida" value={formatDate(order.fechaAtendida)} />}
            <TimelineRow label="Estado de envío SISGEAP" value={order.syncStatus === 'SYNCED' ? 'Sincronizada' : 'Pendiente de sincronizar'} />
          </View>

          {canReview ? (
            <View style={styles.actionPanel}>
              <Text style={styles.cardTitle}>¿Qué sigue ahora?</Text>
              <InfoBanner
                message="Revisa el requerimiento y aprueba o rechaza la solicitud."
                tone="warning"
                icon="shield-account-outline"
              />
              <TextInput
                accessibilityLabel="Observación de revisión"
                value={observation}
                onChangeText={setObservation}
                placeholder="Observación opcional"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                multiline
              />
              <View style={styles.actionsRow}>
                <ActionButton
                  label="Rechazar"
                  icon="close-circle-outline"
                  disabled={busyAction !== null}
                  isBusy={busyAction === 'RECHAZADA'}
                  onPress={() => void runAction('RECHAZADA')}
                  secondary
                />
                <ActionButton
                  label="Aprobar orden"
                  icon="check-circle-outline"
                  disabled={busyAction !== null}
                  isBusy={busyAction === 'APROBADA'}
                  onPress={() => void runAction('APROBADA')}
                />
              </View>
            </View>
          ) : order.estado === 'APROBADA' ? (
            <View style={styles.actionPanel}>
              <Text style={styles.cardTitle}>¿Qué sigue ahora?</Text>
              <InfoBanner
                message="La orden está aprobada. Registra la salida de almacén y completa el pasaporte fiduciario."
                tone="success"
                icon="check-circle-outline"
              />
              <ActionButton
                label="Registrar salida en Almacén ahora"
                icon="truck-fast-outline"
                disabled={busyAction !== null}
                isBusy={false}
                onPress={onRegisterExit}
              />
              {canAttend && (
                <ActionButton
                  label="Confirmar orden atendida"
                  icon="truck-check-outline"
                  disabled={busyAction !== null}
                  isBusy={busyAction === 'ATENDIDA'}
                  onPress={() => void runAction('ATENDIDA')}
                  secondary
                />
              )}
            </View>
          ) : order.estado === 'PENDIENTE' ? (
            <View style={styles.notice}>
              <MaterialCommunityIcons name="shield-account-outline" size={20} color={colors.primary} />
              <Text style={styles.noticeText}>En espera de revisión por Gerencia.</Text>
            </View>
          ) : null}
          {error && (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function InfoCard({ icon, title, value, detail }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; value: string; detail?: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.valueText}>{value}</Text>
      {detail && <Text style={styles.detailText}>{detail}</Text>}
    </View>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timelineRow}>
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={styles.timelineValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  disabled,
  isBusy,
  onPress,
  secondary = false,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled: boolean;
  isBusy: boolean;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, secondary ? styles.secondaryButton : styles.primaryButton, disabled && styles.disabledButton]}
    >
      {isBusy ? (
        <ActivityIndicator size="small" color={secondary ? colors.error : colors.onPrimary} />
      ) : (
        <MaterialCommunityIcons name={icon} size={18} color={secondary ? colors.error : colors.onPrimary} />
      )}
      <Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

const statusStyle: Record<EstadoOrdenCompra, object> = {
  PENDIENTE: { backgroundColor: colors.warningBackground },
  APROBADA: { backgroundColor: colors.accentLight },
  RECHAZADA: { backgroundColor: colors.dangerBackground },
  ATENDIDA: { backgroundColor: '#E4F1F5' },
};

const statusTextStyle: Record<EstadoOrdenCompra, object> = {
  PENDIENTE: { color: colors.offline },
  APROBADA: { color: colors.online },
  RECHAZADA: { color: colors.error },
  ATENDIDA: { color: '#24647C' },
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 9, fontWeight: '800' },
  priority: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  card: {
    gap: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  valueText: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  detailText: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderItemCopy: { flex: 1, gap: 2 },
  orderItemName: { color: colors.text, fontSize: 11, fontWeight: '700' },
  orderItemQuantity: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  timelineLabel: { color: colors.textSecondary, fontSize: 10 },
  timelineValue: { flex: 1, color: colors.text, fontSize: 10, fontWeight: '600', textAlign: 'right' },
  actionPanel: { gap: 10, padding: 13, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: {
    minHeight: 43,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontSize: 11,
    backgroundColor: colors.background,
  },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 10,
  },
  primaryButton: { backgroundColor: colors.primary },
  secondaryButton: { backgroundColor: colors.dangerBackground },
  disabledButton: { opacity: 0.6 },
  actionButtonText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  secondaryButtonText: { color: colors.error },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight },
  noticeText: { flex: 1, color: colors.primary, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 10, backgroundColor: colors.dangerBackground },
  errorText: { flex: 1, color: colors.error, fontSize: 10 },
});
