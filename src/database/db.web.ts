import * as Crypto from 'expo-crypto';
import type {
  Almacen,
  AprobarDecisionGerencialInput,
  DecisionGerencial,
  EstadoConformidadEntrega,
  EstadoEnvio,
  EstadoOrdenCompra,
  FichaCampo,
  HitoTracking,
  Insumo,
  MotivoDiferenciaEntrega,
  NuevaFichaCampo,
  NuevaOrdenCompraInput,
  OrdenCompra,
  OrdenCompraItem,
  OrigenMovimiento,
  ProyectoCampo,
  ProyectoCampoResumen,
  SyncDashboardData,
  SyncEntityType,
  SyncLog,
  SyncQueueEntry,
  SyncStatus,
  TipoMovimiento,
  WarehouseMovementRecord,
} from '../core/types';
import type { RoleKey } from '../core/types/auth';
import { createPassportHash, parseSignaturePaths } from '../services/warehouse/passportIntegrity';

const STORAGE_KEY = 'asociacion-pataz.database.v1';
const SHIPMENT_STATES: EstadoEnvio[] = [
  'REGISTRADO_ALMACEN',
  'EN_TRANSITO',
  'EN_PUNTO_ENTREGA',
  'ENTREGADO',
];
const ORDER_PRIORITIES = ['NORMAL', 'ALTA', 'URGENTE'] as const;

export interface InventoryItem extends Insumo {
  almacenNombre: string;
}

export interface WarehouseStatusSummary extends Almacen {
  itemCount: number;
  lowStockCount: number;
}

export interface RecentActivity {
  id: string;
  entityType: SyncEntityType;
  title: string;
  detail: string;
  timestamp: string;
  syncStatus: SyncStatus;
  hasActa: number;
  codigoEnvio: string | null;
  estadoEnvio: EstadoEnvio | null;
  estadoConformidadEntrega: EstadoConformidadEntrega | null;
  diferenciaEntrega: number | null;
}

export interface PassportEvidenceInput {
  receptorNombre: string;
  receptorDni: string;
  receptorCargo: string;
  latitud: number | null;
  longitud: number | null;
  fotoUri: string | null;
  firmaSvgPaths: string | null;
}

export interface RegisterWarehouseMovementInput {
  tipo: TipoMovimiento;
  origen: OrigenMovimiento | null;
  insumoId: string;
  cantidad: number;
  responsable: string;
  destinoCaserio: string;
  evidencia?: PassportEvidenceInput;
}

export interface InventoryBalance extends InventoryItem {
  cantidadSolicitada: number;
  diferencia: number;
  estadoBalance: 'DEFICIT' | 'EXCEDENTE' | 'EQUILIBRADO';
}

export interface DonationMovementSummary {
  insumoId: string;
  quantityDonated: number;
  quantityDispatched: number;
}

export interface ShipmentStatusCounts {
  inTransit: number;
  delivered: number;
}

export interface PendingSyncPackage {
  id: string;
  timestamp: string;
  entityType: SyncEntityType;
  endpoint: string;
}

interface BrowserDatabaseState {
  almacenes: Almacen[];
  insumos: InventoryItem[];
  proyectos: ProyectoCampo[];
  movimientos: WarehouseMovementRecord[];
  fichas: FichaCampo[];
  ordenes: OrdenCompra[];
  decisiones: DecisionGerencial[];
  syncLogs: SyncLog[];
}

interface OrderActor {
  id: string;
  nombreCompleto: string;
  roleKey: RoleKey;
}

interface DecisionActor {
  nombreCompleto: string;
  roleKey: RoleKey;
}

interface TrackingActor {
  nombreCompleto: string;
  roleKey: RoleKey;
}

export interface DeliveryVerificationInput {
  cantidadEntregada: number;
  motivoDiferencia: MotivoDiferenciaEntrega | null;
  observacionEntrega: string | null;
}

let stateCache: BrowserDatabaseState | null = null;
let memoryFallback: BrowserDatabaseState | null = null;

const SEED_WAREHOUSES: Almacen[] = [
  { id: 'alm-lavasen', nombre: 'Lavasen', ubicacion: 'Base logística Lavasen, Pataz' },
  { id: 'alm-maranon', nombre: 'Marañón', ubicacion: 'Base logística Marañón, La Libertad' },
  { id: 'alm-pataz', nombre: 'Pataz', ubicacion: 'Base logística Pataz, La Libertad' },
];

const SEED_INVENTORY: (InventoryItem & { seedStock: number; seedMinimum: number })[] = [
  { id: 'ins-papa-lavasen', codigo: 'AG-PAPA-325', nombre: 'Semillas de papa INIA-325', categoria: 'Agrícola', unidad: 'kg', stockActual: 240, stockMinimo: 50, almacenId: 'alm-lavasen', almacenNombre: 'Lavasen', seedStock: 240, seedMinimum: 50 },
  { id: 'ins-palta-lavasen', codigo: 'AG-PALTA-HASS', nombre: 'Plantones de palta Hass', categoria: 'Agrícola', unidad: 'plantón', stockActual: 75, stockMinimo: 30, almacenId: 'alm-lavasen', almacenNombre: 'Lavasen', seedStock: 75, seedMinimum: 30 },
  { id: 'ins-sulfato-pataz', codigo: 'SA-SULF-FER', nombre: 'Sulfato ferroso (suplemento contra anemia)', categoria: 'Salud', unidad: 'frasco', stockActual: 15, stockMinimo: 30, almacenId: 'alm-pataz', almacenNombre: 'Pataz', seedStock: 15, seedMinimum: 30 },
  { id: 'ins-kit-pataz', codigo: 'ED-KIT-ESC', nombre: 'Kit escolar básico', categoria: 'Educación', unidad: 'kit', stockActual: 125, stockMinimo: 35, almacenId: 'alm-pataz', almacenNombre: 'Pataz', seedStock: 125, seedMinimum: 35 },
  { id: 'ins-fertilizante-maranon', codigo: 'AG-FERT-ORG', nombre: 'Fertilizante orgánico', categoria: 'Agrícola', unidad: 'saco', stockActual: 72, stockMinimo: 20, almacenId: 'alm-maranon', almacenNombre: 'Marañón', seedStock: 72, seedMinimum: 20 },
  { id: 'ins-planton-queuna-maranon', codigo: 'AG-QUE-PLT', nombre: 'Plantones de queuña', categoria: 'Agrícola', unidad: 'plantón', stockActual: 310, stockMinimo: 80, almacenId: 'alm-maranon', almacenNombre: 'Marañón', seedStock: 310, seedMinimum: 80 },
  { id: 'ins-botiquin-lavasen', codigo: 'SA-BOT-PRI', nombre: 'Botiquín de primeros auxilios', categoria: 'Salud', unidad: 'unidad', stockActual: 20, stockMinimo: 8, almacenId: 'alm-lavasen', almacenNombre: 'Lavasen', seedStock: 20, seedMinimum: 8 },
  { id: 'ins-kit-agua-maranon', codigo: 'ED-KIT-AGU', nombre: 'Kit de herramientas para agua y saneamiento', categoria: 'Educación', unidad: 'kit', stockActual: 14, stockMinimo: 5, almacenId: 'alm-maranon', almacenNombre: 'Marañón', seedStock: 14, seedMinimum: 5 },
];

