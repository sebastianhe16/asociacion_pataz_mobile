async function readBlobAsDataUri(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo convertir la fotografía seleccionada.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la fotografía seleccionada.'));
    reader.readAsDataURL(blob);
  });
}

export async function persistEvidencePhoto(
  sourceUri: string,
  _fileName: string | null | undefined,
): Promise<string> {
  if (sourceUri.startsWith('data:image/')) {
    return sourceUri;
  }
  const response = await fetch(sourceUri);
  if (!response.ok) {
    throw new Error('No se pudo leer la fotografía seleccionada en el navegador.');
  }
  return readBlobAsDataUri(await response.blob());
}

export async function readEvidencePhotoAsDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:image/')) {
    return uri;
  }
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('No se encontró el archivo local de la fotografía de entrega.');
  }
  return readBlobAsDataUri(await response.blob());
}
