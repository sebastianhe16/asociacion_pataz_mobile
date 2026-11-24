export type PrioridadOrdenCompra = 'NORMAL' | 'ALTA' | 'URGENTE';
export type EstadoOrdenCompra = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ATENDIDA';
export type OrdenCompraSyncStatus = 'PENDING' | 'SYNCED';

export interface OrdenCompraItem {
  insumoId: string | null;
  nombre: string;
  cantidad: number;
  unidad: string;
}

export interface OrdenCompra extends OrdenCompraSyncFields {
  id: string;
  codigoOrden: string;
  proyectoId: string;
  proyectoNombre: string;
  almacenDestinoId: string;
  almacenDestinoNombre: string;
  solicitanteId: string;
  solicitanteNombre: string;
  justificacion: string;
  prioridad: PrioridadOrdenCompra;
  estado: EstadoOrdenCompra;
  items: OrdenCompraItem[];
  fechaSolicitud: string;
  aprobadoPorNombre: string | null;
  fechaRevision: string | null;
  observacionRevision: string | null;
  fechaAtendida: string | null;
  fechaActualizacion: string;
}

interface OrdenCompraSyncFields {
  syncStatus: OrdenCompraSyncStatus;
}

export interface NuevaOrdenCompraInput {
  proyectoId: string;
  almacenDestinoId: string;
  justificacion: string;
  prioridad: PrioridadOrdenCompra;
  items: OrdenCompraItem[];
}
