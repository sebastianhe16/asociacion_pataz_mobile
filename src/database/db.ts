import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type {
  Almacen,
  EstadoOrdenCompra,
  Insumo,
  NuevaOrdenCompraInput,
  OrdenCompra,
  OrdenCompraItem,
  PrioridadOrdenCompra,
  NuevaFichaCampo,
  OrigenMovimiento,
  ProyectoCampoResumen,
  SyncDashboardData,
  SyncEntityType,
  SyncLog,
  SyncQueueEntry,
  SyncStatus,
  TipoMovimiento,
  WarehouseMovementRecord,
} from '../core/types';
import type { RoleKey } from '../core/types/auth';
import { DATABASE_SCHEMA } from './schema';
import { createPassportHash, parseSignaturePaths } from '../services/warehouse/passportIntegrity';

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
  hasActa: number;
}

export interface PassportEvidenceInput {
  receptorNombre: string;
  receptorDni: string;
  receptorCargo: string;
  latitud: number | null;
  longitud: number | null;
  fotoUri: string | null;
  firmaSvgPaths: string | null;
}

interface ValidatedPassportEvidence {
  receptorNombre: string;
  receptorDni: string;
  receptorCargo: string;
  latitud: number | null;
  longitud: number | null;
  fotoUri: string | null;
  firmaSvgPaths: string;
}

export interface RegisterWarehouseMovementInput {
  tipo: TipoMovimiento;
  origen: OrigenMovimiento | null;
  insumoId: string;
  cantidad: number;
  responsable: string;
  destinoCaserio: string;
  evidencia?: PassportEvidenceInput;
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

interface OrdenCompraRow {
  id: string;
  codigoOrden: string;
  proyectoId: string;
  proyectoNombre: string;
  almacenDestinoId: string;
  almacenDestinoNombre: string;
  solicitanteId: string;
  solicitanteNombre: string;
  justificacion: string;
  prioridad: string;
  estado: string;
  itemsJson: string;
  fechaSolicitud: string;
  aprobadoPorNombre: string | null;
  fechaRevision: string | null;
  observacionRevision: string | null;
  fechaAtendida: string | null;
  fechaActualizacion: string;
  syncStatus: string;
}

interface OrdenCompraActor {
  id: string;
  nombreCompleto: string;
  roleKey: RoleKey;
}

const ORDER_PRIORITIES: PrioridadOrdenCompra[] = ['NORMAL', 'ALTA', 'URGENTE'];
const ORDER_STATES: EstadoOrdenCompra[] = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'ATENDIDA'];

function parseOrderItems(itemsJson: string): OrdenCompraItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(itemsJson);
  } catch {
    throw new Error('La orden contiene una lista de insumos inválida.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('La orden debe incluir al menos un insumo.');
  }

  return parsed.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('La orden contiene un insumo inválido.');
    }
    const candidate = item as Record<string, unknown>;
    if (
      !(candidate.insumoId === null || typeof candidate.insumoId === 'string') ||
      typeof candidate.nombre !== 'string' ||
      !candidate.nombre.trim() ||
      typeof candidate.unidad !== 'string' ||
      !candidate.unidad.trim() ||
      typeof candidate.cantidad !== 'number' ||
      !Number.isFinite(candidate.cantidad) ||
      candidate.cantidad <= 0
    ) {
      throw new Error('La orden contiene datos de insumo inválidos.');
    }
    return {
      insumoId: candidate.insumoId,
      nombre: candidate.nombre.trim(),
      cantidad: candidate.cantidad,
      unidad: candidate.unidad.trim(),
    };
  });
}

