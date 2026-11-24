import { useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../core/theme';
import { parseSignaturePaths } from '../services/warehouse/passportIntegrity';

interface SignaturePadProps {
  value: string | null;
  onChange: (serializedPaths: string | null) => void;
}

interface SignaturePoint {
  x: number;
  y: number;
}

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 140;
const MIN_POINT_DISTANCE = 2;

function formatCoordinate(value: number): string {
  return value.toFixed(1);
}

function createPath(points: SignaturePoint[]): string {
  if (points.length === 0) {
    return '';
  }
  const firstPoint = points[0];
  const start = `M${formatCoordinate(firstPoint.x)},${formatCoordinate(firstPoint.y)}`;
  if (points.length === 1) {
    return `${start} L${formatCoordinate(firstPoint.x)},${formatCoordinate(firstPoint.y)}`;
  }
  return `${start}${points
    .slice(1)
    .map((point) => ` L${formatCoordinate(point.x)},${formatCoordinate(point.y)}`)
    .join('')}`;
}

export default function SignaturePad({ value, onChange }: SignaturePadProps) {
  const [savedPaths, setSavedPaths] = useState<string[]>(
    () => parseSignaturePaths(value) ?? [],
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [draftPreviewPaths, setDraftPreviewPaths] = useState<string[]>([]);
  const strokesRef = useRef<string[]>([]);
  const currentPointsRef = useRef<SignaturePoint[]>([]);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  function getCanvasPoint(locationX: number, locationY: number): SignaturePoint {
    const { width, height } = canvasSizeRef.current;
    return {
      x: (Math.max(0, Math.min(width, locationX)) / Math.max(width, 1)) * VIEWBOX_WIDTH,
      y: (Math.max(0, Math.min(height, locationY)) / Math.max(height, 1)) * VIEWBOX_HEIGHT,
    };
  }

  function appendPoint(locationX: number, locationY: number): boolean {
    const point = getCanvasPoint(locationX, locationY);
    const previousPoint = currentPointsRef.current[currentPointsRef.current.length - 1];
    if (previousPoint) {
      const { width, height } = canvasSizeRef.current;
      const distanceX = ((point.x - previousPoint.x) * width) / VIEWBOX_WIDTH;
      const distanceY = ((point.y - previousPoint.y) * height) / VIEWBOX_HEIGHT;
      if (Math.hypot(distanceX, distanceY) < MIN_POINT_DISTANCE) {
        return false;
      }
    }
    currentPointsRef.current.push(point);
    return true;
  }

  function finishCurrentStroke(): void {
    const path = createPath(currentPointsRef.current);
    if (path) {
      strokesRef.current = [...strokesRef.current, path];
    }
    currentPointsRef.current = [];
    setDraftPreviewPaths([...strokesRef.current]);
  }

  function refreshDraftPreview(): void {
    const currentPath = createPath(currentPointsRef.current);
    setDraftPreviewPaths(
      currentPath ? [...strokesRef.current, currentPath] : [...strokesRef.current],
    );
  }

  // PanResponder retains these refs in callbacks and reads them only during gestures.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      currentPointsRef.current = [];
      appendPoint(locationX, locationY);
      refreshDraftPreview();
    },
    onPanResponderMove: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      if (appendPoint(locationX, locationY)) {
        refreshDraftPreview();
      }
    },
    onPanResponderRelease: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      appendPoint(locationX, locationY);
      finishCurrentStroke();
    },
    onPanResponderTerminate: finishCurrentStroke,
  }));

  function openSignatureModal(): void {
    strokesRef.current = [];
    currentPointsRef.current = [];
    setDraftPreviewPaths([]);
    setModalVisible(true);
  }

  function cancelSignature(): void {
    strokesRef.current = [];
    currentPointsRef.current = [];
    setDraftPreviewPaths([]);
    setModalVisible(false);
  }

  function clearDraft(): void {
    strokesRef.current = [];
    currentPointsRef.current = [];
    setDraftPreviewPaths([]);
  }

  function saveSignature(): void {
    const finalPath = createPath(currentPointsRef.current);
    const completedPaths = finalPath
      ? [...strokesRef.current, finalPath]
      : [...strokesRef.current];
    setSavedPaths(completedPaths);
    onChange(completedPaths.length > 0 ? JSON.stringify(completedPaths) : null);
    strokesRef.current = [];
    currentPointsRef.current = [];
    setDraftPreviewPaths([]);
    setModalVisible(false);
  }

  function clearSavedSignature(): void {
    strokesRef.current = [];
    setSavedPaths([]);
    onChange(null);
  }

  return (
    <View style={styles.container}>
      {savedPaths.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tocar aquí para firmar"
          onPress={openSignatureModal}
          style={styles.previewCanvas}
        >
          <MaterialCommunityIcons name="gesture-tap" size={27} color={colors.primary} />
          <Text style={styles.previewHint}>Tocar aquí para firmar</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.previewCanvas}>
            <Svg
              pointerEvents="none"
              width="100%"
              height="100%"
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              preserveAspectRatio="none"
            >
              {savedPaths.map((path, index) => (
                <Path
                  key={index}
                  pointerEvents="none"
                  d={path}
                  fill="none"
                  stroke={colors.primaryDark}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          </View>
          <View style={styles.previewActions}>
            <Pressable
              accessibilityRole="button"
              onPress={openSignatureModal}
              style={styles.smallAction}
            >
              <MaterialCommunityIcons name="draw" size={15} color={colors.primary} />
              <Text style={styles.smallActionText}>Volver a firmar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={clearSavedSignature}
              style={styles.smallAction}
            >
              <MaterialCommunityIcons name="delete-outline" size={15} color={colors.error} />
              <Text style={styles.clearActionText}>Limpiar</Text>
            </Pressable>
          </View>
        </>
      )}

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={cancelSignature}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text style={styles.modalEyebrow}>EVIDENCIA DE ENTREGA</Text>
                <Text style={styles.modalTitle}>Firma del representante</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar firma"
                onPress={cancelSignature}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.instructions}>
              Firma con el dedo dentro del recuadro. La firma se guarda al confirmar.
            </Text>

            <View
              onLayout={({ nativeEvent }) => {
                canvasSizeRef.current = {
                  width: nativeEvent.layout.width,
                  height: nativeEvent.layout.height,
                };
              }}
              style={styles.modalCanvas}
            >
              <Svg
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                width="100%"
                height="100%"
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                preserveAspectRatio="none"
              >
                {draftPreviewPaths.map((path, index) => (
                  <Path
                    key={index}
                    pointerEvents="none"
                    d={path}
                    fill="none"
                    stroke={colors.primaryDark}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
              <View
                collapsable={false}
                pointerEvents="box-only"
                style={StyleSheet.absoluteFill}
                {...panResponder.panHandlers}
              />
              {draftPreviewPaths.length === 0 && (
                <View pointerEvents="none" style={styles.modalCanvasHint}>
                  <Text style={styles.previewHint}>Firme dentro del recuadro</Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={cancelSignature}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={clearDraft}
                style={[styles.modalButton, styles.clearModalButton]}
              >
                <Text style={styles.clearModalButtonText}>Limpiar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={draftPreviewPaths.length === 0}
                onPress={saveSignature}
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  draftPreviewPaths.length === 0 && styles.saveButtonDisabled,
                ]}
              >
                <Text style={styles.saveButtonText}>Guardar firma</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  previewCanvas: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  previewHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  smallAction: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
  },
  smallActionText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  clearActionText: {
    color: colors.error,
    fontSize: 10,
    fontWeight: '700',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalHeading: {
    flex: 1,
    gap: 4,
  },
  modalEyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  instructions: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  modalCanvas: {
    height: 260,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  modalCanvasHint: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  clearModalButton: {
    backgroundColor: colors.dangerBackground,
  },
  clearModalButtonText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
});
