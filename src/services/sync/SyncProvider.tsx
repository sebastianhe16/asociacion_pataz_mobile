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
import { getSyncDashboardData } from '../../database/db';
import type { SyncQueueEntry } from '../../core/types';
import { useNetworkStatus } from './NetworkProvider';
import { syncPendingRecords, type SyncResult } from './sisgeapSyncService';

const EMPTY_QUEUE: SyncQueueEntry[] = [];

interface SyncContextValue {
  pendingCount: number;
  pendingMovementCount: number;
  pendingFieldCount: number;
  pendingOrderCount: number;
  pendingApprovalOrderCount: number;
  queue: SyncQueueEntry[];
  isQueueLoading: boolean;
  isSyncing: boolean;
  lastResult: SyncResult | null;
  errorMessage: string | null;
  refreshPendingCount: () => Promise<void>;
  synchronize: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const { isOnline } = useNetworkStatus();
  const [dashboard, setDashboard] = useState<{
    pendingMovementCount: number;
    pendingFieldCount: number;
    pendingOrderCount: number;
    pendingApprovalOrderCount: number;
    queue: SyncQueueEntry[];
  } | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingMovementCount = dashboard?.pendingMovementCount ?? 0;
  const pendingFieldCount = dashboard?.pendingFieldCount ?? 0;
  const pendingOrderCount = dashboard?.pendingOrderCount ?? 0;
  const pendingApprovalOrderCount = dashboard?.pendingApprovalOrderCount ?? 0;
  const pendingCount = pendingMovementCount + pendingFieldCount + pendingOrderCount;
  const queue = dashboard?.queue ?? EMPTY_QUEUE;

  const refreshPendingCount = useCallback(async () => {
    setIsQueueLoading(true);
    try {
      setDashboard(await getSyncDashboardData());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo consultar la cola local.',
      );
    } finally {
      setIsQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getSyncDashboardData()
      .then((data) => {
        if (active) {
          setDashboard(data);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : 'No se pudo consultar la cola local.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsQueueLoading(false);
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
      await refreshPendingCount();
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
      pendingMovementCount,
      pendingFieldCount,
      pendingOrderCount,
      pendingApprovalOrderCount,
      queue,
      isQueueLoading,
      isSyncing,
      lastResult,
      errorMessage,
      refreshPendingCount,
      synchronize,
    }),
    [
      pendingCount,
      pendingMovementCount,
      pendingFieldCount,
      pendingOrderCount,
      pendingApprovalOrderCount,
      queue,
      isQueueLoading,
      isSyncing,
      lastResult,
      errorMessage,
      refreshPendingCount,
      synchronize,
    ],
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