function mapPurchaseOrder(row: OrdenCompraRow): OrdenCompra {
  if (
    !ORDER_PRIORITIES.includes(row.prioridad as PrioridadOrdenCompra) ||
    !ORDER_STATES.includes(row.estado as EstadoOrdenCompra) ||
    (row.syncStatus !== 'PENDING' && row.syncStatus !== 'SYNCED')
  ) {
    throw new Error(`La orden ${row.codigoOrden} contiene un estado o prioridad inválidos.`);
  }
  return {
    id: row.id,
    codigoOrden: row.codigoOrden,
    proyectoId: row.proyectoId,
    proyectoNombre: row.proyectoNombre,
    almacenDestinoId: row.almacenDestinoId,
    almacenDestinoNombre: row.almacenDestinoNombre,
    solicitanteId: row.solicitanteId,
    solicitanteNombre: row.solicitanteNombre,
    justificacion: row.justificacion,
    prioridad: row.prioridad as PrioridadOrdenCompra,
    estado: row.estado as EstadoOrdenCompra,
    items: parseOrderItems(row.itemsJson),
    fechaSolicitud: row.fechaSolicitud,
    aprobadoPorNombre: row.aprobadoPorNombre,
    fechaRevision: row.fechaRevision,
    observacionRevision: row.observacionRevision,
    fechaAtendida: row.fechaAtendida,
    fechaActualizacion: row.fechaActualizacion,
    syncStatus: row.syncStatus,
  };
}

const PURCHASE_ORDER_SELECT = `
  SELECT
    o.id,
    o.codigo_orden AS codigoOrden,
    o.proyecto_id AS proyectoId,
    o.proyecto_nombre AS proyectoNombre,
    o.almacen_destino_id AS almacenDestinoId,
    a.nombre AS almacenDestinoNombre,
    o.solicitante_id AS solicitanteId,
    o.solicitante_nombre AS solicitanteNombre,
    o.justificacion,
    o.prioridad,
    o.estado,
    o.items_json AS itemsJson,
    o.fecha_solicitud AS fechaSolicitud,
    o.aprobado_por_nombre AS aprobadoPorNombre,
    o.fecha_revision AS fechaRevision,
    o.observacion_revision AS observacionRevision,
    o.fecha_atendida AS fechaAtendida,
    o.fecha_actualizacion AS fechaActualizacion,
    o.sync_status AS syncStatus
  FROM ordenes_compra o
  INNER JOIN almacenes a ON a.id = o.almacen_destino_id`;

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
  const movementColumns = new Set(
    (await database.getAllAsync<{ name: string }>(
      'PRAGMA table_info(movimientos_almacen)',
    )).map(({ name }) => name),
  );
  if (!movementColumns.has('origen')) {
    await database.execAsync(
      "ALTER TABLE movimientos_almacen ADD COLUMN origen TEXT CHECK (origen IN ('COMPRA', 'DONACION') OR origen IS NULL)",
    );
    movementColumns.add('origen');
  }

  const passportColumns = [
    ['receptor_nombre', 'TEXT'],
    ['receptor_dni', 'TEXT'],
    ['receptor_cargo', 'TEXT'],
    ['latitud', 'REAL'],
    ['longitud', 'REAL'],
    ['foto_uri', 'TEXT'],
    ['firma_svg_paths', 'TEXT'],
    ['hash_sha256', 'TEXT'],
  ] as const;
  for (const [name, type] of passportColumns) {
    if (!movementColumns.has(name)) {
      await database.execAsync(
        `ALTER TABLE movimientos_almacen ADD COLUMN ${name} ${type}`,
      );
      movementColumns.add(name);
    }
  }
  await migratePurchaseOrders(database);
  await createPassportImmutabilityTriggers(database);
  await seedInitialData(database);
}

