import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EjeProyecto, ProyectoCampoResumen } from '../core/types';
import { colors, spacing } from '../core/theme';
import { insertFichaCampo } from '../database/db';

interface NuevaFichaCampoScreenProps {
  visible: boolean;
  project: ProyectoCampoResumen;
  onClose: () => void;
  onSaved: () => void;
}

interface CapturedCoordinates {
  latitude: number;
  longitude: number;
  source: 'GPS' | 'SIMULADA';
}

const ACTIVITIES_BY_AXIS: Record<EjeProyecto, string[]> = {
  Salud: [
    'Entrega de suplementos',
    'Control nutricional',
    'Orientación a la familia',
    'Jornada de salud comunitaria',
  ],
  Agricultura: [
    'Asistencia técnica agrícola',
    'Entrega de semillas y plantones',
    'Seguimiento de cultivo',
    'Capacitación productiva',
  ],
  Educación: [
    'Capacitación educativa',
    'Entrega de material escolar',
    'Acompañamiento escolar',
    'Reunión con docentes y familias',
  ],
  'Agua y saneamiento': [
    'Inspección del sistema de agua',
    'Capacitación en saneamiento',
    'Mantenimiento de infraestructura',
    'Orientación sobre agua segura',
  ],
};

const QUICK_NOTES = [
  'Entrega realizada',
  'Requiere seguimiento',
  'Participación activa',
  'Coordinar próxima visita',
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo guardar la ficha en la base local.';
}

function getSimulatedCoordinates(caserio: string): CapturedCoordinates {
  const hash = [...caserio].reduce((total, character) => total + character.charCodeAt(0), 0);
  const offset = (hash % 80) / 10_000;

  return {
    latitude: Number((-7.78 - offset).toFixed(6)),
    longitude: Number((-77.58 - offset).toFixed(6)),
    source: 'SIMULADA',
  };
}

