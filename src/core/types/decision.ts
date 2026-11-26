export type TipoDecisionGerencial =
  | 'NUEVO_PROYECTO_DONACION'
  | 'ABASTECIMIENTO_DESBALANCE'
  | 'REDISTRIBUCION_STOCK';

export interface DecisionGerencial {
  id: string;
  tipo: TipoDecisionGerencial;
  titulo: string;
  detalle: string;
  insumoRelacionado: string | null;
  cantidadInvolucrada: number | null;
  caserioOProyectoDestino: string | null;
  decididoPorNombre: string;
  fechaHora: string;
  estado: 'APROBADA';
}

export interface AprobarDecisionGerencialInput {
  tipo: TipoDecisionGerencial;
  titulo: string;
  detalle: string;
  insumoId: string | null;
  insumoRelacionado: string | null;
  cantidadInvolucrada: number | null;
  caserioOProyectoDestino: string | null;
  nuevoProyecto?: {
    nombre: string;
    eje: 'Salud' | 'Agricultura' | 'Educación';
    caserio: string;
  };
}
