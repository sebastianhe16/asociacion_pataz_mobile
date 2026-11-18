export const DATABASE_SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS almacenes (
    id TEXT PRIMARY KEY NOT NULL,
    nombre TEXT NOT NULL UNIQUE,
    ubicacion TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS insumos (
    id TEXT PRIMARY KEY NOT NULL,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('Agrícola', 'Salud', 'Educación')),
    unidad TEXT NOT NULL,
    stock_actual REAL NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo REAL NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    almacen_id TEXT NOT NULL REFERENCES almacenes(id),
    UNIQUE (codigo, almacen_id)
  );

  CREATE TABLE IF NOT EXISTS movimientos_almacen (
    id TEXT PRIMARY KEY NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    origen TEXT CHECK (origen IN ('COMPRA', 'DONACION') OR origen IS NULL),
    insumo_id TEXT NOT NULL REFERENCES insumos(id),
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    responsable TEXT NOT NULL,
    destino_caserio TEXT,
    timestamp TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (sync_status IN ('PENDING', 'SYNCED', 'ERROR'))
  );

  CREATE TABLE IF NOT EXISTS proyectos (
    id TEXT PRIMARY KEY NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    eje TEXT NOT NULL CHECK (
      eje IN ('Salud', 'Agricultura', 'Educación', 'Agua y saneamiento')
    ),
    caserio TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fichas_campo (
    id TEXT PRIMARY KEY NOT NULL,
    proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
    beneficiario_dni TEXT NOT NULL,
    beneficiario_nombre TEXT NOT NULL,
    actividad_realizada TEXT NOT NULL,
    observaciones TEXT NOT NULL DEFAULT '',
    latitud REAL,
    longitud REAL,
    timestamp TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (sync_status IN ('PENDING', 'SYNCED', 'ERROR'))
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    sync_status TEXT NOT NULL CHECK (sync_status IN ('SUCCESS', 'ERROR')),
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    endpoint TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_movimientos_sync_timestamp
    ON movimientos_almacen(sync_status, timestamp);
  CREATE INDEX IF NOT EXISTS idx_fichas_sync_timestamp
    ON fichas_campo(sync_status, timestamp);
  CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp
    ON sync_logs(timestamp);
`;
