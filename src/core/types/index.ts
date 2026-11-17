export type CategoriaInsumo = 'Agrícola' | 'Salud' | 'Educación';
export type EjeProyecto = 'Salud' | 'Agricultura' | 'Educación';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'ERROR';
export type TipoMovimiento = 'ENTRADA' | 'SALIDA';

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
  insumoId: string;
  cantidad: number;
  responsable: string;
  destinoCaserio: string | null;
  timestamp: string;
  syncStatus: SyncStatus;
}

export interface ProyectoCampo {
  id: string;
  codigo: string;
  nombre: string;
  eje: EjeProyecto;
  caserio: string;
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

export type SyncEntityType = 'MOVIMIENTO_ALMACEN' | 'FICHA_CAMPO';
export type SyncLogStatus = 'SUCCESS' | 'ERROR';

export interface SyncLog {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  syncStatus: SyncLogStatus;
  message: string;
  timestamp: string;
  endpoint: string;
}
