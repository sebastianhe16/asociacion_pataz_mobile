import { PlaceholderLine, PlaceholderScreen } from './PlaceholderScreen';

export default function WarehouseScreen() {
  return (
    <PlaceholderScreen
      title="Almacenes"
      subtitle="Control local de existencias y movimientos con trazabilidad por almacén."
    >
      <PlaceholderLine>Lavasen · Marañón · Pataz</PlaceholderLine>
      <PlaceholderLine>8 insumos de muestra con código QR/barras asignado.</PlaceholderLine>
      <PlaceholderLine>
        Aquí se integrarán las entradas, salidas y el escaneo cuando se construyan las pantallas.
      </PlaceholderLine>
    </PlaceholderScreen>
  );
}
