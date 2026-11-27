import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../core/theme';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  compact?: boolean;
}

export function StepIndicator({ steps, currentStep, compact = false }: StepIndicatorProps) {
  return (
    <View style={[styles.steps, compact && styles.stepsCompact]}>
      {steps.map((label, index) => {
        const complete = index < currentStep;
        const active = index === currentStep;
        return (
          <View key={`${index}-${label}`} style={styles.stepGroup}>
            <View style={styles.step}>
              <View
                style={[
                  styles.circle,
                  complete && styles.circleComplete,
                  active && styles.circleActive,
                  compact && styles.circleCompact,
                ]}
              >
                {complete ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={compact ? 12 : 14}
                    color={colors.onPrimary}
                  />
                ) : (
                  <Text
                    style={[
                      styles.number,
                      active && styles.numberActive,
                      compact && styles.numberCompact,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.label,
                  active && styles.labelActive,
                  complete && styles.labelComplete,
                  compact && styles.labelCompact,
                ]}
              >
                {label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  complete && styles.connectorComplete,
                  compact && styles.connectorCompact,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

type BannerTone = 'info' | 'success' | 'warning';

export function InfoBanner({
  message,
  tone = 'info',
  icon,
}: {
  message: string;
  tone?: BannerTone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const toneStyle = tone === 'success'
    ? styles.bannerSuccess
    : tone === 'warning'
      ? styles.bannerWarning
      : styles.bannerInfo;
  const iconColor = tone === 'success'
    ? colors.online
    : tone === 'warning'
      ? colors.offline
      : colors.primary;

  return (
    <View style={[styles.banner, toneStyle]}>
      <MaterialCommunityIcons
        name={icon ?? (tone === 'success' ? 'check-circle-outline' : 'information-outline')}
        size={17}
        color={iconColor}
      />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export function ConnectionBanner({ isOnline }: { isOnline: boolean }) {
  return (
    <InfoBanner
      icon={isOnline ? 'cloud-check-outline' : 'cloud-off-outline'}
      message={isOnline
        ? 'Conexión activa · Se guardará y sincronizará automáticamente con SISGEAP'
        : 'Sin conexión a internet · Se guardará en el dispositivo y se sincronizará al recuperar señal'}
      tone={isOnline ? 'success' : 'warning'}
    />
  );
}

const styles = StyleSheet.create({
  steps: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  stepsCompact: { paddingVertical: 2 },
  stepGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    width: 58,
    alignItems: 'center',
    gap: 5,
  },
  circle: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#E8ECE9',
  },
  circleCompact: { width: 24, height: 24, borderRadius: 12 },
  circleActive: { backgroundColor: colors.primary },
  circleComplete: { backgroundColor: colors.online },
  number: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  numberCompact: { fontSize: 9 },
  numberActive: { color: colors.onPrimary },
  label: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelCompact: { fontSize: 8 },
  labelActive: { color: colors.primary, fontWeight: '800' },
  labelComplete: { color: colors.online },
  connector: {
    height: 2,
    flex: 1,
    marginTop: 13,
    backgroundColor: '#E1E6E2',
  },
  connectorCompact: { marginTop: 11 },
  connectorComplete: { backgroundColor: colors.online },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 11,
  },
  bannerInfo: { backgroundColor: colors.primaryLight },
  bannerSuccess: { backgroundColor: colors.accentLight },
  bannerWarning: { backgroundColor: colors.warningBackground },
  bannerText: { flex: 1, color: colors.text, fontSize: 10, lineHeight: 15 },
});
