import * as Crypto from 'expo-crypto';

export interface PassportHashInput {
  id: string;
  insumoCodigo: string;
  cantidad: number;
  almacenId: string;
  receptorDni: string;
  latitud: number | null;
  longitud: number | null;
  timestamp: string;
  firmaSvgPaths: string;
}

export function parseSignaturePaths(serialized: string | null): string[] | null {
  if (!serialized) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(
      (path): path is string =>
        typeof path === 'string' && /^[ML0-9.,\s-]+$/.test(path),
    )
  ) {
    return null;
  }

  return value;
}

export async function createPassportHash(input: PassportHashInput): Promise<string> {
  if (!parseSignaturePaths(input.firmaSvgPaths)) {
    throw new Error('La firma guardada no tiene un formato válido.');
  }

  const canonicalPayload = JSON.stringify([
    input.id,
    input.insumoCodigo,
    input.cantidad,
    input.almacenId,
    input.receptorDni,
    input.latitud,
    input.longitud,
    input.timestamp,
    input.firmaSvgPaths,
  ]);

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonicalPayload,
  );
}
