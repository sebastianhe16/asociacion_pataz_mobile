import * as SQLite from 'expo-sqlite';
import { DATABASE_SCHEMA } from './schema';

const DATABASE_NAME = 'asociacion_pataz.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
