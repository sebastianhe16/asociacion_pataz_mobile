import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../core/theme';
import { useAuth } from '../services/auth/AuthProvider';
import { useNetworkStatus } from '../services/sync/NetworkProvider';
import type { RootStackParamList } from '../navigation/types';

export default function PerfilScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert(
        'No se pudo cerrar la sesión',
        error instanceof Error ? error.message : 'No se pudo limpiar la sesión local.',
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const sessionState = isOnline ? 'Sesión local disponible · En línea' : 'Sesión local · Sin conexión';

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primary} />
          </Pressable>
          <Text style={styles.topBarTitle}>Mi perfil</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{user.iniciales}</Text>
            <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
          </View>
          <Text style={styles.name}>{user.nombreCompleto}</Text>
          <Text style={styles.role}>{user.rol}</Text>
          <View style={styles.siteBadge}>
            <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.primary} />
            <Text style={styles.siteBadgeText}>{user.sedeAsignada}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Información de usuario</Text>
          <ProfileDetail
            icon="account-badge-outline"
            label="Código de empleado"
            value={user.codigoEmpleado}
          />
          <ProfileDetail icon="email-outline" label="Correo" value={user.correo} />
          <ProfileDetail icon="briefcase-outline" label="Rol" value={user.rol} />
          <ProfileDetail icon="map-marker-outline" label="Sede asignada" value={user.sedeAsignada} />
        </View>

        <View style={styles.sessionCard}>
          <View style={[styles.sessionIcon, isOnline ? styles.onlineIcon : styles.offlineIcon]}>
            <MaterialCommunityIcons
              name={isOnline ? 'cloud-check-outline' : 'cloud-off-outline'}
              size={21}
              color={isOnline ? colors.online : colors.offline}
            />
          </View>
          <View style={styles.sessionCopy}>
            <Text style={styles.sessionTitle}>Estado de sesión</Text>
            <Text style={styles.sessionDescription}>{sessionState}</Text>
            <Text style={styles.sessionNote}>La sesión se conserva en este dispositivo.</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutPressed,
            isSigningOut && styles.signOutDisabled,
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <>
              <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
              <Text style={styles.signOutLabel}>Cerrar sesión</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ProfileDetailProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}

function ProfileDetail({ icon, label, value }: ProfileDetailProps) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  topBarTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  identityCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  avatar: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderRadius: 41,
    backgroundColor: colors.primaryLight,
  },
  avatarInitials: {
    color: colors.primary,
    fontSize: 25,
    fontWeight: '800',
  },
  statusDot: {
    position: 'absolute',
    right: 3,
    bottom: 4,
    width: 15,
    height: 15,
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: 8,
  },
  onlineDot: {
    backgroundColor: colors.online,
  },
  offlineDot: {
    backgroundColor: colors.offline,
  },
  name: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  role: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  siteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  siteBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  detailsCard: {
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  detailRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
  },
  detailCopy: {
    flex: 1,
    gap: 3,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  onlineIcon: {
    backgroundColor: colors.accentLight,
  },
  offlineIcon: {
    backgroundColor: colors.warningBackground,
  },
  sessionCopy: {
    flex: 1,
    gap: 3,
  },
  sessionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  sessionDescription: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  sessionNote: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  signOutButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1CECA',
    backgroundColor: colors.surface,
  },
  signOutLabel: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
  },
  signOutPressed: {
    opacity: 0.75,
  },
  signOutDisabled: {
    opacity: 0.65,
  },
});
