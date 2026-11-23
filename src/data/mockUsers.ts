import type { UsuarioApp } from '../core/types/auth';

export const mockUsers: UsuarioApp[] = [
  {
    id: 'pataz-logistica-01',
    nombreCompleto: 'María Fernanda Rojas Huamán',
    correo: 'maria.rojas@asociacionpataz.org',
    password: 'PatazDemo01',
    rol: 'Coordinador Logístico de Campo',
    sedeAsignada: 'Lavasen',
    codigoEmpleado: 'AP-LOG-014',
    iniciales: 'MR',
  },
  {
    id: 'pataz-monitoreo-02',
    nombreCompleto: 'José Luis Sánchez Vega',
    correo: 'jose.sanchez@asociacionpataz.org',
    password: 'PatazDemo02',
    rol: 'Especialista de Monitoreo y Evaluación',
    sedeAsignada: 'Pataz',
    codigoEmpleado: 'AP-ME-027',
    iniciales: 'JS',
  },
  {
    id: 'pataz-almacenes-03',
    nombreCompleto: 'Rosa Elena Castillo Díaz',
    correo: 'rosa.castillo@asociacionpataz.org',
    password: 'PatazDemo03',
    rol: 'Jefe de Almacenes',
    sedeAsignada: 'Sede Central Pataz',
    codigoEmpleado: 'AP-ADM-001',
    iniciales: 'RC',
  },
];
