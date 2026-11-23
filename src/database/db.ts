import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type {
  Almacen,
  Insumo,
  NuevaFichaCampo,
  OrigenMovimiento,
  ProyectoCampoResumen,
  SyncDashboardData,
  SyncEntityType,
  SyncLog,
  SyncQueueEntry,
  SyncStatus,
  TipoMovimiento,
} from '../core/types';
import { DATABASE_SCHEMA } from './schema';

const DATABASE_NAME = 'asociacion_pataz.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export interface InventoryItem extends Insumo {
  almacenNombre: string;
}

export interface WarehouseStatusSummary extends Almacen {
  itemCount: number;
  lowStockCount: number;
}

export interface RecentActivity {
  id: string;
  entityType: SyncEntityType;
  title: string;
  detail: string;
  timestamp: string;
  syncStatus: SyncStatus;
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
  { id: 'proy-salud-nutricion', codigo: 'P06-SAL-NUTRI', nombre: 'Nutrición y desarrollo infantil temprano', eje: 'Salud', caserio: 'Suyubamba' },
  { id: 'proy-salud-materna', codigo: 'P07-SAL-MATERNA', nombre: 'Salud materna y acompañamiento prenatal', eje: 'Salud', caserio: 'Vijus' },
  { id: 'proy-salud-promotores', codigo: 'P08-SAL-PROMO', nombre: 'Formación de promotores comunitarios de salud', eje: 'Salud', caserio: 'Shicun' },
  { id: 'proy-salud-bucal', codigo: 'P09-SAL-BUCAL', nombre: 'Jornadas de salud bucal comunitaria', eje: 'Salud', caserio: 'Chuquitambo' },
  { id: 'proy-salud-adolescencia', codigo: 'P10-SAL-ADOLESCENCIA', nombre: 'Bienestar y salud para adolescentes', eje: 'Salud', caserio: 'Campamento' },
  { id: 'proy-agri-semillas', codigo: 'P11-AGR-SEMILLAS', nombre: 'Producción local de semillas certificadas', eje: 'Agricultura', caserio: 'Cachica' },
  { id: 'proy-agri-huertos', codigo: 'P12-AGR-HUERTOS', nombre: 'Huertos familiares y seguridad alimentaria', eje: 'Agricultura', caserio: 'Pías' },
  { id: 'proy-agri-ganaderia', codigo: 'P13-AGR-GANADERIA', nombre: 'Mejoramiento de crianza de ganado menor', eje: 'Agricultura', caserio: 'Alacoto' },
  { id: 'proy-agri-suelos', codigo: 'P14-AGR-SUELOS', nombre: 'Conservación de suelos y abonos orgánicos', eje: 'Agricultura', caserio: 'Vista Florida' },
  { id: 'proy-agri-riego', codigo: 'P15-AGR-RIEGO', nombre: 'Riego tecnificado para agricultura familiar', eje: 'Agricultura', caserio: 'Huariracra' },
  { id: 'proy-agri-forestal', codigo: 'P16-AGR-FORESTAL', nombre: 'Reforestación con especies nativas altoandinas', eje: 'Agricultura', caserio: 'Los Alisos' },
  { id: 'proy-educ-lectura', codigo: 'P17-EDU-LECTURA', nombre: 'Lectura y comprensión en escuelas rurales', eje: 'Educación', caserio: 'Monchacap' },
  { id: 'proy-educ-becas', codigo: 'P18-EDU-BECAS', nombre: 'Acompañamiento educativo y continuidad escolar', eje: 'Educación', caserio: 'Bella Aurora' },
  { id: 'proy-educ-materiales', codigo: 'P19-EDU-MATERIALES', nombre: 'Acceso a materiales para aprendizaje', eje: 'Educación', caserio: 'Shorey Chico' },
  { id: 'proy-educ-docentes', codigo: 'P20-EDU-DOCENTES', nombre: 'Fortalecimiento de capacidades docentes', eje: 'Educación', caserio: 'Nuevo Progreso' },
  { id: 'proy-educ-digital', codigo: 'P21-EDU-DIGITAL', nombre: 'Recursos digitales para educación rural', eje: 'Educación', caserio: 'Tayabamba' },
  { id: 'proy-agua-potable', codigo: 'P22-AGUA-POTABLE', nombre: 'Mejoramiento del acceso a agua segura', eje: 'Agua y saneamiento', caserio: 'La Soledad' },
  { id: 'proy-agua-jass', codigo: 'P23-AGUA-JASS', nombre: 'Fortalecimiento de juntas administradoras de agua', eje: 'Agua y saneamiento', caserio: 'Cerro Grande' },
  { id: 'proy-agua-saneamiento', codigo: 'P24-AGUA-SANEAMIENTO', nombre: 'Educación sanitaria y saneamiento familiar', eje: 'Agua y saneamiento', caserio: 'Huaylillas' },
  { id: 'proy-agua-cloracion', codigo: 'P25-AGUA-CLORACION', nombre: 'Vigilancia de calidad y cloración de agua', eje: 'Agua y saneamiento', caserio: 'Shiracmaca' },
  { id: 'proy-agua-mantenimiento', codigo: 'P26-AGUA-MANTENIMIENTO', nombre: 'Mantenimiento de sistemas de agua rural', eje: 'Agua y saneamiento', caserio: 'San Fernando' },
  { id: 'proy-agua-higiene', codigo: 'P27-AGUA-HIGIENE', nombre: 'Prácticas saludables de higiene y manejo de residuos', eje: 'Agua y saneamiento', caserio: 'Caserío El Pozo' },
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
  await migrateProjectAxisConstraint(database);
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

async function migrateProjectAxisConstraint(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const projectTable = await database.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'proyectos'",
  );
  if (!projectTable?.sql || projectTable.sql.includes('Agua y saneamiento')) {
    return;
  }