export default function NuevaFichaCampoScreen({
  visible,
  project,
  onClose,
  onSaved,
}: NuevaFichaCampoScreenProps) {
  const [dni, setDni] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [activity, setActivity] = useState('');
  const [observations, setObservations] = useState('');
  const [coordinates, setCoordinates] = useState<CapturedCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activities = useMemo(
    () => ACTIVITIES_BY_AXIS[project.eje],
    [project.eje],
  );

  const captureCurrentLocation = async () => {
    setLocationError(null);
    setIsCapturingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Permiso de ubicación denegado. Puedes usar la coordenada simulada.');
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setCoordinates({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        source: 'GPS',
      });
    } catch (error) {
      setLocationError(getErrorMessage(error));
    } finally {
      setIsCapturingLocation(false);
    }
  };

  const simulateCoordinates = () => {
    setCoordinates(getSimulatedCoordinates(project.caserio));
    setLocationError(null);
  };

  const toggleQuickNote = (note: string) => {
    const notes = observations
      .split(' · ')
      .map((item) => item.trim())
      .filter(Boolean);

    setObservations(
      notes.includes(note)
        ? notes.filter((item) => item !== note).join(' · ')
        : [...notes, note].join(' · '),
    );
  };

  const handleSave = async () => {
    setFormError(null);
    if (!/^\d{8}$/.test(dni)) {
      setFormError('El DNI debe contener exactamente 8 dígitos.');
      return;
    }
    if (beneficiaryName.trim().length < 3) {
      setFormError('Ingresa el nombre completo del beneficiario.');
      return;
    }
    if (!activity) {
      setFormError('Selecciona la actividad realizada.');
      return;
    }

    setIsSaving(true);
    try {
      await insertFichaCampo({
        proyectoId: project.id,
        beneficiarioDni: dni,
        beneficiarioNombre: beneficiaryName,
        actividadRealizada: activity,
        observaciones: observations,
        latitud: coordinates?.latitude ?? null,
        longitud: coordinates?.longitude ?? null,
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSaved();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>REGISTRO DE VISITA · OFFLINE-FIRST</Text>
                <Text style={styles.title}>Nueva ficha de campo</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar ficha"
                onPress={onClose}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.projectCard}>
              <View style={styles.projectIcon}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.projectCopy}>
                <Text style={styles.projectCode}>{project.codigo} · {project.eje}</Text>
                <Text style={styles.projectName}>{project.nombre}</Text>
                <View style={styles.projectLocation}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.projectCaserio}>{project.caserio}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Datos del beneficiario</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>DNI del beneficiario *</Text>
                <View style={[styles.inputShell, dni.length > 0 && dni.length !== 8 && styles.inputInvalid]}>
                  <MaterialCommunityIcons name="card-account-details-outline" size={19} color={colors.textSecondary} />
                  <TextInput
                    accessibilityLabel="DNI del beneficiario"
                    value={dni}
                    onChangeText={(value) => setDni(value.replace(/\D/g, '').slice(0, 8))}
                    keyboardType="number-pad"
                    maxLength={8}
                    placeholder="8 dígitos"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                  />
                  <Text style={styles.dniCounter}>{dni.length}/8</Text>
                </View>
                {dni.length > 0 && dni.length !== 8 && (
                  <Text style={styles.helperError}>El DNI debe tener 8 dígitos.</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre completo *</Text>
                <View style={styles.inputShell}>
                  <MaterialCommunityIcons name="account-outline" size={20} color={colors.textSecondary} />
                  <TextInput
                    accessibilityLabel="Nombre completo del beneficiario"
                    value={beneficiaryName}
                    onChangeText={setBeneficiaryName}
                    placeholder="Poblador o productor"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actividad realizada *</Text>
              <Text style={styles.sectionHint}>Opciones para el eje de {project.eje}.</Text>
              <View style={styles.activityList}>
                {activities.map((option) => {
                  const selected = activity === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setActivity(option)}
                      style={[styles.activityButton, selected && styles.activityButtonSelected]}
                    >
                      <MaterialCommunityIcons
                        name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                        size={21}
                        color={selected ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.activityText, selected && styles.activityTextSelected]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.notesHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Observaciones de campo</Text>
                  <Text style={styles.sectionHint}>Agrega contexto útil para el seguimiento.</Text>
                </View>
                <MaterialCommunityIcons name="note-text-outline" size={21} color={colors.primary} />
              </View>
              <TextInput
                accessibilityLabel="Observaciones de campo"
                value={observations}
                onChangeText={setObservations}
                placeholder="Describe hallazgos, acuerdos o necesidades..."
                placeholderTextColor={colors.textSecondary}
                style={styles.observationsInput}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.quickNotesLabel}>Notas rápidas</Text>
              <View style={styles.quickNotes}>
                {QUICK_NOTES.map((note) => {
                  const selected = observations.split(' · ').includes(note);
                  return (
                    <Pressable
                      key={note}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleQuickNote(note)}
                      style={[styles.quickNote, selected && styles.quickNoteSelected]}
                    >
                      <Text style={[styles.quickNoteText, selected && styles.quickNoteTextSelected]}>
                        {note}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.locationHeader}>
                <View style={styles.locationTitleGroup}>
                  <MaterialCommunityIcons name="map-marker-radius-outline" size={21} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Ubicación de la visita</Text>
                </View>
                {coordinates && (
                  <View style={[styles.locationBadge, coordinates.source === 'SIMULADA' && styles.simulatedBadge]}>
                    <Text style={[styles.locationBadgeText, coordinates.source === 'SIMULADA' && styles.simulatedBadgeText]}>
                      {coordinates.source}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.locationActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isCapturingLocation}
                  onPress={() => void captureCurrentLocation()}
                  style={[styles.locationButton, styles.locationButtonPrimary]}
                >
                  {isCapturingLocation ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="crosshairs-gps" size={19} color={colors.onPrimary} />
                      <Text style={styles.locationButtonPrimaryText}>Capturar GPS actual</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={simulateCoordinates}
                  style={[styles.locationButton, styles.locationButtonSecondary]}
                >
                  <MaterialCommunityIcons name="map-marker-question-outline" size={19} color={colors.primary} />
                  <Text style={styles.locationButtonSecondaryText}>
                    Simular Coordenadas de Caserío Altoandino
                  </Text>
                </Pressable>
              </View>
              {coordinates ? (
                <View style={styles.coordinateReadout}>
                  <MaterialCommunityIcons
                    name={coordinates.source === 'GPS' ? 'crosshairs-gps' : 'map-marker-outline'}
                    size={17}
                    color={coordinates.source === 'GPS' ? colors.online : colors.offline}
                  />
                  <Text style={styles.coordinateText}>
                    {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                  </Text>
                  <Text style={styles.coordinateCaserio}>{project.caserio}</Text>
                </View>
              ) : (
                <Text style={styles.sectionHint}>
                  Coordenadas opcionales. Puedes capturar GPS o usar una ubicación simulada para la demo.
                </Text>
              )}
              {locationError && (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={17} color={colors.error} />
                  <Text style={styles.errorText}>{locationError}</Text>
                </View>
              )}
            </View>

            {formError && (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            )}

            <View style={styles.offlineNote}>
              <MaterialCommunityIcons name="database-check-outline" size={19} color={colors.primary} />
              <Text style={styles.offlineText}>
                La ficha se guarda primero en el dispositivo y se sincroniza cuando haya conexión.
              </Text>
            </View>

            <View style={styles.footerActions}>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void handleSave()}
                style={[styles.saveButton, isSaving && styles.disabledButton]}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save-check-outline" size={20} color={colors.onPrimary} />
                    <Text style={styles.saveText}>Guardar ficha</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.surface,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  projectIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#DDEBE3',
  },
  projectCopy: { flex: 1, gap: 3 },
  projectCode: {
    color: '#D3E5D9',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  projectName: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  projectLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  projectCaserio: {
    color: '#E1ECE5',
    fontSize: 10,
  },
  section: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHint: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  inputGroup: { gap: 6 },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  inputShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  inputInvalid: { borderColor: colors.error },
  input: {
    flex: 1,
    minHeight: 46,
    color: colors.text,
    fontSize: 13,
  },
  dniCounter: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  helperError: {
    color: colors.error,
    fontSize: 10,
  },
  activityList: { gap: 7 },
  activityButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  activityButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  activityText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  activityTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  observationsInput: {
    minHeight: 100,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: colors.surface,
  },
  quickNotesLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  quickNotes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  quickNote: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickNoteSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  quickNoteText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  quickNoteTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  locationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.accentLight,
  },
  locationBadgeText: {
    color: colors.online,
    fontSize: 9,
    fontWeight: '800',
  },
  simulatedBadge: { backgroundColor: colors.warningBackground },
  simulatedBadgeText: { color: colors.offline },
  locationActions: { gap: 7 },
  locationButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 11,
  },
  locationButtonPrimary: { backgroundColor: colors.primary },
  locationButtonPrimaryText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  locationButtonSecondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#C8DCCF',
  },
  locationButtonSecondaryText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  coordinateReadout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  coordinateText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  coordinateCaserio: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'right',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.dangerBackground,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 11,
    lineHeight: 16,
  },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
  },
  offlineText: {
    flex: 1,
    color: colors.primary,
    fontSize: 10,
    lineHeight: 15,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 9,
  },
  cancelButton: {
    minHeight: 50,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  saveText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: { opacity: 0.65 },
});
