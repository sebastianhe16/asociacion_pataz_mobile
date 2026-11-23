import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing } from '../core/theme';
import { useAuth } from '../services/auth/AuthProvider';

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const [animationComplete, setAnimationComplete] = useState(false);
  const [animation] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const hasNavigated = useRef(false);

  useEffect(() => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 850,
      useNativeDriver: true,
    }).start();
    Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();
    const timer = setTimeout(() => setAnimationComplete(true), 2100);

    return () => {
      animation.stopAnimation();
      progress.stopAnimation();
      clearTimeout(timer);
    };
  }, [animation, progress]);

  useEffect(() => {
    if (isLoading || !animationComplete || hasNavigated.current) {
      return;
    }
    hasNavigated.current = true;
    router.replace(user ? '/(tabs)' : '/login');
  }, [animationComplete, isLoading, user]);

  const logoStyle = {
    opacity: animation,
    transform: [
      {
        scale: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.78, 1],
        }),
      },
    ],
  };
  const progressStyle = {
    width: progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }),
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Animated.View style={[styles.logoFrame, logoStyle]}>
          <Image
            source={require('../../assets/pataz-logo.png')}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="Isotipo de Asociación Pataz"
          />
        </Animated.View>
        <Text style={styles.title}>Asociación Pataz</Text>
        <Text style={styles.subtitle}>Gestión Logística y Campo</Text>
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingBar, progressStyle]} />
        </View>
        <Text style={styles.loadingLabel}>Preparando tu espacio de trabajo</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoFrame: {
    width: 138,
    height: 138,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderRadius: 34,
    backgroundColor: colors.surface,
    elevation: 5,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  logo: {
    width: 112,
    height: 112,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: 13,
  },
  loadingTrack: {
    width: 150,
    height: 4,
    overflow: 'hidden',
    marginTop: spacing.xl,
    borderRadius: 2,
    backgroundColor: colors.primaryLight,
  },
  loadingBar: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  loadingLabel: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 11,
  },
});