  await database.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await database.withTransactionAsync(async () => {
      await database.execAsync(`
        CREATE TABLE proyectos_v2 (
          id TEXT PRIMARY KEY NOT NULL,
          codigo TEXT NOT NULL UNIQUE,
          nombre TEXT NOT NULL,
          eje TEXT NOT NULL CHECK (
            eje IN ('Salud', 'Agricultura', 'Educación', 'Agua y saneamiento')
          ),
          caserio TEXT NOT NULL
        );
        INSERT INTO proyectos_v2 (id, codigo, nombre, eje, caserio)
          SELECT id, codigo, nombre, eje, caserio FROM proyectos;
        DROP TABLE proyectos;
        ALTER TABLE proyectos_v2 RENAME TO proyectos;
      `);
    });
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON');
  }
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

export async function getSyncDashboardData(): Promise<SyncDashboardData> {
  const database = await getDatabase();
  const [movementCounts, fieldCounts, movementRows, fieldRows] = await Promise.all([
    database.getFirstAsync<{
      pendingMovementCount: number;
    }>(
      `SELECT
        COUNT(CASE WHEN sync_status IN ('PENDING', 'ERROR') THEN 1 END)
          AS pendingMovementCount
       FROM movimientos_almacen`,
    ),
    database.getFirstAsync<{ pendingFieldCount: number }>(
      `SELECT COUNT(CASE WHEN sync_status IN ('PENDING', 'ERROR') THEN 1 END)
         AS pendingFieldCount
       FROM fichas_campo`,
    ),
    database.getAllAsync<SyncQueueEntry>(
      `SELECT
        m.id,
        'MOVIMIENTO_ALMACEN' AS entityType,
        CASE
          WHEN m.tipo = 'ENTRADA' THEN
            'Entrada · ' || CASE m.origen
              WHEN 'DONACION' THEN 'Donación'
              WHEN 'COMPRA' THEN 'Compra'
              ELSE 'Sin origen'
            END
          ELSE 'Salida · ' || COALESCE(m.destino_caserio, 'Sin destino')
        END AS title,
        i.nombre || ' · ' || a.nombre || ' · Responsable: ' || m.responsable AS detail,
        m.timestamp,
        m.sync_status AS syncStatus
      FROM movimientos_almacen m
      INNER JOIN insumos i ON i.id = m.insumo_id
      INNER JOIN almacenes a ON a.id = i.almacen_id
      WHERE m.sync_status IN ('PENDING', 'ERROR')`,
    ),
    database.getAllAsync<SyncQueueEntry>(
      `SELECT
        f.id,
        'FICHA_CAMPO' AS entityType,
        'Ficha de campo · ' || p.codigo AS title,
        p.nombre || ' · ' || f.beneficiario_nombre || ' · ' || p.caserio AS detail,
        f.timestamp,
        f.sync_status AS syncStatus
      FROM fichas_campo f
      INNER JOIN proyectos p ON p.id = f.proyecto_id
      WHERE f.sync_status IN ('PENDING', 'ERROR')`,
    ),
  ]);

  const queue = [...movementRows, ...fieldRows].sort((first, second) =>
    first.timestamp.localeCompare(second.timestamp),
  );

  return {
    pendingMovementCount: movementCounts?.pendingMovementCount ?? 0,
    pendingFieldCount: fieldCounts?.pendingFieldCount ?? 0,
    queue,
  };
}

export async function getProjectSummaries(): Promise<ProyectoCampoResumen[]> {
  const database = await getDatabase();
  return database.getAllAsync<ProyectoCampoResumen>(
    `SELECT
      p.id,
      p.codigo,
      p.nombre,
      p.eje,
      p.caserio,
      COUNT(f.id) AS totalFichas,
      SUM(CASE WHEN f.sync_status = 'PENDING' THEN 1 ELSE 0 END) AS pendientesSync,
      SUM(CASE WHEN f.sync_status = 'ERROR' THEN 1 ELSE 0 END) AS erroresSync,
      SUM(CASE WHEN f.sync_status = 'SYNCED' THEN 1 ELSE 0 END) AS fichasSincronizadas
    FROM proyectos p
    LEFT JOIN fichas_campo f ON f.proyecto_id = p.id
    GROUP BY p.id, p.codigo, p.nombre, p.eje, p.caserio
    ORDER BY p.codigo ASC`,
  );
}

