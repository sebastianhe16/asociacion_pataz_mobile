import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { getPendingRecordCount } from '../../database/db';
import { useNetworkStatus } from './NetworkProvider';
import { syncPendingRecords, type SyncResult } from './sisgeapSyncService';

interface SyncContextValue {
  pendingCount: number;
  isSyncing: boolean;
  lastResult: SyncResult | null;
  errorMessage: string | null;
  refreshPendingCount: () => Promise<void>;
  synchronize: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount(await getPendingRecordCount());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo consultar la cola local.',
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    getPendingRecordCount()
      .then((count) => {
        if (active) {
          setPendingCount(count);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : 'No se pudo consultar la cola local.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const synchronize = useCallback(async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const result = await syncPendingRecords(isOnline);
      setLastResult(result);
      setPendingCount(result.remainingCount);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo sincronizar con SISGEAP.',
      );
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshPendingCount]);

  const previousOnlineState = useRef(isOnline);
  useEffect(() => {
    const justConnected = isOnline && !previousOnlineState.current;
    previousOnlineState.current = isOnline;
    if (justConnected) {
      void synchronize();
    }
  }, [isOnline, synchronize]);

  const value = useMemo(
    () => ({
      pendingCount,
      isSyncing,
      lastResult,
      errorMessage,
      refreshPendingCount,
      synchronize,
    }),
    [pendingCount, isSyncing, lastResult, errorMessage, refreshPendingCount, synchronize],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncStatus(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncStatus debe usarse dentro de SyncProvider.');
  }
  return context;
}