async function migratePurchaseOrders(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = new Set(
    (await database.getAllAsync<{ name: string }>(
      'PRAGMA table_info(ordenes_compra)',
    )).map(({ name }) => name),
  );
  if (columns.size === 0) {
    return;
  }
  const additions = [
    ['fecha_atendida', 'TEXT'],
    ['fecha_actualizacion', "TEXT NOT NULL DEFAULT ''"],
    ['sync_status', "TEXT NOT NULL DEFAULT 'PENDING'"],
  ] as const;
  for (const [name, definition] of additions) {
    if (!columns.has(name)) {
      await database.execAsync(`ALTER TABLE ordenes_compra ADD COLUMN ${name} ${definition}`);
    }
  }
  await database.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_ordenes_sync_timestamp ON ordenes_compra(sync_status, fecha_actualizacion)',
  );
}

async function createPassportImmutabilityTriggers(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  await database.execAsync(`
    CREATE TRIGGER IF NOT EXISTS trg_movimientos_pasaporte_immutable
    BEFORE UPDATE OF tipo, origen, insumo_id, cantidad, responsable, destino_caserio,
      timestamp, receptor_nombre, receptor_dni, receptor_cargo, latitud, longitud,
      foto_uri, firma_svg_paths, hash_sha256
    ON movimientos_almacen
    WHEN OLD.hash_sha256 IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'La evidencia fiduciaria de esta salida es inmutable.');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_movimientos_pasaporte_no_delete
    BEFORE DELETE ON movimientos_almacen
    WHEN OLD.hash_sha256 IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'No se puede eliminar una salida con evidencia fiduciaria.');
    END;
  `);
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

    const seededAt = new Date().toISOString();
    const seedOrders: {
      id: string;
      codigo: string;
      proyectoId: string;
      proyectoNombre: string;
      almacenId: string;
      solicitanteId: string;
      solicitanteNombre: string;
      justificacion: string;
      prioridad: PrioridadOrdenCompra;
      estado: EstadoOrdenCompra;
      items: OrdenCompraItem[];
      aprobadoPor: string | null;
      fechaRevision: string | null;
      observacion: string | null;
    }[] = [
      {
        id: 'oc-seed-agua-001',
        codigo: 'OC-2026-001',
        proyectoId: 'proy-agua-potable',
        proyectoNombre: 'Mejoramiento del acceso a agua segura',
        almacenId: 'alm-maranon',
        solicitanteId: 'pataz-monitoreo-02',
        solicitanteNombre: 'José Luis Sánchez Vega',
        justificacion: 'Reposición de materiales para ampliar la cobertura de agua segura en el proyecto.',
        prioridad: 'ALTA',
        estado: 'PENDIENTE',
        items: [
          { insumoId: 'ins-kit-agua-maranon', nombre: 'Kit de herramientas para agua y saneamiento', cantidad: 4, unidad: 'kit' },
          { insumoId: null, nombre: 'Tubería PVC de 1 pulgada', cantidad: 120, unidad: 'metro' },
        ],
        aprobadoPor: null,
        fechaRevision: null,
        observacion: null,
      },
      {
        id: 'oc-seed-agua-002',
        codigo: 'OC-2026-002',
        proyectoId: 'proy-agua-saneamiento',
        proyectoNombre: 'Educación sanitaria y saneamiento familiar',
        almacenId: 'alm-pataz',
        solicitanteId: 'pataz-monitoreo-02',
        solicitanteNombre: 'José Luis Sánchez Vega',
        justificacion: 'Materiales para las jornadas comunitarias de educación sanitaria.',
        prioridad: 'NORMAL',
        estado: 'APROBADA',
        items: [
          { insumoId: 'ins-kit-pataz', nombre: 'Kit escolar básico', cantidad: 12, unidad: 'kit' },
        ],
        aprobadoPor: 'Rosa Elena Castillo Díaz',
        fechaRevision: seededAt,
        observacion: 'Aprobada para despacho según disponibilidad.',
      },
    ];

    for (const order of seedOrders) {
      await database.runAsync(
        `INSERT OR IGNORE INTO ordenes_compra
          (id, codigo_orden, proyecto_id, proyecto_nombre, almacen_destino_id,
           solicitante_id, solicitante_nombre, justificacion, prioridad, estado,
           items_json, fecha_solicitud, aprobado_por_nombre, fecha_revision,
           observacion_revision, fecha_atendida, fecha_actualizacion, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'PENDING')`,
        order.id,
        order.codigo,
        order.proyectoId,
        order.proyectoNombre,
        order.almacenId,
        order.solicitanteId,
        order.solicitanteNombre,
        order.justificacion,
        order.prioridad,
        order.estado,
        JSON.stringify(order.items),
        seededAt,
        order.aprobadoPor,
        order.fechaRevision,
        order.observacion,
        seededAt,
      );
    }
  });
}

