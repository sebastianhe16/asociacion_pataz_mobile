export type RolUsuario =
  | 'Coordinador Logístico de Campo'
  | 'Especialista de Monitoreo y Evaluación'
  | 'Jefe de Almacenes';

export type SedeAsignada = 'Lavasen' | 'Marañón' | 'Pataz' | 'Sede Central Pataz';

export interface UsuarioApp {
  id: string;
  nombreCompleto: string;
  correo: string;
  password: string;
  rol: RolUsuario;
  sedeAsignada: SedeAsignada;
  codigoEmpleado: string;
  iniciales: string;
}

export type UsuarioSesion = Omit<UsuarioApp, 'password'>;
