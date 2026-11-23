import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncEntityType } from '../../core/types';
import { getDatabase } from '../../database/db';

const BATCH_SIZE = 20;
const SIMULATED_GATEWAY_DELAY_MS = 80;

interface PendingMovement {
  id: string;
  timestamp: string;
}

interface PendingFieldForm {
  id: string;
  timestamp: string;
}

interface PendingPackage {
  id: string;
  timestamp: string;
  table: 'movimientos_almacen' | 'fichas_campo';
  entityType: SyncEntityType;
  endpoint: string;
}

export interface SyncResult {
  syncedCount: number;
  remainingCount: number;
}

async function loadPendingPackages(
  database: SQLiteDatabase,
): Promise<PendingPackage[]> {
  const [movements, fieldForms] = await Promise.all([
    database.getAllAsync<PendingMovement>(
      `SELECT id, timestamp FROM movimientos_almacen
       WHERE sync_status IN ('PENDING', 'ERROR') ORDER BY timestamp ASC LIMIT ?`,
      BATCH_SIZE,
    ),
    database.getAllAsync<PendingFieldForm>(
      `SELECT id, timestamp FROM fichas_campo
       WHERE sync_status IN ('PENDING', 'ERROR') ORDER BY timestamp ASC LIMIT ?`,
      BATCH_SIZE,
    ),
  ]);

  return [
    ...movements.map((item) => ({
      ...item,
      table: 'movimientos_almacen' as const,
      entityType: 'MOVIMIENTO_ALMACEN' as const,
      endpoint: '/api/v1/sisgeap/movimientos',
    })),
    ...fieldForms.map((item) => ({
      ...item,
      table: 'fichas_campo' as const,
      entityType: 'FICHA_CAMPO' as const,
      endpoint: '/api/v1/sisgeap/fichas-campo',
    })),
  ].sort((first, second) => first.timestamp.localeCompare(second.timestamp))
    .slice(0, BATCH_SIZE);
}

async function simulateGatewaySend(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, SIMULATED_GATEWAY_DELAY_MS);
  });
}

async function saveSuccessfulSync(
  database: SQLiteDatabase,
  item: PendingPackage,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE ${item.table} SET sync_status = 'SYNCED' WHERE id = ?`,
      item.id,
    );
    await database.runAsync(
      `INSERT INTO sync_logs
        (id, entity_type, entity_id, sync_status, message, timestamp, endpoint)
       VALUES (?, ?, ?, 'SUCCESS', ?, ?, ?)`,
      Crypto.randomUUID(),
      item.entityType,
      item.id,
      'Paquete aceptado por el gateway simulado SISGEAP.',
      timestamp,
      item.endpoint,
    );
  });
}

export async function syncPendingRecords(isOnline: boolean): Promise<SyncResult> {
  if (!isOnline) {
    throw new Error('La sincronización requiere conexión a internet.');
  }

  const database = await getDatabase();
  let syncedCount = 0;

  while (true) {
    const batch = await loadPendingPackages(database);
    if (batch.length === 0) {
      break;
    }

    for (const item of batch) {
      await simulateGatewaySend();
      await saveSuccessfulSync(database, item);
      syncedCount += 1;
    }
  }

  const remaining = await database.getFirstAsync<{ count: number }>(
    `SELECT
      (SELECT COUNT(*) FROM movimientos_almacen WHERE sync_status IN ('PENDING', 'ERROR')) +
      (SELECT COUNT(*) FROM fichas_campo WHERE sync_status IN ('PENDING', 'ERROR')) AS count`,
  );

  return { syncedCount, remainingCount: remaining?.count ?? 0 };
}
