import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../core/theme';
import { useAuth } from '../services/auth/AuthProvider';

export function Header() {
  const { user } = useAuth();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.identity}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="leaf" size={23} color={colors.onPrimary} />
          </View>
          <View style={styles.titleGroup}>
            <Text style={styles.title}>Asociación Pataz</Text>
            <Text style={styles.subtitle}>Gestión Logística y Campo</Text>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Abrir perfil de ${user?.nombreCompleto ?? 'usuario'}`}
          activeOpacity={0.75}
          onPress={() => router.push('/profile')}
          style={styles.profile}
        >
          {user ? (
            <Text style={styles.initials}>{user.iniciales}</Text>
          ) : (
            <MaterialCommunityIcons name="account-outline" size={23} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    zIndex: 1,
  },
  content: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.primary,
  },
  titleGroup: {
    gap: 2,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  profile: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F7F9F8',
  },
  initials: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