const SEED_PROJECTS: ProyectoCampo[] = [
  { id: 'proy-salud-anemia', codigo: 'P01-SAL-ANEMIA', nombre: 'Prevención de anemia infantil', eje: 'Salud', caserio: 'Chagual' },
  { id: 'proy-salud-familiar', codigo: 'P02-SAL-FAMILIA', nombre: 'Acompañamiento a familias saludables', eje: 'Salud', caserio: 'Nimpana' },
  { id: 'proy-agri-papa', codigo: 'P03-AGR-PAPA', nombre: 'Fortalecimiento de cultivo de papa', eje: 'Agricultura', caserio: 'Lavasen' },
  { id: 'proy-agri-frutales', codigo: 'P04-AGR-FRUTAL', nombre: 'Instalación de frutales altoandinos', eje: 'Agricultura', caserio: 'Marañón' },
  { id: 'proy-educ-escuela', codigo: 'P05-EDU-ESCUELA', nombre: 'Apoyo a la educación rural', eje: 'Educación', caserio: 'Pataz' },
  { id: 'proy-salud-nutricion', codigo: 'P06-SAL-NUTRI', nombre: 'Nutrición y desarrollo infantil temprano', eje: 'Salud', caserio: 'Suyubamba' },
  { id: 'proy-salud-materna', codigo: 'P07-SAL-MATERNA', nombre: 'Salud materna y acompañamiento prenatal', eje: 'Salud', caserio: 'Vijus' },
  { id: 'proy-salud-promotores', codigo: 'P08-SAL-PROMO', nombre: 'Formación de promotores comunitarios de salud', eje: 'Salud', caserio: 'Shicun' },
  { id: 'proy-salud-bucal', codigo: 'P09-SAL-BUCAL', nombre: 'Jornadas de salud bucal comunitaria', eje: 'Salud', caserio: 'Chuquitambo' },
  { id: 'proy-salud-adolescencia', codigo: 'P10-SAL-ADOLESCENCIA', nombre: 'Bienestar y salud para adolescentes', eje: 'Salud', caserio: 'Campamento' },
  { id: 'proy-agri-semillas', codigo: 'P11-AGR-SEMILLAS', nombre: 'Producción local de semillas certificadas', eje: 'Agricultura', caserio: 'Cachica' },
  { id: 'proy-agri-huertos', codigo: 'P12-AGR-HUERTOS', nombre: 'Huertos familiares y seguridad alimentaria', eje: 'Agricultura', caserio: 'Pías' },
  { id: 'proy-agri-ganaderia', codigo: 'P13-AGR-GANADERIA', nombre: 'Mejoramiento de crianza de ganado menor', eje: 'Agricultura', caserio: 'Alacoto' },
  { id: 'proy-agri-suelos', codigo: 'P14-AGR-SUELOS', nombre: 'Conservación de suelos y abonos orgánicos', eje: 'Agricultura', caserio: 'Vista Florida' },
  { id: 'proy-agri-riego', codigo: 'P15-AGR-RIEGO', nombre: 'Riego tecnificado para agricultura familiar', eje: 'Agricultura', caserio: 'Huariracra' },
  { id: 'proy-agri-forestal', codigo: 'P16-AGR-FORESTAL', nombre: 'Reforestación con especies nativas altoandinas', eje: 'Agricultura', caserio: 'Los Alisos' },
  { id: 'proy-educ-lectura', codigo: 'P17-EDU-LECTURA', nombre: 'Lectura y comprensión en escuelas rurales', eje: 'Educación', caserio: 'Monchacap' },
  { id: 'proy-educ-becas', codigo: 'P18-EDU-BECAS', nombre: 'Acompañamiento educativo y continuidad escolar', eje: 'Educación', caserio: 'Bella Aurora' },
  { id: 'proy-educ-materiales', codigo: 'P19-EDU-MATERIALES', nombre: 'Acceso a materiales para aprendizaje', eje: 'Educación', caserio: 'Shorey Chico' },
  { id: 'proy-educ-docentes', codigo: 'P20-EDU-DOCENTES', nombre: 'Fortalecimiento de capacidades docentes', eje: 'Educación', caserio: 'Nuevo Progreso' },
  { id: 'proy-educ-digital', codigo: 'P21-EDU-DIGITAL', nombre: 'Recursos digitales para educación rural', eje: 'Educación', caserio: 'Tayabamba' },
  { id: 'proy-agua-potable', codigo: 'P22-AGUA-POTABLE', nombre: 'Mejoramiento del acceso a agua segura', eje: 'Agua y saneamiento', caserio: 'La Soledad' },
  { id: 'proy-agua-jass', codigo: 'P23-AGUA-JASS', nombre: 'Fortalecimiento de juntas administradoras de agua', eje: 'Agua y saneamiento', caserio: 'Cerro Grande' },
  { id: 'proy-agua-saneamiento', codigo: 'P24-AGUA-SANEAMIENTO', nombre: 'Educación sanitaria y saneamiento familiar', eje: 'Agua y saneamiento', caserio: 'Huaylillas' },
  { id: 'proy-agua-cloracion', codigo: 'P25-AGUA-CLORACION', nombre: 'Vigilancia de calidad y cloración de agua', eje: 'Agua y saneamiento', caserio: 'Shiracmaca' },
  { id: 'proy-agua-mantenimiento', codigo: 'P26-AGUA-MANTENIMIENTO', nombre: 'Mantenimiento de sistemas de agua rural', eje: 'Agua y saneamiento', caserio: 'San Fernando' },
  { id: 'proy-agua-higiene', codigo: 'P27-AGUA-HIGIENE', nombre: 'Prácticas saludables de higiene y manejo de residuos', eje: 'Agua y saneamiento', caserio: 'Caserío El Pozo' },
];

function createEmptyState(): BrowserDatabaseState {
  return {
    almacenes: [],
    insumos: [],
    proyectos: [],
    movimientos: [],
    fichas: [],
    ordenes: [],
    decisiones: [],
    syncLogs: [],
  };
}