export async function getPendingRecordCount(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT
      (SELECT COUNT(*) FROM movimientos_almacen WHERE sync_status IN ('PENDING', 'ERROR')) +
      (SELECT COUNT(*) FROM fichas_campo WHERE sync_status IN ('PENDING', 'ERROR')) +
      (SELECT COUNT(*) FROM ordenes_compra WHERE sync_status = 'PENDING') AS count`,
  );

  return result?.count ?? 0;
}

export async function getSyncDashboardData(): Promise<SyncDashboardData> {
  const database = await getDatabase();
  const [
    movementCounts,
    fieldCounts,
    orderCounts,
    pendingApprovalOrderCounts,
    movementRows,
    fieldRows,
    orderRows,
  ] = await Promise.all([
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
    database.getFirstAsync<{ pendingOrderCount: number }>(
      `SELECT COUNT(*) AS pendingOrderCount FROM ordenes_compra
       WHERE sync_status = 'PENDING'`,
    ),
    database.getFirstAsync<{ pendingApprovalOrderCount: number }>(
      `SELECT COUNT(*) AS pendingApprovalOrderCount FROM ordenes_compra
       WHERE estado = 'PENDIENTE'`,
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
    database.getAllAsync<SyncQueueEntry>(
      `SELECT
        o.id,
        'ORDEN_COMPRA' AS entityType,
        'Orden de compra · ' || o.codigo_orden AS title,
        o.proyecto_nombre || ' · ' || a.nombre || ' · ' || o.estado AS detail,
        o.fecha_actualizacion AS timestamp,
        o.sync_status AS syncStatus
      FROM ordenes_compra o
      INNER JOIN almacenes a ON a.id = o.almacen_destino_id
      WHERE o.sync_status = 'PENDING'`,
    ),
  ]);

  const queue = [...movementRows, ...fieldRows, ...orderRows].sort((first, second) =>
    first.timestamp.localeCompare(second.timestamp),
  );

  return {
    pendingMovementCount: movementCounts?.pendingMovementCount ?? 0,
    pendingFieldCount: fieldCounts?.pendingFieldCount ?? 0,
    pendingOrderCount: orderCounts?.pendingOrderCount ?? 0,
    pendingApprovalOrderCount: pendingApprovalOrderCounts?.pendingApprovalOrderCount ?? 0,
    queue,
  };
}

export async function getPurchaseOrders(
  status?: EstadoOrdenCompra,
): Promise<OrdenCompra[]> {
  const database = await getDatabase();
  const query = `${PURCHASE_ORDER_SELECT}
    ${status ? 'WHERE o.estado = ?' : ''}
    ORDER BY o.fecha_solicitud DESC, o.codigo_orden DESC`;
  const rows = status
    ? await database.getAllAsync<OrdenCompraRow>(query, status)
    : await database.getAllAsync<OrdenCompraRow>(query);
  return rows.map(mapPurchaseOrder);
}

export async function getPurchaseOrder(id: string): Promise<OrdenCompra | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<OrdenCompraRow>(
    `${PURCHASE_ORDER_SELECT} WHERE o.id = ?`,
    id,
  );
  return row ? mapPurchaseOrder(row) : null;
}

export async function createPurchaseOrder(
  input: NuevaOrdenCompraInput,
  actor: OrdenCompraActor,
): Promise<OrdenCompra> {
  if (actor.roleKey !== 'CAMPO') {
    throw new Error('Solo el personal de Campo puede crear requerimientos de compra.');
  }
  const justification = input.justificacion.trim();
  const items = parseOrderItems(JSON.stringify(input.items));
  if (justification.length < 10) {
    throw new Error('La justificación técnica debe incluir al menos 10 caracteres.');
  }
  if (!ORDER_PRIORITIES.includes(input.prioridad)) {
    throw new Error('Selecciona una prioridad válida.');
  }

  const database = await getDatabase();
  const orderId = Crypto.randomUUID();
  const timestamp = new Date().toISOString();
  let createdOrder: OrdenCompra | undefined;

  await database.withTransactionAsync(async () => {
    const project = await database.getFirstAsync<{ nombre: string }>(
      'SELECT nombre FROM proyectos WHERE id = ?',
      input.proyectoId,
    );
    const warehouse = await database.getFirstAsync<{ nombre: string }>(
      'SELECT nombre FROM almacenes WHERE id = ?',
      input.almacenDestinoId,
    );
    if (!project || !warehouse) {
      throw new Error('Selecciona un proyecto y un almacén existentes.');
    }
    for (const item of items) {
      if (item.insumoId) {
        const catalogItem = await database.getFirstAsync<{ nombre: string; unidad: string }>(
          'SELECT nombre, unidad FROM insumos WHERE id = ?',
          item.insumoId,
        );
        if (!catalogItem) {
          throw new Error(`El insumo ${item.nombre} ya no existe en el catálogo local.`);
        }
        if (
          catalogItem.nombre !== item.nombre ||
          catalogItem.unidad !== item.unidad
        ) {
          throw new Error('Los datos del insumo seleccionado ya no coinciden con el catálogo local.');
        }
      }
    }
    const currentYear = new Date().getFullYear();
    const previousCode = await database.getFirstAsync<{ codigoOrden: string }>(
      `SELECT codigo_orden AS codigoOrden FROM ordenes_compra
       WHERE codigo_orden LIKE ? ORDER BY codigo_orden DESC LIMIT 1`,
      `OC-${currentYear}-%`,
    );
    const previousSequence = previousCode
      ? Number(previousCode.codigoOrden.split('-').pop())
      : 0;
    const nextSequence = Number.isFinite(previousSequence) ? previousSequence + 1 : 1;
    const code = `OC-${currentYear}-${String(nextSequence).padStart(3, '0')}`;

    await database.runAsync(
      `INSERT INTO ordenes_compra
        (id, codigo_orden, proyecto_id, proyecto_nombre, almacen_destino_id,
         solicitante_id, solicitante_nombre, justificacion, prioridad, estado,
         items_json, fecha_solicitud, aprobado_por_nombre, fecha_revision,
         observacion_revision, fecha_atendida, fecha_actualizacion, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, NULL, NULL, NULL, NULL, ?, 'PENDING')`,
      orderId,
      code,
      input.proyectoId,
      project.nombre,
      input.almacenDestinoId,
      actor.id,
      actor.nombreCompleto,
      justification,
      input.prioridad,
      JSON.stringify(items),
      timestamp,
      timestamp,
    );
    createdOrder = {
      id: orderId,
      codigoOrden: code,
      proyectoId: input.proyectoId,
      proyectoNombre: project.nombre,
      almacenDestinoId: input.almacenDestinoId,
      almacenDestinoNombre: warehouse.nombre,
      solicitanteId: actor.id,
      solicitanteNombre: actor.nombreCompleto,
      justificacion: justification,
      prioridad: input.prioridad,
      estado: 'PENDIENTE',
      items,
      fechaSolicitud: timestamp,
      aprobadoPorNombre: null,
      fechaRevision: null,
      observacionRevision: null,
      fechaAtendida: null,
      fechaActualizacion: timestamp,
      syncStatus: 'PENDING',
    };
  });

  if (!createdOrder) {
    throw new Error('No se pudo guardar la orden de compra.');
  }
  return createdOrder;
}

export async function reviewPurchaseOrder(
  orderId: string,
  decision: 'APROBADA' | 'RECHAZADA',
  observation: string,
  actor: OrdenCompraActor,
): Promise<void> {
  if (actor.roleKey !== 'ADMIN') {
    throw new Error('Solo Administración puede aprobar o rechazar órdenes.');
  }
  const timestamp = new Date().toISOString();
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE ordenes_compra
     SET estado = ?, aprobado_por_nombre = ?, fecha_revision = ?,
         observacion_revision = ?, fecha_actualizacion = ?, sync_status = 'PENDING'
     WHERE id = ? AND estado = 'PENDIENTE'`,
    decision,
    actor.nombreCompleto,
    timestamp,
    observation.trim() || null,
    timestamp,
    orderId,
  );
  if (result.changes === 0) {
    throw new Error('La orden ya no está pendiente o no existe.');
  }
}

