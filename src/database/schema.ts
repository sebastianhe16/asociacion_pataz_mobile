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
      CHECK (sync_status IN ('PENDING', 'SYNCED', 'ERROR')),
    receptor_nombre TEXT,
    receptor_dni TEXT,
    receptor_cargo TEXT,
    latitud REAL,
    longitud REAL,
    foto_uri TEXT,
    firma_svg_paths TEXT,
    hash_sha256 TEXT,
    codigo_envio TEXT,
    estado_envio TEXT CHECK (
      estado_envio IN (
        'REGISTRADO_ALMACEN',
        'EN_TRANSITO',
        'EN_PUNTO_ENTREGA',
        'ENTREGADO'
      ) OR estado_envio IS NULL
    ),
    historial_tracking_json TEXT,
    cantidad_entregada REAL,
    diferencia_entrega REAL NOT NULL DEFAULT 0,
    estado_conformidad_entrega TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (
      estado_conformidad_entrega IN ('PENDIENTE', 'COMPLETA', 'PARCIAL_CON_OBSERVACION')
    ),
    motivo_diferencia TEXT CHECK (
      motivo_diferencia IN (
        'Daño en ruta / clima',
        'Entrega parcial / fraccionada',
        'Merma operativa',
        'Extravío en tránsito',
        'Otro'
      ) OR motivo_diferencia IS NULL
    ),
    observacion_entrega TEXT
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

  CREATE TABLE IF NOT EXISTS ordenes_compra (
    id TEXT PRIMARY KEY NOT NULL,
    codigo_orden TEXT NOT NULL UNIQUE,
    proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
    proyecto_nombre TEXT NOT NULL,
    almacen_destino_id TEXT NOT NULL REFERENCES almacenes(id),
    solicitante_id TEXT NOT NULL,
    solicitante_nombre TEXT NOT NULL,
    justificacion TEXT NOT NULL,
    prioridad TEXT NOT NULL CHECK (prioridad IN ('NORMAL', 'ALTA', 'URGENTE')),
    estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ATENDIDA')),
    items_json TEXT NOT NULL,
    fecha_solicitud TEXT NOT NULL,
    aprobado_por_nombre TEXT,
    fecha_revision TEXT,
    observacion_revision TEXT,
    fecha_atendida TEXT,
    fecha_actualizacion TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (sync_status IN ('PENDING', 'SYNCED'))
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

  CREATE TABLE IF NOT EXISTS decisiones_gerenciales (
    id TEXT PRIMARY KEY NOT NULL,
    tipo TEXT NOT NULL CHECK (
      tipo IN (
        'NUEVO_PROYECTO_DONACION',
        'ABASTECIMIENTO_DESBALANCE',
        'REDISTRIBUCION_STOCK'
      )
    ),
    titulo TEXT NOT NULL,
    detalle TEXT NOT NULL,
    insumo_relacionado TEXT,
    cantidad_involucrada REAL,
    caserio_o_proyecto_destino TEXT,
    decidido_por_nombre TEXT NOT NULL,
    fecha_hora TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado = 'APROBADA')
  );

  CREATE INDEX IF NOT EXISTS idx_movimientos_sync_timestamp
    ON movimientos_almacen(sync_status, timestamp);
  CREATE INDEX IF NOT EXISTS idx_fichas_sync_timestamp
    ON fichas_campo(sync_status, timestamp);
  CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp
    ON sync_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_decisiones_gerenciales_fecha
    ON decisiones_gerenciales(fecha_hora DESC);
`;
