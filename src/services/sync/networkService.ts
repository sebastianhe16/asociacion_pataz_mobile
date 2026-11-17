import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type NetworkSimulationMode = 'ONLINE' | 'OFFLINE' | null;

export interface NetworkSnapshot {
  isOnline: boolean;
  isConnected: boolean | null;
  simulationMode: NetworkSimulationMode;
}

const SIMULATION_STORAGE_KEY = '@pataz/network-simulation-mode';
const listeners = new Set<(snapshot: NetworkSnapshot) => void>();
let netInfoState: NetInfoState | null = null;
let simulationMode: NetworkSimulationMode = null;
let snapshot: NetworkSnapshot = {
  isOnline: false,
  isConnected: null,
  simulationMode: null,
};
let unsubscribeNetInfo: (() => void) | null = null;
let initialization: Promise<void> | null = null;

function publish(): void {
  const isConnected = netInfoState?.isConnected ?? null;
  const isOnline = simulationMode
    ? simulationMode === 'ONLINE'
    : isConnected === true && netInfoState?.isInternetReachable !== false;

  snapshot = { isOnline, isConnected, simulationMode };
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
    const storedMode = await AsyncStorage.getItem(SIMULATION_STORAGE_KEY);
    if (storedMode === 'ONLINE' || storedMode === 'OFFLINE') {
      simulationMode = storedMode;
    }

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

export async function setNetworkSimulationMode(
  mode: NetworkSimulationMode,
): Promise<void> {
  if (mode === null) {
    await AsyncStorage.removeItem(SIMULATION_STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(SIMULATION_STORAGE_KEY, mode);
  }

  simulationMode = mode;
  publish();
}