export async function markPurchaseOrderAttended(
  orderId: string,
  actor: OrdenCompraActor,
): Promise<void> {
  if (actor.roleKey !== 'CAMPO' && actor.roleKey !== 'LOGISTICA') {
    throw new Error('Solo Campo o Logística pueden confirmar una orden atendida.');
  }
  const timestamp = new Date().toISOString();
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE ordenes_compra
     SET estado = 'ATENDIDA', fecha_atendida = ?, fecha_actualizacion = ?,
         sync_status = 'PENDING'
     WHERE id = ? AND estado = 'APROBADA'`,
    timestamp,
    timestamp,
    orderId,
  );
  if (result.changes === 0) {
    throw new Error('Solo se puede atender una orden aprobada que aún no haya sido procesada.');
  }
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
         m.sync_status AS syncStatus,
         CASE WHEN m.hash_sha256 IS NOT NULL THEN 1 ELSE 0 END AS hasActa
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
         f.sync_status AS syncStatus,
         0 AS hasActa
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
): Promise<WarehouseMovementRecord> {
  const responsable = input.responsable.trim();
  const destinoCaserio = input.destinoCaserio.trim();
  const evidence = input.evidencia;
  let passport: ValidatedPassportEvidence | null = null;

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
  if (input.tipo === 'SALIDA') {
    if (!evidence) {
      throw new Error('Completa la evidencia fiduciaria de la salida.');
    }
    const receptorNombre = evidence.receptorNombre.trim();
    const receptorDni = evidence.receptorDni.trim();
    const receptorCargo = evidence.receptorCargo.trim();
    if (!receptorNombre || !receptorCargo) {
      throw new Error('Completa el nombre y el cargo u organización del receptor.');
    }
    if (!/^\d{8}$/.test(receptorDni)) {
      throw new Error('El DNI del receptor debe contener exactamente 8 dígitos.');
    }
    if (!evidence.firmaSvgPaths || !parseSignaturePaths(evidence.firmaSvgPaths)) {
      throw new Error('Registra la firma del representante antes de guardar la salida.');
    }
    if ((evidence.latitud === null) !== (evidence.longitud === null)) {
      throw new Error('Las coordenadas deben incluir latitud y longitud.');
    }
    if (
      (evidence.latitud !== null &&
        (!Number.isFinite(evidence.latitud) || evidence.latitud < -90 || evidence.latitud > 90)) ||
      (evidence.longitud !== null &&
        (!Number.isFinite(evidence.longitud) || evidence.longitud < -180 || evidence.longitud > 180))
    ) {
      throw new Error('Las coordenadas GPS están fuera de rango.');
    }
    passport = {
      receptorNombre,
      receptorDni,
      receptorCargo,
      latitud: evidence.latitud,
      longitud: evidence.longitud,
      fotoUri: evidence.fotoUri,
      firmaSvgPaths: evidence.firmaSvgPaths,
    };
  }

  const database = await getDatabase();
  const item = await database.getFirstAsync<{
    id: string;
    codigo: string;
    nombre: string;
    almacenId: string;
    almacenNombre: string;
  }>(
    `SELECT i.id, i.codigo, i.nombre, i.almacen_id AS almacenId,
      a.nombre AS almacenNombre
     FROM insumos i
     INNER JOIN almacenes a ON a.id = i.almacen_id
     WHERE i.id = ?`,
    input.insumoId,
  );
  if (!item) {
    throw new Error('El insumo seleccionado ya no existe en el inventario local.');
  }

  const id = Crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const receptorNombre = passport?.receptorNombre ?? null;
  const receptorDni = passport?.receptorDni ?? null;
  const receptorCargo = passport?.receptorCargo ?? null;
  const latitud = passport?.latitud ?? null;
  const longitud = passport?.longitud ?? null;
  const fotoUri = passport?.fotoUri ?? null;
  const firmaSvgPaths = passport?.firmaSvgPaths ?? null;
  const hashSha256 = passport
    ? await createPassportHash({
      id,
      insumoCodigo: item.codigo,
      cantidad: input.cantidad,
      almacenId: item.almacenId,
      receptorDni: passport.receptorDni,
      latitud,
      longitud,
      timestamp,
      firmaSvgPaths: passport.firmaSvgPaths,
    })
    : null;

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
        (id, tipo, origen, insumo_id, cantidad, responsable, destino_caserio, timestamp,
         sync_status, receptor_nombre, receptor_dni, receptor_cargo, latitud, longitud,
         foto_uri, firma_svg_paths, hash_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.tipo,
      input.origen,
      input.insumoId,
      input.cantidad,
      responsable,
      destinoCaserio || null,
      timestamp,
      receptorNombre,
      receptorDni,
      receptorCargo,
      latitud,
      longitud,
      fotoUri,
      firmaSvgPaths,
      hashSha256,
    );
  });

  return {
    id,
    tipo: input.tipo,
    origen: input.origen,
    insumoId: input.insumoId,
    cantidad: input.cantidad,
    responsable,
    destinoCaserio: destinoCaserio || null,
    timestamp,
    syncStatus: 'PENDING',
    receptorNombre,
    receptorDni,
    receptorCargo,
    latitud,
    longitud,
    fotoUri,
    firmaSvgPaths,
    hashSha256,
    insumoCodigo: item.codigo,
    insumoNombre: item.nombre,
    almacenId: item.almacenId,
    almacenNombre: item.almacenNombre,
  };
}

export async function getWarehouseMovementDetails(
  movementId: string,
): Promise<WarehouseMovementRecord | null> {
  const database = await getDatabase();
  return database.getFirstAsync<WarehouseMovementRecord>(
    `SELECT
      m.id,
      m.tipo,
      m.origen,
      m.insumo_id AS insumoId,
      m.cantidad,
      m.responsable,
      m.destino_caserio AS destinoCaserio,
      m.timestamp,
      m.sync_status AS syncStatus,
      m.receptor_nombre AS receptorNombre,
      m.receptor_dni AS receptorDni,
      m.receptor_cargo AS receptorCargo,
      m.latitud,
      m.longitud,
      m.foto_uri AS fotoUri,
      m.firma_svg_paths AS firmaSvgPaths,
      m.hash_sha256 AS hashSha256,
      i.codigo AS insumoCodigo,
      i.nombre AS insumoNombre,
      a.id AS almacenId,
      a.nombre AS almacenNombre
    FROM movimientos_almacen m
    INNER JOIN insumos i ON i.id = m.insumo_id
    INNER JOIN almacenes a ON a.id = i.almacen_id
    WHERE m.id = ?
    LIMIT 1`,
    movementId,
  );
}
