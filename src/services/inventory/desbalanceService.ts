import {
  getAllInventoryItems,
  getDonationMovementSummaries,
  getPurchaseOrders,
  type InventoryBalance,
} from '../../database/db';

export interface DonationSurplusOpportunity extends InventoryBalance {
  excedenteDonado: number;
}

export async function getInventoryBalances(): Promise<InventoryBalance[]> {
  const [inventory, orders] = await Promise.all([
    getAllInventoryItems(),
    getPurchaseOrders(),
  ]);
  const requestedByItem = new Map<string, number>();

  for (const order of orders) {
    if (order.estado !== 'PENDIENTE' && order.estado !== 'APROBADA') {
      continue;
    }
    for (const item of order.items) {
      if (!item.insumoId) {
        continue;
      }
      requestedByItem.set(
        item.insumoId,
        (requestedByItem.get(item.insumoId) ?? 0) + item.cantidad,
      );
    }
  }

  return inventory.map((item) => {
    const cantidadSolicitada = requestedByItem.get(item.id) ?? 0;
    const diferencia = item.stockActual - cantidadSolicitada;
    const estadoBalance = diferencia < 0
      ? 'DEFICIT'
      : diferencia > item.stockMinimo * 1.5
        ? 'EXCEDENTE'
        : 'EQUILIBRADO';
    return { ...item, cantidadSolicitada, diferencia, estadoBalance };
  });
}

export async function getDonationSurplusOpportunities(
  currentBalances?: InventoryBalance[],
): Promise<DonationSurplusOpportunity[]> {
  const [balances, donationSummaries] = await Promise.all([
    currentBalances ? Promise.resolve(currentBalances) : getInventoryBalances(),
    getDonationMovementSummaries(),
  ]);
  const donationByItem = new Map(
    donationSummaries.map((summary) => [
      summary.insumoId,
      Math.max(0, summary.quantityDonated - summary.quantityDispatched),
    ]),
  );

  return balances.flatMap((item) => {
    if (item.estadoBalance !== 'EXCEDENTE') {
      return [];
    }
    const excedenteDonado = Math.min(
      item.diferencia,
      donationByItem.get(item.id) ?? 0,
    );
    return excedenteDonado > 0 ? [{ ...item, excedenteDonado }] : [];
  });
}
