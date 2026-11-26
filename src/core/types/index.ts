export type CategoriaInsumo = 'Agrícola' | 'Salud' | 'Educación';
export type EjeProyecto =
  | 'Salud'
  | 'Agricultura'
  | 'Educación'
  | 'Agua y saneamiento';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'ERROR';
export type TipoMovimiento = 'ENTRADA' | 'SALIDA';
export type OrigenMovimiento = 'COMPRA' | 'DONACION';
export type EstadoEnvio =
  | 'REGISTRADO_ALMACEN'
  | 'EN_TRANSITO'
  | 'EN_PUNTO_ENTREGA'
  | 'ENTREGADO';

export interface HitoTracking {
  estado: EstadoEnvio;
  titulo: string;
  descripcion: string;
  fechaHora: string;
  responsable: string;
}
export * from './ordenCompra';
export * from './decision';

export interface Almacen {
  id: string;
  nombre: 'Lavasen' | 'Marañón' | 'Pataz';
  ubicacion: string;
}

export interface Insumo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaInsumo;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  almacenId: string;
}

export interface MovimientoAlmacen {
  id: string;
  tipo: TipoMovimiento;
  origen: OrigenMovimiento | null;
  insumoId: string;
  cantidad: number;
  responsable: string;
  destinoCaserio: string | null;
  timestamp: string;
  syncStatus: SyncStatus;
  receptorNombre: string | null;
  receptorDni: string | null;
  receptorCargo: string | null;
  latitud: number | null;
  longitud: number | null;
  fotoUri: string | null;
  firmaSvgPaths: string | null;
  hashSha256: string | null;
  codigoEnvio: string | null;
  estadoEnvio: EstadoEnvio | null;
  historialTrackingJson: string | null;
}

export interface WarehouseMovementRecord extends MovimientoAlmacen {
  insumoCodigo: string;
  insumoNombre: string;
  insumoUnidad: string;
  almacenId: string;
  almacenNombre: string;
}

export interface ProyectoCampo {
  id: string;
  codigo: string;
  nombre: string;
  eje: EjeProyecto;
  caserio: string;
}

export interface ProyectoCampoResumen extends ProyectoCampo {
  totalFichas: number;
  pendientesSync: number;
  erroresSync: number;
  fichasSincronizadas: number;
}

export interface FichaCampo {
  id: string;
  proyectoId: string;
  beneficiarioDni: string;
  beneficiarioNombre: string;
  actividadRealizada: string;
  observaciones: string;
  latitud: number | null;
  longitud: number | null;
  timestamp: string;
  syncStatus: SyncStatus;
}

export interface NuevaFichaCampo {
  proyectoId: string;
  beneficiarioDni: string;
  beneficiarioNombre: string;
  actividadRealizada: string;
  observaciones: string;
  latitud: number | null;
  longitud: number | null;
}

export type SyncEntityType = 'MOVIMIENTO_ALMACEN' | 'FICHA_CAMPO' | 'ORDEN_COMPRA';
export type SyncLogStatus = 'SUCCESS' | 'ERROR';

export interface SyncQueueEntry {
  id: string;
  entityType: SyncEntityType;
  title: string;
  detail: string;
  timestamp: string;
  syncStatus: SyncStatus;
}

export interface SyncDashboardData {
  pendingMovementCount: number;
  pendingFieldCount: number;
  pendingOrderCount: number;
  pendingApprovalOrderCount: number;
  queue: SyncQueueEntry[];
}

export interface SyncLog {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  syncStatus: SyncLogStatus;
  message: string;
  timestamp: string;
  endpoint: string;
}