function readStoredState(): BrowserDatabaseState | null {
  if (typeof window === 'undefined') {
    return memoryFallback;
  }
  let serialized: string | null;
  try {
    serialized = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('localStorage no está disponible; se utilizará almacenamiento en memoria.', error);
    return memoryFallback;
  }
  if (!serialized) {
    return memoryFallback;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Los datos locales del navegador no son válidos: ${String(error)}`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as BrowserDatabaseState).almacenes) ||
    !Array.isArray((parsed as BrowserDatabaseState).insumos) ||
    !Array.isArray((parsed as BrowserDatabaseState).proyectos) ||
    !Array.isArray((parsed as BrowserDatabaseState).movimientos) ||
    !Array.isArray((parsed as BrowserDatabaseState).fichas) ||
    !Array.isArray((parsed as BrowserDatabaseState).ordenes) ||
    !Array.isArray((parsed as BrowserDatabaseState).decisiones) ||
    !Array.isArray((parsed as BrowserDatabaseState).syncLogs)
  ) {
    throw new Error('Los datos locales del navegador tienen una estructura no compatible.');
  }
  const storedState = parsed as BrowserDatabaseState;
  storedState.movimientos = storedState.movimientos.map((movement) => ({
    ...movement,
    cantidadEntregada: movement.cantidadEntregada ?? null,
    diferenciaEntrega: Number.isFinite(movement.diferenciaEntrega) ? movement.diferenciaEntrega : 0,
    estadoConformidadEntrega: movement.estadoConformidadEntrega
      ?? 'PENDIENTE',
    motivoDiferencia: movement.motivoDiferencia ?? null,
    observacionEntrega: movement.observacionEntrega ?? null,
  }));
  return storedState;
}

function getState(): BrowserDatabaseState {
  if (!stateCache) {
    throw new Error('La base local web no se ha inicializado.');
  }
  return stateCache;
}

function persistState(): void {
  const state = getState();
  memoryFallback = state;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('No se pudo persistir en localStorage; los cambios se conservarán en memoria durante esta sesión.', error);
  }
}

function getInventoryItem(id: string): InventoryItem | undefined {
  return getState().insumos.find((item) => item.id === id);
}

function getProject(id: string): ProyectoCampo | undefined {
  return getState().proyectos.find((project) => project.id === id);
}

function getWarehouse(id: string): Almacen | undefined {
  return getState().almacenes.find((warehouse) => warehouse.id === id);
}

function getMovement(id: string): WarehouseMovementRecord | undefined {
  return getState().movimientos.find((movement) => movement.id === id);
}

function createMovementRecord(
  input: Omit<WarehouseMovementRecord, 'insumoCodigo' | 'insumoNombre' | 'insumoUnidad' | 'almacenId' | 'almacenNombre'>,
  item: InventoryItem,
): WarehouseMovementRecord {
  return {
    ...input,
    insumoCodigo: item.codigo,
    insumoNombre: item.nombre,
    insumoUnidad: item.unidad,
    almacenId: item.almacenId,
    almacenNombre: item.almacenNombre,
  };
}

function validateOrderItems(items: OrdenCompraItem[]): OrdenCompraItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('La orden debe incluir al menos un insumo.');
  }
  return items.map((item) => {
    if (
      !(item.insumoId === null || typeof item.insumoId === 'string') ||
      typeof item.nombre !== 'string' ||
      !item.nombre.trim() ||
      typeof item.unidad !== 'string' ||
      !item.unidad.trim() ||
      !Number.isFinite(item.cantidad) ||
      item.cantidad <= 0
    ) {
      throw new Error('La orden contiene datos de insumo inválidos.');
    }
    return {
      insumoId: item.insumoId,
      nombre: item.nombre.trim(),
      unidad: item.unidad.trim(),
      cantidad: item.cantidad,
    };
  });
}

function getRequestedQuantity(insumoId: string): number {
  return getState().ordenes
    .filter((order) => order.estado === 'PENDIENTE' || order.estado === 'APROBADA')
    .flatMap((order) => order.items)
    .filter((item) => item.insumoId === insumoId)
    .reduce((sum, item) => sum + item.cantidad, 0);
}

export async function initDatabase(): Promise<void> {
  stateCache = readStoredState() ?? createEmptyState();
  await seedInitialData();
}

export async function seedInitialData(): Promise<void> {
  const state = getState();
  for (const warehouse of SEED_WAREHOUSES) {
    if (!state.almacenes.some((entry) => entry.id === warehouse.id)) {
      state.almacenes.push({ ...warehouse });
    }
  }
  for (const item of SEED_INVENTORY) {
    if (!state.insumos.some((entry) => entry.id === item.id)) {
      const { seedStock, seedMinimum, ...inventoryItem } = item;
      state.insumos.push({ ...inventoryItem, stockActual: seedStock, stockMinimo: seedMinimum });
    }
  }
  for (const project of SEED_PROJECTS) {
    if (!state.proyectos.some((entry) => entry.id === project.id)) {
      state.proyectos.push({ ...project });
    }
  }

  const seededAt = new Date().toISOString();
  if (!state.movimientos.some((movement) => movement.id === 'mov-seed-donacion-palta')) {
    const item = getInventoryItem('ins-palta-lavasen');
    if (item) {
      state.movimientos.push(createMovementRecord({
        id: 'mov-seed-donacion-palta',
        tipo: 'ENTRADA',
        origen: 'DONACION',
        insumoId: item.id,
        cantidad: 75,
        responsable: 'Registro de donación institucional',
        destinoCaserio: null,
        timestamp: seededAt,
        syncStatus: 'SYNCED',
        receptorNombre: null,
        receptorDni: null,
        receptorCargo: null,
        latitud: null,
        longitud: null,
        fotoUri: null,
        firmaSvgPaths: null,
        hashSha256: null,
        codigoEnvio: null,
        estadoEnvio: null,
        historialTrackingJson: null,
        cantidadEntregada: null,
        diferenciaEntrega: 0,
        estadoConformidadEntrega: 'PENDIENTE',
        motivoDiferencia: null,
        observacionEntrega: null,
      }, item));
    }
  }

  const seedOrders: {
    id: string;
    codigoOrden: string;
    proyectoId: string;
    proyectoNombre: string;
    almacenDestinoId: string;
    justificacion: string;
    prioridad: OrdenCompra['prioridad'];
    estado: EstadoOrdenCompra;
    items: OrdenCompraItem[];
    aprobadoPorNombre: string | null;
    fechaRevision: string | null;
    observacionRevision: string | null;
  }[] = [
    {
      id: 'oc-seed-agua-001', codigoOrden: 'OC-2026-001', proyectoId: 'proy-agua-potable',
      proyectoNombre: 'Mejoramiento del acceso a agua segura', almacenDestinoId: 'alm-maranon',
      justificacion: 'Reposición de materiales para ampliar la cobertura de agua segura en el proyecto.',
      prioridad: 'ALTA', estado: 'PENDIENTE',
      items: [
        { insumoId: 'ins-kit-agua-maranon', nombre: 'Kit de herramientas para agua y saneamiento', cantidad: 4, unidad: 'kit' },
        { insumoId: null, nombre: 'Tubería PVC de 1 pulgada', cantidad: 120, unidad: 'metro' },
      ],
      aprobadoPorNombre: null, fechaRevision: null, observacionRevision: null,
    },
    {
      id: 'oc-seed-agua-002', codigoOrden: 'OC-2026-002', proyectoId: 'proy-agua-saneamiento',
      proyectoNombre: 'Educación sanitaria y saneamiento familiar', almacenDestinoId: 'alm-pataz',
      justificacion: 'Materiales para las jornadas comunitarias de educación sanitaria.',
      prioridad: 'NORMAL', estado: 'APROBADA',
      items: [{ insumoId: 'ins-kit-pataz', nombre: 'Kit escolar básico', cantidad: 12, unidad: 'kit' }],
      aprobadoPorNombre: 'Rosa Elena Castillo Díaz', fechaRevision: seededAt,
      observacionRevision: 'Aprobada para despacho según disponibilidad.',
    },
    {
      id: 'oc-seed-desbalance-003', codigoOrden: 'OC-2026-003', proyectoId: 'proy-agua-jass',
      proyectoNombre: 'Fortalecimiento de juntas administradoras de agua', almacenDestinoId: 'alm-lavasen',
      justificacion: 'Reposición prioritaria de botiquines para brigadas comunitarias.',
      prioridad: 'ALTA', estado: 'PENDIENTE',
      items: [{ insumoId: 'ins-botiquin-lavasen', nombre: 'Botiquín de primeros auxilios', cantidad: 32, unidad: 'unidad' }],
      aprobadoPorNombre: null, fechaRevision: null, observacionRevision: null,
    },
    {
      id: 'oc-seed-desbalance-004', codigoOrden: 'OC-2026-004', proyectoId: 'proy-salud-anemia',
      proyectoNombre: 'Prevención de anemia infantil', almacenDestinoId: 'alm-pataz',
      justificacion: 'Cobertura de suplementación para las próximas jornadas de salud.',
      prioridad: 'URGENTE', estado: 'PENDIENTE',
      items: [{ insumoId: 'ins-sulfato-pataz', nombre: 'Sulfato ferroso (suplemento contra anemia)', cantidad: 28, unidad: 'frasco' }],
      aprobadoPorNombre: null, fechaRevision: null, observacionRevision: null,
    },
    {
      id: 'oc-seed-desbalance-005', codigoOrden: 'OC-2026-005', proyectoId: 'proy-agri-frutales',
      proyectoNombre: 'Instalación de frutales altoandinos', almacenDestinoId: 'alm-lavasen',
      justificacion: 'Asignación de plantones para las parcelas demostrativas.',
      prioridad: 'NORMAL', estado: 'APROBADA',
      items: [{ insumoId: 'ins-palta-lavasen', nombre: 'Plantones de palta Hass', cantidad: 20, unidad: 'plantón' }],
      aprobadoPorNombre: 'Rosa Elena Castillo Díaz', fechaRevision: seededAt,
      observacionRevision: 'Aprobada para asignación a las parcelas demostrativas.',
    },
  ];

  for (const seed of seedOrders) {
    if (!state.ordenes.some((order) => order.id === seed.id)) {
      const warehouse = getWarehouse(seed.almacenDestinoId);
      if (warehouse) {
        state.ordenes.push({
          ...seed,
          almacenDestinoNombre: warehouse.nombre,
          solicitanteId: 'pataz-monitoreo-02',
          solicitanteNombre: 'José Luis Sánchez Vega',
          items: seed.items.map((item) => ({ ...item })),
          fechaSolicitud: seededAt,
          fechaAtendida: null,
          fechaActualizacion: seededAt,
          syncStatus: 'PENDING',
        });
      }
    }
  }
  persistState();
}

export async function getPendingRecordCount(): Promise<number> {
  const state = getState();
  return state.movimientos.filter((item) => item.syncStatus !== 'SYNCED').length
    + state.fichas.filter((item) => item.syncStatus !== 'SYNCED').length
    + state.ordenes.filter((item) => item.syncStatus === 'PENDING').length;
}

export async function getProjectCount(): Promise<number> {
  return getState().proyectos.length;
}

export async function getPendingSyncPackages(limit = 20): Promise<PendingSyncPackage[]> {
  const state = getState();
  const entries: PendingSyncPackage[] = [
    ...state.movimientos
      .filter((item) => item.syncStatus !== 'SYNCED')
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        entityType: 'MOVIMIENTO_ALMACEN' as const,
        endpoint: '/api/v1/sisgeap/movimientos',
      })),
    ...state.fichas
      .filter((item) => item.syncStatus !== 'SYNCED')
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        entityType: 'FICHA_CAMPO' as const,
        endpoint: '/api/v1/sisgeap/fichas-campo',
      })),
    ...state.ordenes
      .filter((item) => item.syncStatus === 'PENDING')
      .map((item) => ({
        id: item.id,
        timestamp: item.fechaActualizacion,
        entityType: 'ORDEN_COMPRA' as const,
        endpoint: '/api/v1/sisgeap/ordenes-compra',
      })),
  ];
  return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, limit);
}

export async function completeSyncPackage(item: PendingSyncPackage): Promise<void> {
  const state = getState();
  const row = item.entityType === 'MOVIMIENTO_ALMACEN'
    ? state.movimientos.find((entry) => entry.id === item.id)
    : item.entityType === 'FICHA_CAMPO'
      ? state.fichas.find((entry) => entry.id === item.id)
      : state.ordenes.find((entry) => entry.id === item.id);
  if (!row) {
    throw new Error('El registro de sincronización ya no existe en la base local.');
  }
  row.syncStatus = 'SYNCED';
  state.syncLogs.unshift({
    id: Crypto.randomUUID(),
    entityType: item.entityType,
    entityId: item.id,
    syncStatus: 'SUCCESS',
    message: 'Paquete aceptado por el gateway simulado SISGEAP.',
    timestamp: new Date().toISOString(),
    endpoint: item.endpoint,
  });
  persistState();
}

export async function getSyncDashboardData(): Promise<SyncDashboardData> {
  const state = getState();
  const movements = state.movimientos.filter((item) => item.syncStatus !== 'SYNCED');
  const fichas = state.fichas.filter((item) => item.syncStatus !== 'SYNCED');
  const orders = state.ordenes.filter((item) => item.syncStatus === 'PENDING');
  const queue: SyncQueueEntry[] = [
    ...movements.map((item) => ({
      id: item.id,
      entityType: 'MOVIMIENTO_ALMACEN' as const,
      title: item.tipo === 'ENTRADA'
        ? `Entrada · ${item.origen === 'DONACION' ? 'Donación' : item.origen === 'COMPRA' ? 'Compra' : 'Sin origen'}`
        : `Salida · ${item.destinoCaserio ?? 'Sin destino'}`,
      detail: `${item.insumoNombre} · ${item.almacenNombre} · Responsable: ${item.responsable}`,
      timestamp: item.timestamp,
      syncStatus: item.syncStatus,
    })),
    ...fichas.map((item) => {
      const project = getProject(item.proyectoId);
      return {
        id: item.id,
        entityType: 'FICHA_CAMPO' as const,
        title: `Ficha de campo · ${project?.codigo ?? 'Proyecto'}`,
        detail: `${project?.nombre ?? 'Proyecto'} · ${item.beneficiarioNombre} · ${project?.caserio ?? ''}`,
        timestamp: item.timestamp,
        syncStatus: item.syncStatus,
      };
    }),
    ...orders.map((item) => ({
      id: item.id,
      entityType: 'ORDEN_COMPRA' as const,
      title: `Orden de compra · ${item.codigoOrden}`,
      detail: `${item.proyectoNombre} · ${item.almacenDestinoNombre} · ${item.estado}`,
      timestamp: item.fechaActualizacion,
      syncStatus: item.syncStatus,
    })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {
    pendingMovementCount: movements.length,
    pendingFieldCount: fichas.length,
    pendingOrderCount: orders.length,
    pendingApprovalOrderCount: state.ordenes.filter((item) => item.estado === 'PENDIENTE').length,
    queue,
  };
}

export async function getPurchaseOrders(status?: EstadoOrdenCompra): Promise<OrdenCompra[]> {
  return getState().ordenes
    .filter((order) => !status || order.estado === status)
    .slice()
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud) || b.codigoOrden.localeCompare(a.codigoOrden));
}

export async function getPurchaseOrder(id: string): Promise<OrdenCompra | null> {
  return getState().ordenes.find((order) => order.id === id) ?? null;
}

export async function createPurchaseOrder(
  input: NuevaOrdenCompraInput,
  actor: OrderActor,
): Promise<OrdenCompra> {
  if (actor.roleKey !== 'CAMPO') {
    throw new Error('Solo el personal de Campo puede crear requerimientos de compra.');
  }
  const justification = input.justificacion.trim();
  const items = validateOrderItems(input.items);
  if (justification.length < 10) {
    throw new Error('La justificación técnica debe incluir al menos 10 caracteres.');
  }
  if (!ORDER_PRIORITIES.includes(input.prioridad)) {
    throw new Error('Selecciona una prioridad válida.');
  }
  const state = getState();
  const project = getProject(input.proyectoId);
  const warehouse = getWarehouse(input.almacenDestinoId);
  if (!project || !warehouse) {
    throw new Error('Selecciona un proyecto y un almacén existentes.');
  }
  for (const requested of items) {
    if (requested.insumoId) {
      const item = getInventoryItem(requested.insumoId);
      if (!item) {
        throw new Error(`El insumo ${requested.nombre} ya no existe en el catálogo local.`);
      }
      if (item.nombre !== requested.nombre || item.unidad !== requested.unidad) {
        throw new Error('Los datos del insumo seleccionado ya no coinciden con el catálogo local.');
      }
    }
  }
  const year = new Date().getFullYear();
  const latest = state.ordenes
    .map((order) => order.codigoOrden)
    .filter((code) => code.startsWith(`OC-${year}-`))
    .sort()
    .pop();
  const sequence = latest ? Number(latest.split('-').pop()) + 1 : 1;
  const timestamp = new Date().toISOString();
  const order: OrdenCompra = {
    id: Crypto.randomUUID(),
    codigoOrden: `OC-${year}-${String(sequence).padStart(3, '0')}`,
    proyectoId: project.id,
    proyectoNombre: project.nombre,
    almacenDestinoId: warehouse.id,
    almacenDestinoNombre: warehouse.nombre,
    solicitanteId: actor.id,
    solicitanteNombre: actor.nombreCompleto,
    justificacion: justification,
    prioridad: input.prioridad,
    estado: 'PENDIENTE',
    items,
    fechaSolicitud: timestamp,
    aprobadoPorNombre: null,
    fechaRevision: null,
    observacionRevision: null,
    fechaAtendida: null,
    fechaActualizacion: timestamp,
    syncStatus: 'PENDING',
  };
  state.ordenes.unshift(order);
  persistState();
  return order;
}

export async function reviewPurchaseOrder(
  orderId: string,
  decision: 'APROBADA' | 'RECHAZADA',
  observation: string,
  actor: OrderActor,
): Promise<void> {
  if (actor.roleKey !== 'ADMIN') {
    throw new Error('Solo Administración puede aprobar o rechazar órdenes.');
  }
  const order = getState().ordenes.find((item) => item.id === orderId && item.estado === 'PENDIENTE');
  if (!order) {
    throw new Error('La orden ya no está pendiente o no existe.');
  }
  const timestamp = new Date().toISOString();
  order.estado = decision;
  order.aprobadoPorNombre = actor.nombreCompleto;
  order.fechaRevision = timestamp;
  order.observacionRevision = observation.trim() || null;
  order.fechaActualizacion = timestamp;
  order.syncStatus = 'PENDING';
  persistState();
}

export async function markPurchaseOrderAttended(orderId: string, actor: OrderActor): Promise<void> {
  if (actor.roleKey !== 'CAMPO' && actor.roleKey !== 'LOGISTICA') {
    throw new Error('Solo Campo o Logística pueden confirmar una orden atendida.');
  }
  const order = getState().ordenes.find((item) => item.id === orderId && item.estado === 'APROBADA');
  if (!order) {
    throw new Error('Solo se puede atender una orden aprobada que aún no haya sido procesada.');
  }
  const timestamp = new Date().toISOString();
  order.estado = 'ATENDIDA';
  order.fechaAtendida = timestamp;
  order.fechaActualizacion = timestamp;
  order.syncStatus = 'PENDING';
  persistState();
}

export async function getProjectSummaries(): Promise<ProyectoCampoResumen[]> {
  const state = getState();
  return state.proyectos
    .map((project) => {
      const fichas = state.fichas.filter((form) => form.proyectoId === project.id);
      return {
        ...project,
        totalFichas: fichas.length,
        pendientesSync: fichas.filter((form) => form.syncStatus === 'PENDING').length,
        erroresSync: fichas.filter((form) => form.syncStatus === 'ERROR').length,
        fichasSincronizadas: fichas.filter((form) => form.syncStatus === 'SYNCED').length,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function approveManagerialDecision(
  input: AprobarDecisionGerencialInput,
  actor: DecisionActor,
): Promise<DecisionGerencial> {
  if (actor.roleKey !== 'ADMIN') {
    throw new Error('Se requiere perfil de Gerencia/Administración para aprobar esta decisión.');
  }
  const title = input.titulo.trim();
  const detail = input.detalle.trim();
  const destination = input.caserioOProyectoDestino?.trim() ?? '';
  if (!title || detail.length < 8 || !destination) {
    throw new Error('Completa el título, la resolución y el destino de la decisión.');
  }
  const requiresInventory = input.tipo === 'NUEVO_PROYECTO_DONACION'
    || input.tipo === 'ABASTECIMIENTO_DESBALANCE';
  if (
    requiresInventory &&
    (!input.insumoId || !input.insumoRelacionado?.trim()
      || !Number.isFinite(input.cantidadInvolucrada)
      || input.cantidadInvolucrada === null || input.cantidadInvolucrada <= 0)
  ) {
    throw new Error('La decisión requiere un insumo y una cantidad válida.');
  }
  if (input.tipo === 'NUEVO_PROYECTO_DONACION') {
    const project = input.nuevoProyecto;
    if (!project || project.nombre.trim().length < 4 || project.caserio.trim().length < 2) {
      throw new Error('Completa el nombre del proyecto y el caserío de intervención.');
    }
  } else if (input.tipo === 'REDISTRIBUCION_STOCK') {
    throw new Error('La resolución de redistribución aún no está habilitada.');
  }

  const state = getState();
  const now = new Date().toISOString();
  if (requiresInventory && input.insumoId && input.cantidadInvolucrada !== null) {
    const item = getInventoryItem(input.insumoId);
    if (!item) {
      throw new Error('El insumo relacionado ya no existe en el inventario.');
    }
    const difference = item.stockActual - getRequestedQuantity(item.id);
    if (input.tipo === 'NUEVO_PROYECTO_DONACION') {
      if (difference <= item.stockMinimo * 1.5) {
        throw new Error('El insumo ya no tiene un excedente significativo disponible.');
      }
      const donation = state.movimientos
        .filter((movement) => movement.insumoId === item.id)
        .reduce((total, movement) => ({
          donated: total.donated + (movement.tipo === 'ENTRADA' && movement.origen === 'DONACION' ? movement.cantidad : 0),
          dispatched: total.dispatched + (movement.tipo === 'SALIDA' ? movement.cantidad : 0),
        }), { donated: 0, dispatched: 0 });
      const donationBalance = Math.max(0, donation.donated - donation.dispatched);
      if (input.cantidadInvolucrada > Math.min(difference, donationBalance)) {
        throw new Error('La cantidad supera el excedente donado que permanece disponible.');
      }
      const project = input.nuevoProyecto;
      if (!project) {
        throw new Error('No se recibieron los datos del nuevo proyecto.');
      }
      const year = new Date(now).getUTCFullYear();
      const prefix = `GER-${year}-`;
      const sequence = state.proyectos
        .filter((entry) => entry.codigo.startsWith(prefix))
        .map((entry) => Number(entry.codigo.slice(prefix.length)))
        .reduce((max, value) => Math.max(max, Number.isFinite(value) ? value : 0), 0) + 1;
      state.proyectos.push({
        id: Crypto.randomUUID(),
        codigo: `${prefix}${String(sequence).padStart(3, '0')}`,
        nombre: project.nombre.trim(),
        eje: project.eje,
        caserio: project.caserio.trim(),
      });
    } else if (difference >= 0 || input.cantidadInvolucrada > Math.abs(difference)) {
      throw new Error('El déficit cambió; actualiza el indicador antes de aprobar la compra.');
    }
  }
  const decision: DecisionGerencial = {
    id: Crypto.randomUUID(),
    tipo: input.tipo,
    titulo: title,
    detalle: detail,
    insumoRelacionado: input.insumoRelacionado,
    cantidadInvolucrada: input.cantidadInvolucrada,
    caserioOProyectoDestino: destination,
    decididoPorNombre: actor.nombreCompleto,
    fechaHora: now,
    estado: 'APROBADA',
  };
  state.decisiones.unshift(decision);
  persistState();
  return decision;
}

export async function insertFichaCampo(input: NuevaFichaCampo): Promise<void> {
  const dni = input.beneficiarioDni.trim();
  const nombre = input.beneficiarioNombre.trim();
  const activity = input.actividadRealizada.trim();
  if (!/^\d{8}$/.test(dni)) {
    throw new Error('El DNI debe contener exactamente 8 dígitos.');
  }
  if (nombre.length < 3) {
    throw new Error('Ingresa el nombre completo del beneficiario.');
  }
  if (!activity) {
    throw new Error('Selecciona la actividad o asistencia realizada.');
  }
  if ((input.latitud !== null) !== (input.longitud !== null)) {
    throw new Error('Las coordenadas deben incluir latitud y longitud.');
  }
  if (
    (input.latitud !== null && (!Number.isFinite(input.latitud) || input.latitud < -90 || input.latitud > 90))
    || (input.longitud !== null && (!Number.isFinite(input.longitud) || input.longitud < -180 || input.longitud > 180))
  ) {
    throw new Error('Las coordenadas GPS están fuera de rango.');
  }
  if (!getProject(input.proyectoId)) {
    throw new Error('El proyecto seleccionado no existe en la base local.');
  }
  getState().fichas.unshift({
    id: Crypto.randomUUID(),
    proyectoId: input.proyectoId,
    beneficiarioDni: dni,
    beneficiarioNombre: nombre,
    actividadRealizada: activity,
    observaciones: input.observaciones.trim(),
    latitud: input.latitud,
    longitud: input.longitud,
    timestamp: new Date().toISOString(),
    syncStatus: 'PENDING',
  });
  persistState();
}

export async function getWarehouses(): Promise<Almacen[]> {
  return getState().almacenes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getWarehouseStatusSummaries(): Promise<WarehouseStatusSummary[]> {
  const state = getState();
  return state.almacenes.map((warehouse) => {
    const inventory = state.insumos.filter((item) => item.almacenId === warehouse.id);
    return {
      ...warehouse,
      itemCount: inventory.length,
      lowStockCount: inventory.filter((item) => item.stockActual <= item.stockMinimo).length,
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getRecentActivities(limit = 6): Promise<RecentActivity[]> {
  const state = getState();
  const movements = state.movimientos.map((movement) => ({
    id: movement.id,
    entityType: 'MOVIMIENTO_ALMACEN' as const,
    title: movement.tipo === 'ENTRADA' ? 'Entrada registrada' : 'Salida registrada',
    detail: `${movement.insumoNombre} · ${movement.almacenNombre}`,
    timestamp: movement.timestamp,
    syncStatus: movement.syncStatus,
    hasActa: movement.hashSha256 ? 1 : 0,
    codigoEnvio: movement.codigoEnvio,
    estadoEnvio: movement.estadoEnvio,
    estadoConformidadEntrega: movement.estadoConformidadEntrega,
    diferenciaEntrega: movement.diferenciaEntrega,
  }));
  const fieldForms = state.fichas.flatMap((form) => {
    const project = getProject(form.proyectoId);
    return project ? [{
      id: form.id,
      entityType: 'FICHA_CAMPO' as const,
      title: 'Ficha de campo registrada',
      detail: `${form.beneficiarioNombre} · ${project.nombre}`,
      timestamp: form.timestamp,
      syncStatus: form.syncStatus,
      hasActa: 0,
      codigoEnvio: null,
      estadoEnvio: null,
      estadoConformidadEntrega: null,
      diferenciaEntrega: null,
    }] : [];
  });
  return [...movements, ...fieldForms]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function getShipmentStatusCounts(): Promise<ShipmentStatusCounts> {
  const movements = getState().movimientos;
  return {
    inTransit: movements.filter((item) => item.estadoEnvio === 'EN_TRANSITO').length,
    delivered: movements.filter((item) => item.estadoEnvio === 'ENTREGADO').length,
  };
}

export async function getInTransitShipments(limit = 5): Promise<WarehouseMovementRecord[]> {
  return getState().movimientos
    .filter((item) => item.tipo === 'SALIDA' && item.estadoEnvio === 'EN_TRANSITO')
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function getIncompleteDeliveryShipments(
  limit = 100,
): Promise<WarehouseMovementRecord[]> {
  return getState().movimientos
    .filter((movement) => movement.tipo === 'SALIDA'
      && movement.estadoConformidadEntrega === 'PARCIAL_CON_OBSERVACION')
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function getDonationMovementSummaries(): Promise<DonationMovementSummary[]> {
  const grouped = new Map<string, DonationMovementSummary>();
  for (const movement of getState().movimientos) {
    const summary = grouped.get(movement.insumoId) ?? {
      insumoId: movement.insumoId,
      quantityDonated: 0,
      quantityDispatched: 0,
    };
    if (movement.tipo === 'ENTRADA' && movement.origen === 'DONACION') {
      summary.quantityDonated += movement.cantidad;
    }
    if (movement.tipo === 'SALIDA') {
      summary.quantityDispatched += movement.cantidad;
    }
    grouped.set(movement.insumoId, summary);
  }
  return [...grouped.values()].filter((item) => item.quantityDonated > 0);
}

export async function getRecentManagerialDecisions(limit = 5): Promise<DecisionGerencial[]> {
  return getState().decisiones.slice()
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))
    .slice(0, limit);
}

export async function getRecentSyncLogs(limit = 8): Promise<SyncLog[]> {
  return getState().syncLogs.slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

async function getInventoryItems(warehouseId?: string): Promise<InventoryItem[]> {
  return getState().insumos
    .filter((item) => !warehouseId || item.almacenId === warehouseId)
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getInventoryByWarehouse(warehouseId: string): Promise<InventoryItem[]> {
  return getInventoryItems(warehouseId);
}

export async function getRecentWarehouseMovements(
  warehouseId: string,
  limit = 8,
): Promise<WarehouseMovementRecord[]> {
  return getState().movimientos
    .filter((movement) => movement.almacenId === warehouseId)
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  return getInventoryItems();
}

export async function findInventoryItemByCode(code: string): Promise<InventoryItem | null> {
  const normalized = code.trim();
  return getState().insumos.find((item) => item.codigo === normalized || item.id === normalized) ?? null;
}

export async function registerWarehouseMovement(
  input: RegisterWarehouseMovementInput,
): Promise<WarehouseMovementRecord> {
  const responsible = input.responsable.trim();
  const destination = input.destinoCaserio.trim();
  const evidence = input.evidencia;
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new Error('La cantidad debe ser un número mayor que cero.');
  }
  if (!responsible) {
    throw new Error('Ingresa el nombre del responsable.');
  }
  if (input.tipo === 'SALIDA' && !destination) {
    throw new Error('Indica el caserío o proyecto de destino para registrar una salida.');
  }
  if (input.tipo === 'ENTRADA' && !input.origen) {
    throw new Error('Selecciona si la entrada corresponde a una compra o donación.');
  }
  if (input.tipo === 'SALIDA') {
    if (!evidence) {
      throw new Error('Completa la evidencia fiduciaria de la salida.');
    }
    if (!evidence.receptorNombre.trim() || !evidence.receptorCargo.trim()) {
      throw new Error('Completa el nombre y el cargo u organización del receptor.');
    }
    if (!/^\d{8}$/.test(evidence.receptorDni.trim())) {
      throw new Error('El DNI del receptor debe contener exactamente 8 dígitos.');
    }
    if (!evidence.firmaSvgPaths || !parseSignaturePaths(evidence.firmaSvgPaths)) {
      throw new Error('Registra la firma del representante antes de guardar la salida.');
    }
    if ((evidence.latitud === null) !== (evidence.longitud === null)) {
      throw new Error('Las coordenadas deben incluir latitud y longitud.');
    }
    if (
      (evidence.latitud !== null && (!Number.isFinite(evidence.latitud) || evidence.latitud < -90 || evidence.latitud > 90))
      || (evidence.longitud !== null && (!Number.isFinite(evidence.longitud) || evidence.longitud < -180 || evidence.longitud > 180))
    ) {
      throw new Error('Las coordenadas GPS están fuera de rango.');
    }
  }
  const state = getState();
  const item = getInventoryItem(input.insumoId);
  if (!item) {
    throw new Error('El insumo seleccionado ya no existe en el inventario local.');
  }
  const newStock = input.tipo === 'ENTRADA'
    ? item.stockActual + input.cantidad
    : item.stockActual - input.cantidad;
  if (newStock < 0) {
    throw new Error('Stock insuficiente para completar esta salida.');
  }
  const id = Crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const firmaSvgPaths = input.tipo === 'SALIDA' ? evidence?.firmaSvgPaths ?? null : null;
  const hashSha256 = input.tipo === 'SALIDA' && evidence && firmaSvgPaths
    ? await createPassportHash({
      id,
      insumoCodigo: item.codigo,
      cantidad: input.cantidad,
      almacenId: item.almacenId,
      receptorDni: evidence.receptorDni.trim(),
      latitud: evidence.latitud,
      longitud: evidence.longitud,
      timestamp,
      firmaSvgPaths,
    })
    : null;
  let codigoEnvio: string | null = null;
  let estadoEnvio: EstadoEnvio | null = null;
  let historialTrackingJson: string | null = null;
  if (input.tipo === 'SALIDA') {
    const year = new Date(timestamp).getUTCFullYear();
    const latestSequence = state.movimientos
      .filter((movement) => movement.codigoEnvio?.startsWith(`SHL-${year}-`))
      .map((movement) => Number(movement.codigoEnvio?.split('-').pop()))
      .reduce((max, sequence) => Math.max(max, Number.isFinite(sequence) ? sequence : 0), 0);
    codigoEnvio = `SHL-${year}-${String(latestSequence + 1).padStart(3, '0')}`;
    estadoEnvio = 'REGISTRADO_ALMACEN';
    const firstMilestone: HitoTracking = {
      estado: estadoEnvio,
      titulo: 'Registrado en Almacén',
      descripcion: 'Envío registrado y preparado para despacho.',
      fechaHora: timestamp,
      responsable: responsible,
    };
    historialTrackingJson = JSON.stringify([firstMilestone]);
  }
  const record = createMovementRecord({
    id,
    tipo: input.tipo,
    origen: input.origen,
    insumoId: item.id,
    cantidad: input.cantidad,
    responsable: responsible,
    destinoCaserio: destination || null,
    timestamp,
    syncStatus: 'PENDING',
    receptorNombre: input.tipo === 'SALIDA' ? evidence?.receptorNombre.trim() ?? null : null,
    receptorDni: input.tipo === 'SALIDA' ? evidence?.receptorDni.trim() ?? null : null,
    receptorCargo: input.tipo === 'SALIDA' ? evidence?.receptorCargo.trim() ?? null : null,
    latitud: input.tipo === 'SALIDA' ? evidence?.latitud ?? null : null,
    longitud: input.tipo === 'SALIDA' ? evidence?.longitud ?? null : null,
    fotoUri: input.tipo === 'SALIDA' ? evidence?.fotoUri ?? null : null,
    firmaSvgPaths,
    hashSha256,
    codigoEnvio,
    estadoEnvio,
    historialTrackingJson,
    cantidadEntregada: null,
    diferenciaEntrega: 0,
    estadoConformidadEntrega: 'PENDIENTE',
    motivoDiferencia: null,
    observacionEntrega: null,
  }, item);
  item.stockActual = newStock;
  state.movimientos.unshift(record);
  persistState();
  return record;
}

export async function getWarehouseMovementDetails(
  movementId: string,
): Promise<WarehouseMovementRecord | null> {
  return getMovement(movementId) ?? null;
}

export async function advanceShipmentTracking(
  movementId: string,
  note: string,
  actor: TrackingActor,
  delivery?: DeliveryVerificationInput,
): Promise<WarehouseMovementRecord> {
  if (actor.roleKey !== 'ADMIN' && actor.roleKey !== 'LOGISTICA') {
    throw new Error('Solo Administración o Logística puede actualizar el seguimiento.');
  }
  const movement = getMovement(movementId);
  if (!movement || movement.tipo !== 'SALIDA' || !movement.estadoEnvio) {
    throw new Error('El movimiento no tiene un envío disponible para seguimiento.');
  }
  const currentIndex = SHIPMENT_STATES.indexOf(movement.estadoEnvio);
  const nextState = SHIPMENT_STATES[currentIndex + 1];
  if (!nextState) {
    throw new Error('El envío ya figura como entregado.');
  }
  const isFinalDelivery = nextState === 'ENTREGADO';
  const normalizedNote = note.trim();
  if (!isFinalDelivery && !normalizedNote) {
    throw new Error('Agrega una nota de control antes de avanzar el envío.');
  }
  if (normalizedNote.length > 500) {
    throw new Error('La nota de control no puede superar los 500 caracteres.');
  }
  if (isFinalDelivery && !delivery) {
    throw new Error('Verifica la cantidad recibida antes de confirmar la entrega.');
  }
  if (!isFinalDelivery && delivery) {
    throw new Error('La verificación de recepción solo corresponde a la etapa de entrega final.');
  }
  let deliveryDescription = normalizedNote;
  let deliveredAmount: number | null = null;
  let deliveryDifference = 0;
  let deliveryStatus: EstadoConformidadEntrega | null = null;
  let deliveryReason: MotivoDiferenciaEntrega | null = null;
  let deliveryObservation: string | null = null;
  if (isFinalDelivery && delivery) {
    deliveredAmount = delivery.cantidadEntregada;
    if (
      !Number.isFinite(deliveredAmount)
      || deliveredAmount < 0
      || deliveredAmount > movement.cantidad
    ) {
      throw new Error('La cantidad recibida debe estar entre cero y la cantidad despachada.');
    }
    deliveryDifference = deliveredAmount - movement.cantidad;
    if (deliveryDifference === 0) {
      deliveryStatus = 'COMPLETA';
      deliveryDescription =
        `Entrega completa verificada: ${deliveredAmount}/${movement.cantidad} unidades recibidas conformes`;
    } else {
      const validReasons: MotivoDiferenciaEntrega[] = [
        'Daño en ruta / clima',
        'Entrega parcial / fraccionada',
        'Merma operativa',
        'Extravío en tránsito',
        'Otro',
      ];
      const observation = delivery.observacionEntrega?.trim() ?? '';
      if (!delivery.motivoDiferencia || !validReasons.includes(delivery.motivoDiferencia)) {
        throw new Error('Selecciona el motivo de la diferencia de entrega.');
      }
      if (!observation) {
        throw new Error('Agrega una observación para documentar la entrega incompleta.');
      }
      if (observation.length > 1000) {
        throw new Error('La observación de entrega no puede superar los 1000 caracteres.');
      }
      deliveryStatus = 'PARCIAL_CON_OBSERVACION';
      deliveryReason = delivery.motivoDiferencia;
      deliveryObservation = observation;
      deliveryDescription =
        `Entrega parcial verificada: ${deliveredAmount}/${movement.cantidad} unidades recibidas (Faltante: ${deliveryDifference} und. · Motivo: ${delivery.motivoDiferencia}) · Observación: ${observation}`;
    }
  }
  let history: HitoTracking[] = [];
  if (movement.historialTrackingJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(movement.historialTrackingJson);
    } catch {
      throw new Error('El historial de seguimiento guardado no es válido.');
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every((entry) =>
        typeof entry === 'object' && entry !== null &&
        typeof (entry as HitoTracking).estado === 'string' &&
        SHIPMENT_STATES.includes((entry as HitoTracking).estado),
      )
    ) {
      throw new Error('El historial de seguimiento contiene un hito inválido.');
    }
    history = parsed as HitoTracking[];
  }
  const titles: Record<EstadoEnvio, string> = {
    REGISTRADO_ALMACEN: 'Registrado en Almacén',
    EN_TRANSITO: 'En Tránsito',
    EN_PUNTO_ENTREGA: 'En Punto de Entrega',
    ENTREGADO: 'Entregado',
  };
  const updatedAt = new Date().toISOString();
  movement.estadoEnvio = nextState;
  movement.syncStatus = 'PENDING';
  if (isFinalDelivery) {
    movement.cantidadEntregada = deliveredAmount;
    movement.diferenciaEntrega = deliveryDifference;
    movement.estadoConformidadEntrega = deliveryStatus ?? 'PENDIENTE';
    movement.motivoDiferencia = deliveryReason;
    movement.observacionEntrega = deliveryObservation;
  }
  movement.historialTrackingJson = JSON.stringify([...history, {
    estado: nextState,
    titulo: titles[nextState],
    descripcion: deliveryDescription,
    fechaHora: updatedAt,
    responsable: actor.nombreCompleto,
  }]);
  persistState();
  return movement;
}
