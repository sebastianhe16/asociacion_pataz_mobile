import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { Almacen, Insumo, OrigenMovimiento, TipoMovimiento } from '../core/types';
import { DATABASE_SCHEMA } from './schema';

const DATABASE_NAME = 'asociacion_pataz.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export interface InventoryItem extends Insumo {
  almacenNombre: string;
}

export interface RegisterWarehouseMovementInput {
  tipo: TipoMovimiento;
  origen: OrigenMovimiento | null;
  insumoId: string;
  cantidad: number;
  responsable: string;
  destinoCaserio: string;
}

const almacenes = [
  { id: 'alm-lavasen', nombre: 'Lavasen', ubicacion: 'Base logística Lavasen, Pataz' },
  { id: 'alm-maranon', nombre: 'Marañón', ubicacion: 'Base logística Marañón, La Libertad' },
  { id: 'alm-pataz', nombre: 'Pataz', ubicacion: 'Base logística Pataz, La Libertad' },
] as const;

const insumos = [
  { id: 'ins-papa-lavasen', codigo: 'AG-PAPA-325', nombre: 'Semillas de papa INIA-325', categoria: 'Agrícola', unidad: 'kg', stock: 240, minimo: 50, almacen: 'alm-lavasen' },
  { id: 'ins-palta-lavasen', codigo: 'AG-PALTA-HASS', nombre: 'Plantones de palta Hass', categoria: 'Agrícola', unidad: 'plantón', stock: 180, minimo: 40, almacen: 'alm-lavasen' },
  { id: 'ins-sulfato-pataz', codigo: 'SA-SULF-FER', nombre: 'Sulfato ferroso (suplemento contra anemia)', categoria: 'Salud', unidad: 'frasco', stock: 96, minimo: 30, almacen: 'alm-pataz' },
  { id: 'ins-kit-pataz', codigo: 'ED-KIT-ESC', nombre: 'Kit escolar básico', categoria: 'Educación', unidad: 'kit', stock: 125, minimo: 35, almacen: 'alm-pataz' },
  { id: 'ins-fertilizante-maranon', codigo: 'AG-FERT-ORG', nombre: 'Fertilizante orgánico', categoria: 'Agrícola', unidad: 'saco', stock: 72, minimo: 20, almacen: 'alm-maranon' },
  { id: 'ins-planton-queuna-maranon', codigo: 'AG-QUE-PLT', nombre: 'Plantones de queuña', categoria: 'Agrícola', unidad: 'plantón', stock: 310, minimo: 80, almacen: 'alm-maranon' },
  { id: 'ins-botiquin-lavasen', codigo: 'SA-BOT-PRI', nombre: 'Botiquín de primeros auxilios', categoria: 'Salud', unidad: 'unidad', stock: 18, minimo: 8, almacen: 'alm-lavasen' },
  { id: 'ins-kit-agua-maranon', codigo: 'ED-KIT-AGU', nombre: 'Kit de herramientas para agua y saneamiento', categoria: 'Educación', unidad: 'kit', stock: 14, minimo: 5, almacen: 'alm-maranon' },
] as const;

const proyectos = [
  { id: 'proy-salud-anemia', codigo: 'P01-SAL-ANEMIA', nombre: 'Prevención de anemia infantil', eje: 'Salud', caserio: 'Chagual' },
  { id: 'proy-salud-familiar', codigo: 'P02-SAL-FAMILIA', nombre: 'Acompañamiento a familias saludables', eje: 'Salud', caserio: 'Nimpana' },
  { id: 'proy-agri-papa', codigo: 'P03-AGR-PAPA', nombre: 'Fortalecimiento de cultivo de papa', eje: 'Agricultura', caserio: 'Lavasen' },
  { id: 'proy-agri-frutales', codigo: 'P04-AGR-FRUTAL', nombre: 'Instalación de frutales altoandinos', eje: 'Agricultura', caserio: 'Marañón' },
  { id: 'proy-educ-escuela', codigo: 'P05-EDU-ESCUELA', nombre: 'Apoyo a la educación rural', eje: 'Educación', caserio: 'Pataz' },
] as const;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  try {
    return await databasePromise;
  } catch (error) {
    databasePromise = null;
    throw error;
  }
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(DATABASE_SCHEMA);
  const movementColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(movimientos_almacen)',
  );
  if (!movementColumns.some(({ name }) => name === 'origen')) {
    await database.execAsync(
      "ALTER TABLE movimientos_almacen ADD COLUMN origen TEXT CHECK (origen IN ('COMPRA', 'DONACION') OR origen IS NULL)",
    );
  }
  await seedInitialData(database);
}

