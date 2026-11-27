import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

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
let unsubscribeBrowserEvents: (() => void) | null = null;
let initialization: Promise<void> | null = null;

function publishNative(): void {
  const isConnected = netInfoState?.isConnected ?? null;
  const isOnline = isConnected === true && netInfoState?.isInternetReachable !== false;

  snapshot = { isOnline, isConnected };
  listeners.forEach((listener) => listener(snapshot));
}

function publishBrowser(): void {
  const isConnected = typeof navigator === 'undefined' ? null : navigator.onLine;
  snapshot = { isOnline: isConnected === true, isConnected };
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
    if (Platform.OS === 'web') {
      publishBrowser();
      if (typeof window !== 'undefined' && !unsubscribeBrowserEvents) {
        const handleBrowserNetworkChange = () => publishBrowser();
        window.addEventListener('online', handleBrowserNetworkChange);
        window.addEventListener('offline', handleBrowserNetworkChange);
        unsubscribeBrowserEvents = () => {
          window.removeEventListener('online', handleBrowserNetworkChange);
          window.removeEventListener('offline', handleBrowserNetworkChange);
        };
      }
      return;
    }

    netInfoState = await NetInfo.fetch();
    publishNative();

    if (!unsubscribeNetInfo) {
      unsubscribeNetInfo = NetInfo.addEventListener((nextState) => {
        netInfoState = nextState;
        publishNative();
      });
    }
  })().catch((error: unknown) => {
    initialization = null;
    throw error;
  });

  return initialization;
}
