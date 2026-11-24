export type RolUsuario =
  | 'Coordinador Logístico de Campo'
  | 'Especialista de Monitoreo y Evaluación'
  | 'Especialista de Proyectos de Campo'
  | 'Jefe de Almacenes'
  | 'Administrador General / Aprobador';

export type SedeAsignada = 'Lavasen' | 'Marañón' | 'Pataz' | 'Sede Central Pataz';
export type RoleKey = 'ADMIN' | 'CAMPO' | 'LOGISTICA';

export interface UsuarioApp {
  id: string;
  nombreCompleto: string;
  correo: string;
  password: string;
  rol: RolUsuario;
  sedeAsignada: SedeAsignada;
  codigoEmpleado: string;
  iniciales: string;
  roleKey: RoleKey;
}

export type UsuarioSesion = Omit<UsuarioApp, 'password'>;
