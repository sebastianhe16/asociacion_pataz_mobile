import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../core/theme';
import { mockUsers } from '../data/mockUsers';
import { useAuth } from '../services/auth/AuthProvider';

export default function LoginScreen() {
  const { user, isLoading, authError, signIn } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(authError);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)');
    }
  }, [isLoading, user]);

  const selectAccount = (account: (typeof mockUsers)[number]) => {
    setCorreo(account.correo);
    setPassword(account.password);
    setFormError(null);
  };

  const handleSignIn = async () => {
    if (!correo.trim() || !password) {
      setFormError('Ingresa tu correo y contraseña para continuar.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await signIn(correo, password);
      router.replace('/(tabs)');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoFrame}>
              <Image
                source={require('../../assets/pataz-logo.png')}
                resizeMode="contain"
                style={styles.logo}
                accessibilityLabel="Isotipo de Asociación Pataz"
              />
            </View>
            <Text style={styles.brandName}>Asociación Pataz</Text>
            <Text style={styles.brandSubtitle}>Gestión Logística y Campo</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.description}>
              Accede a tu espacio de trabajo en territorio.
            </Text>

            <Text style={styles.inputLabel}>Correo institucional</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                accessibilityLabel="Correo institucional"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setCorreo}
                placeholder="nombre@asociacionpataz.org"
                placeholderTextColor="#8A9690"
                style={styles.input}
                value={correo}
              />
            </View>

            <Text style={styles.inputLabel}>Contraseña</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                accessibilityLabel="Contraseña"
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={setPassword}
                onSubmitEditing={() => void handleSignIn()}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#8A9690"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                hitSlop={8}
                onPress={() => setShowPassword((visible) => !visible)}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {formError && (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.error}
                />
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || isLoading}
              onPress={() => void handleSignIn()}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
                (isSubmitting || isLoading) && styles.buttonDisabled,
              ]}
            >
              {isSubmitting || isLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.submitLabel}>Iniciar sesión</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={colors.onPrimary}
                  />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.accessSection}>
            <View style={styles.accessHeading}>
              <View style={styles.accessHeadingText}>
                <Text style={styles.accessTitle}>Acceso rápido</Text>
                <Text style={styles.accessDescription}>
                  Selecciona un perfil para completar los datos de acceso.
                </Text>
              </View>
              <MaterialCommunityIcons
                name="account-multiple-outline"
                size={22}
                color={colors.primary}
              />
            </View>
            {mockUsers.map((account) => (
              <Pressable
                accessibilityRole="button"
                key={account.id}
                onPress={() => selectAccount(account)}
                style={({ pressed }) => [styles.accountCard, pressed && styles.buttonPressed]}
              >
                <View style={styles.accountAvatar}>
                  <Text style={styles.accountInitials}>{account.iniciales}</Text>
                </View>
                <View style={styles.accountCopy}>
                  <Text style={styles.accountName}>{account.nombreCompleto}</Text>
                  <Text style={styles.accountRole}>{account.rol}</Text>
                  <Text style={styles.accountSite}>{account.sedeAsignada}</Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={21}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))}
            <Text style={styles.accessNote}>
              Perfiles disponibles en este dispositivo.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoFrame: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderRadius: 22,
    backgroundColor: colors.surface,
    elevation: 3,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  logo: {
    width: 62,
    height: 62,
  },
  brandName: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  formCard: {
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  description: {
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  inputLabel: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FCFDFC',
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.dangerBackground,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
  },
  submitLabel: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  accessSection: {
    gap: spacing.sm,
  },
  accessHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  accessHeadingText: {
    flex: 1,
    gap: 3,
  },
  accessTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  accessDescription: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  accountCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
  },
  accountInitials: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  accountRole: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  accountSite: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  accessNote: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
