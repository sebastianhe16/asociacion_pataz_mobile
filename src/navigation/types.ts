import type { EstadoOrdenCompra } from '../core/types';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  Profile: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Warehouses: {
    initialView?: 'INVENTARIO' | 'ORDENES';
    initialCategoryFilter?: 'Desbalances';
    initialOrderFilter?: EstadoOrdenCompra;
    createOrder?: boolean;
    openMovement?: boolean;
  } | undefined;
  Field: undefined;
  Sync: undefined;
};
