import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { mockUsers } from '../../data/mockUsers';
import type { UsuarioSesion } from '../../core/types/auth';

const SESSION_STORAGE_KEY = '@pataz/authenticated-user-id';

interface AuthContextValue {
  user: UsuarioSesion | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (correo: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSessionUser(userId: string): UsuarioSesion | null {
  const user = mockUsers.find((candidate) => candidate.id === userId);
  if (!user) {
    return null;
  }

  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UsuarioSesion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(SESSION_STORAGE_KEY)
      .then(async (storedUserId) => {
        if (!active || !storedUserId) {
          return;
        }

        const restoredUser = toSessionUser(storedUserId);
        if (!restoredUser) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          if (active) {
            setAuthError('La sesión guardada ya no es válida. Inicia sesión nuevamente.');
          }
          return;
        }

        setUser(restoredUser);
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthError(
            error instanceof Error
              ? `No se pudo recuperar la sesión local: ${error.message}`
              : 'No se pudo recuperar la sesión local.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (correo: string, password: string) => {
    setAuthError(null);
    const normalizedEmail = correo.trim().toLocaleLowerCase();
    const account = mockUsers.find(
      (candidate) =>
        candidate.correo.toLocaleLowerCase() === normalizedEmail &&
        candidate.password === password,
    );

    if (!account) {
      throw new Error('Correo o contraseña incorrectos. Revisa los datos e inténtalo nuevamente.');
    }

    await AsyncStorage.setItem(SESSION_STORAGE_KEY, account.id);
    const sessionUser = toSessionUser(account.id);
    if (!sessionUser) {
      throw new Error('No se pudo preparar el perfil de usuario.');
    }
    setUser(sessionUser);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
    setAuthError(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, authError, signIn, signOut }),
    [user, isLoading, authError, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
