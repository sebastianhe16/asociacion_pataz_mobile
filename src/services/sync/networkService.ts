import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface NetworkSnapshot {
  isOnline: boolean;
  isConnected: boolean | null;
}

const listeners = new Set<(snapshot: NetworkSnapshot) => void>();
let netInfoState: NetInfoState | null = null;
let snapshot: NetworkSnapshot = {
  isOnline: false,
  isConnected: null,
};
let unsubscribeNetInfo: (() => void) | null = null;
let initialization: Promise<void> | null = null;

function publish(): void {
  const isConnected = netInfoState?.isConnected ?? null;
  const isOnline = isConnected === true && netInfoState?.isInternetReachable !== false;

  snapshot = { isOnline, isConnected };
  listeners.forEach((listener) => listener(snapshot));
}

export function getNetworkSnapshot(): NetworkSnapshot {
  return snapshot;
}

export function subscribeNetworkStatus(
  listener: (value: NetworkSnapshot) => void,
): () => void {
  listeners.add(listener);
  listener(snapshot);

  return () => {
    listeners.delete(listener);
  };
}

export function initializeNetworkService(): Promise<void> {
  if (initialization) {
    return initialization;
  }

  initialization = (async () => {
    netInfoState = await NetInfo.fetch();
    publish();

    if (!unsubscribeNetInfo) {
      unsubscribeNetInfo = NetInfo.addEventListener((nextState) => {
        netInfoState = nextState;
        publish();
      });
    }
  })().catch((error: unknown) => {
    initialization = null;
    throw error;
  });

  return initialization;
}
