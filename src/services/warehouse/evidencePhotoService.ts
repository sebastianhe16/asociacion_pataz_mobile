import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const EVIDENCE_DIRECTORY = new Directory(Paths.document, 'delivery-evidence');

function getSafeExtension(...fileNames: (string | null | undefined)[]): string {
  for (const fileName of fileNames) {
    const normalizedName = fileName?.split(/[?#]/, 1)[0];
    const extension = normalizedName?.match(/\.(jpg|jpeg|png|webp|heic)$/i)?.[1]?.toLowerCase();
    if (extension) {
      return `.${extension}`;
    }
  }
  return '.jpg';
}

export async function persistEvidencePhoto(
  sourceUri: string,
  fileName: string | null | undefined,
): Promise<string> {
  EVIDENCE_DIRECTORY.create({ intermediates: true, idempotent: true });
  const extension = getSafeExtension(fileName, sourceUri);
  const destination = new File(EVIDENCE_DIRECTORY, `${Crypto.randomUUID()}${extension}`);
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

export async function readEvidencePhotoAsDataUri(uri: string): Promise<string> {
  const file = new File(uri);
  if (!file.exists) {
    throw new Error('No se encontró el archivo local de la fotografía de entrega.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeType = extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : extension === 'heic'
        ? 'image/heic'
        : 'image/jpeg';
  return `data:${mimeType};base64,${await file.base64()}`;
}