export async function seedInitialData(
  existingDatabase?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = existingDatabase ?? await getDatabase();

  await database.withTransactionAsync(async () => {
    for (const warehouse of almacenes) {
      await database.runAsync(
        'INSERT OR IGNORE INTO almacenes (id, nombre, ubicacion) VALUES (?, ?, ?)',
        warehouse.id,
        warehouse.nombre,
        warehouse.ubicacion,
      );
    }

    for (const item of insumos) {
      await database.runAsync(
        `INSERT OR IGNORE INTO insumos
          (id, codigo, nombre, categoria, unidad, stock_actual, stock_minimo, almacen_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.codigo,
        item.nombre,
        item.categoria,
        item.unidad,
        item.stock,
        item.minimo,
        item.almacen,
      );
    }

    for (const project of proyectos) {
      await database.runAsync(
        'INSERT OR IGNORE INTO proyectos (id, codigo, nombre, eje, caserio) VALUES (?, ?, ?, ?, ?)',
        project.id,
        project.codigo,
        project.nombre,
        project.eje,
        project.caserio,
      );
    }
  });
}

export async function getPendingRecordCount(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT
      (SELECT COUNT(*) FROM movimientos_almacen WHERE sync_status IN ('PENDING', 'ERROR')) +
      (SELECT COUNT(*) FROM fichas_campo WHERE sync_status IN ('PENDING', 'ERROR')) AS count`,
  );

  return result?.count ?? 0;
}

export async function getWarehouses(): Promise<Almacen[]> {
  const database = await getDatabase();
  return database.getAllAsync<Almacen>(
    'SELECT id, nombre, ubicacion FROM almacenes ORDER BY nombre ASC',
  );
}

export async function getInventoryByWarehouse(
  warehouseId: string,
): Promise<InventoryItem[]> {
  const database = await getDatabase();
  return database.getAllAsync<InventoryItem>(
    `SELECT
      i.id,
      i.codigo,
      i.nombre,
      i.categoria,
      i.unidad,
      i.stock_actual AS stockActual,
      i.stock_minimo AS stockMinimo,
      i.almacen_id AS almacenId,
      a.nombre AS almacenNombre
    FROM insumos i
    INNER JOIN almacenes a ON a.id = i.almacen_id
    WHERE i.almacen_id = ?
    ORDER BY i.nombre COLLATE NOCASE ASC`,
    warehouseId,
  );
}

export async function findInventoryItemByCode(code: string): Promise<InventoryItem | null> {
  const database = await getDatabase();
  return database.getFirstAsync<InventoryItem>(
    `SELECT
      i.id,
      i.codigo,
      i.nombre,
      i.categoria,
      i.unidad,
      i.stock_actual AS stockActual,
      i.stock_minimo AS stockMinimo,
      i.almacen_id AS almacenId,
      a.nombre AS almacenNombre
    FROM insumos i
    INNER JOIN almacenes a ON a.id = i.almacen_id
    WHERE i.codigo = ? OR i.id = ?
    LIMIT 1`,
    code.trim(),
    code.trim(),
  );
}

export async function registerWarehouseMovement(
  input: RegisterWarehouseMovementInput,
): Promise<void> {
  const responsable = input.responsable.trim();
  const destinoCaserio = input.destinoCaserio.trim();

  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new Error('La cantidad debe ser un número mayor que cero.');
  }
  if (!responsable) {
    throw new Error('Ingresa el nombre del responsable.');
  }
  if (input.tipo === 'SALIDA' && !destinoCaserio) {
    throw new Error('Indica el caserío o proyecto de destino para registrar una salida.');
  }
  if (input.tipo === 'ENTRADA' && !input.origen) {
    throw new Error('Selecciona si la entrada corresponde a una compra o donación.');
  }

  const database = await getDatabase();
  const itemExists = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM insumos WHERE id = ?',
    input.insumoId,
  );
  if (!itemExists) {
    throw new Error('El insumo seleccionado ya no existe en el inventario local.');
  }

  await database.withTransactionAsync(async () => {
    const stockUpdate = input.tipo === 'ENTRADA'
      ? await database.runAsync(
        'UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?',
        input.cantidad,
        input.insumoId,
      )
      : await database.runAsync(
        `UPDATE insumos
         SET stock_actual = stock_actual - ?
         WHERE id = ? AND stock_actual >= ?`,
        input.cantidad,
        input.insumoId,
        input.cantidad,
      );

    if (stockUpdate.changes !== 1) {
      throw new Error(
        input.tipo === 'SALIDA'
          ? 'Stock insuficiente para completar esta salida.'
          : 'No se pudo actualizar el stock del insumo.',
      );
    }

    await database.runAsync(
      `INSERT INTO movimientos_almacen
        (id, tipo, origen, insumo_id, cantidad, responsable, destino_caserio, timestamp, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      Crypto.randomUUID(),
      input.tipo,
      input.origen,
      input.insumoId,
      input.cantidad,
      responsable,
      destinoCaserio || null,
      new Date().toISOString(),
    );
  });
}
