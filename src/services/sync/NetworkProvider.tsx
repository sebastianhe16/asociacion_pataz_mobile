import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  getNetworkSnapshot,
  initializeNetworkService,
  subscribeNetworkStatus,
  type NetworkSnapshot,
} from './networkService';

interface NetworkContextValue extends NetworkSnapshot {
  serviceError: string | null;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: PropsWithChildren) {
  const [network, setNetwork] = useState(getNetworkSnapshot);
  const [serviceError, setServiceError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus(setNetwork);

    initializeNetworkService().catch((error: unknown) => {
      setServiceError(
        error instanceof Error ? error.message : 'No se pudo leer el estado de red.',
      );
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({ ...network, serviceError }),
    [network, serviceError],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetworkStatus debe usarse dentro de NetworkProvider.');
  }
  return context;
}
