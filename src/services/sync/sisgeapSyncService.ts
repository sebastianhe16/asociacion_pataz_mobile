import {
  completeSyncPackage,
  getPendingRecordCount,
  getPendingSyncPackages,
  type PendingSyncPackage,
} from '../../database/db';

const BATCH_SIZE = 20;
const SIMULATED_GATEWAY_DELAY_MS = 80;

export interface SyncResult {
  syncedCount: number;
  remainingCount: number;
}

async function simulateGatewaySend(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, SIMULATED_GATEWAY_DELAY_MS);
  });
}

export async function syncPendingRecords(isOnline: boolean): Promise<SyncResult> {
  if (!isOnline) {
    throw new Error('La sincronización requiere conexión a internet.');
  }

  let syncedCount = 0;

  while (true) {
    const batch: PendingSyncPackage[] = await getPendingSyncPackages(BATCH_SIZE);
    if (batch.length === 0) {
      break;
    }

    for (const item of batch) {
      await simulateGatewaySend();
      await completeSyncPackage(item);
      syncedCount += 1;
    }
  }

  return { syncedCount, remainingCount: await getPendingRecordCount() };
}