export async function insertFichaCampo(input: NuevaFichaCampo): Promise<void> {
  const dni = input.beneficiarioDni.trim();
  const nombre = input.beneficiarioNombre.trim();
  const actividad = input.actividadRealizada.trim();

  if (!/^\d{8}$/.test(dni)) {
    throw new Error('El DNI debe contener exactamente 8 dígitos.');
  }
  if (nombre.length < 3) {
    throw new Error('Ingresa el nombre completo del beneficiario.');
  }
  if (!actividad) {
    throw new Error('Selecciona la actividad o asistencia realizada.');
  }
  const hasLatitude = input.latitud !== null;
  const hasLongitude = input.longitud !== null;
  if (hasLatitude !== hasLongitude) {
    throw new Error('Las coordenadas deben incluir latitud y longitud.');
  }
  if (
    (input.latitud !== null &&
      (!Number.isFinite(input.latitud) || input.latitud < -90 || input.latitud > 90)) ||
    (input.longitud !== null &&
      (!Number.isFinite(input.longitud) || input.longitud < -180 || input.longitud > 180))
  ) {
    throw new Error('Las coordenadas GPS están fuera de rango.');
  }

  const database = await getDatabase();
  const projectExists = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM proyectos WHERE id = ?',
    input.proyectoId,
  );
  if (!projectExists) {
    throw new Error('El proyecto seleccionado no existe en la base local.');
  }

  await database.runAsync(
    `INSERT INTO fichas_campo
      (id, proyecto_id, beneficiario_dni, beneficiario_nombre, actividad_realizada,
       observaciones, latitud, longitud, timestamp, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    Crypto.randomUUID(),
    input.proyectoId,
    dni,
    nombre,
    actividad,
    input.observaciones.trim(),
    input.latitud,
    input.longitud,
    new Date().toISOString(),
  );
}

export async function getWarehouses(): Promise<Almacen[]> {
  const database = await getDatabase();
  return database.getAllAsync<Almacen>(
    'SELECT id, nombre, ubicacion FROM almacenes ORDER BY nombre ASC',
  );
}

export async function getWarehouseStatusSummaries(): Promise<WarehouseStatusSummary[]> {
  const database = await getDatabase();
  return database.getAllAsync<WarehouseStatusSummary>(
    `SELECT
      a.id,
      a.nombre,
      a.ubicacion,
      COUNT(i.id) AS itemCount,
      SUM(CASE
        WHEN i.id IS NOT NULL AND i.stock_actual <= i.stock_minimo THEN 1
        ELSE 0
      END) AS lowStockCount
    FROM almacenes a
    LEFT JOIN insumos i ON i.almacen_id = a.id
    GROUP BY a.id, a.nombre, a.ubicacion
    ORDER BY a.nombre COLLATE NOCASE ASC`,
  );
}

export async function getRecentActivities(limit = 6): Promise<RecentActivity[]> {
  const database = await getDatabase();
  return database.getAllAsync<RecentActivity>(
    `SELECT *
     FROM (
       SELECT
         m.id,
         'MOVIMIENTO_ALMACEN' AS entityType,
         CASE
           WHEN m.tipo = 'ENTRADA' THEN 'Entrada registrada'
           ELSE 'Salida registrada'
         END AS title,
         i.nombre || ' · ' || a.nombre AS detail,
         m.timestamp,
         m.sync_status AS syncStatus
       FROM movimientos_almacen m
       INNER JOIN insumos i ON i.id = m.insumo_id
       INNER JOIN almacenes a ON a.id = i.almacen_id
       UNION ALL
       SELECT
         f.id,
         'FICHA_CAMPO' AS entityType,
         'Ficha de campo registrada' AS title,
         f.beneficiario_nombre || ' · ' || p.nombre AS detail,
         f.timestamp,
         f.sync_status AS syncStatus
       FROM fichas_campo f
       INNER JOIN proyectos p ON p.id = f.proyecto_id
     )
     ORDER BY timestamp DESC
     LIMIT ?`,
    limit,
  );
}

export async function getRecentSyncLogs(limit = 8): Promise<SyncLog[]> {
  const database = await getDatabase();
  return database.getAllAsync<SyncLog>(
    `SELECT
      id,
      entity_type AS entityType,
      entity_id AS entityId,
      sync_status AS syncStatus,
      message,
      timestamp,
      endpoint
    FROM sync_logs
    ORDER BY timestamp DESC
    LIMIT ?`,
    limit,
  );
}

async function getInventoryItems(warehouseId?: string): Promise<InventoryItem[]> {
  const database = await getDatabase();
  const query = `SELECT
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
    ${warehouseId ? 'WHERE i.almacen_id = ?' : ''}
    ORDER BY i.nombre COLLATE NOCASE ASC`;

  return warehouseId
    ? database.getAllAsync<InventoryItem>(query, warehouseId)
    : database.getAllAsync<InventoryItem>(query);
}

export async function getInventoryByWarehouse(
  warehouseId: string,
): Promise<InventoryItem[]> {
  return getInventoryItems(warehouseId);
}

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  return getInventoryItems();
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
