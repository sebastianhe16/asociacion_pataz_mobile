import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { WarehouseMovementRecord } from '../../core/types';
import { parseSignaturePaths } from '../warehouse/passportIntegrity';
import { readEvidencePhotoAsDataUri } from '../warehouse/evidencePhotoService';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCoordinate(value: number | null): string {
  return value === null ? 'No registrada' : value.toFixed(6);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : escapeHtml(date.toLocaleString('es-PE', {
      dateStyle: 'long',
      timeStyle: 'short',
    }));
}

function buildSignatureSvg(serializedPaths: string | null): string {
  const paths = parseSignaturePaths(serializedPaths);
  if (!paths) {
    throw new Error('El acta no contiene una firma válida para generar el PDF.');
  }

  const pathMarkup = paths
    .map((path) => `<path d="${path}" fill="none" stroke="#0f382b" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140" role="img" aria-label="Firma del receptor">${pathMarkup}</svg>`;
}

async function getPhotoDataUri(uri: string | null): Promise<string | null> {
  if (!uri) {
    return null;
  }

  if (uri.startsWith('data:image/')) {
    return uri;
  }

  return readEvidencePhotoAsDataUri(uri);
}

function buildActHtml(
  movement: WarehouseMovementRecord,
  signatureSvg: string,
  photoDataUri: string | null,
): string {
  const photoBlock = photoDataUri
    ? `<img class="evidence-photo" src="${photoDataUri}" alt="Fotografía de evidencia de entrega"/>`
    : '<div class="photo-placeholder">Fotografía no registrada</div>';

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <style>
        @page { margin: 22mm 18mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #23332c; font-family: Arial, sans-serif; font-size: 11px; }
        .header { border-bottom: 3px solid #0f382b; padding-bottom: 14px; margin-bottom: 20px; }
        .brand { color: #0f382b; font-size: 18px; font-weight: 700; }
        .subtitle { color: #64736b; margin-top: 4px; font-size: 10px; }
        h1 { margin: 22px 0 6px; color: #0f382b; font-size: 21px; }
        .intro { color: #64736b; margin: 0 0 18px; line-height: 1.5; }
        .section { margin: 16px 0; border: 1px solid #dce4df; border-radius: 8px; padding: 13px; }
        h2 { margin: 0 0 10px; color: #0f382b; font-size: 12px; }
        .row { display: flex; gap: 18px; margin: 7px 0; }
        .field { flex: 1; min-width: 0; }
        .label { display: block; color: #64736b; font-size: 9px; text-transform: uppercase; margin-bottom: 3px; }
        .value { display: block; color: #23332c; line-height: 1.4; overflow-wrap: anywhere; }
        .signature { width: 100%; max-width: 340px; height: 110px; border-bottom: 1px solid #8a9b91; }
        .evidence-photo { width: 100%; max-width: 330px; max-height: 210px; object-fit: contain; border-radius: 6px; }
        .photo-placeholder { padding: 28px; color: #64736b; background: #f3f6f4; text-align: center; border-radius: 6px; }
        .hash { font-family: monospace; font-size: 8px; line-height: 1.5; overflow-wrap: anywhere; color: #0f382b; }
        .integrity { color: #207343; font-weight: 700; margin-bottom: 8px; }
        .compliance { margin-top: 20px; padding: 10px; border-left: 3px solid #d28a22; background: #fff8eb; color: #72531c; line-height: 1.5; }
        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #dce4df; color: #64736b; font-size: 9px; }
      </style>
    </head>
    <body>
      <header class="header">
        <div class="brand">Asociación Pataz</div>
        <div class="subtitle">Gestión logística y operaciones de campo</div>
      </header>
      <h1>Acta Digital de Entrega</h1>
      <p class="intro">Constancia local de salida de almacén y recepción de bienes. Identificador: ${escapeHtml(movement.id)}</p>
      <section class="section">
        <h2>Detalle de la entrega</h2>
        <div class="row">
          <div class="field"><span class="label">Almacén de origen</span><span class="value">${escapeHtml(movement.almacenNombre)}</span></div>
          <div class="field"><span class="label">Fecha y hora</span><span class="value">${formatTimestamp(movement.timestamp)}</span></div>
        </div>
        <div class="row">
          <div class="field"><span class="label">Insumo</span><span class="value">${escapeHtml(movement.insumoNombre)} (${escapeHtml(movement.insumoCodigo)})</span></div>
          <div class="field"><span class="label">Cantidad</span><span class="value">${movement.cantidad}</span></div>
        </div>
        <div class="row">
          <div class="field"><span class="label">Destino</span><span class="value">${escapeHtml(movement.destinoCaserio ?? 'No especificado')}</span></div>
          <div class="field"><span class="label">Responsable de entrega</span><span class="value">${escapeHtml(movement.responsable)}</span></div>
        </div>
      </section>
      <section class="section">
        <h2>Receptor</h2>
        <div class="row">
          <div class="field"><span class="label">Nombre completo</span><span class="value">${escapeHtml(movement.receptorNombre ?? 'No registrado')}</span></div>
          <div class="field"><span class="label">DNI</span><span class="value">${escapeHtml(movement.receptorDni ?? 'No registrado')}</span></div>
        </div>
        <div class="row">
          <div class="field"><span class="label">Cargo u organización</span><span class="value">${escapeHtml(movement.receptorCargo ?? 'No registrado')}</span></div>
        </div>
      </section>
      <section class="section">
        <h2>Ubicación de entrega</h2>
        <div class="row">
          <div class="field"><span class="label">Latitud</span><span class="value">${formatCoordinate(movement.latitud)}</span></div>
          <div class="field"><span class="label">Longitud</span><span class="value">${formatCoordinate(movement.longitud)}</span></div>
        </div>
      </section>
      <section class="section">
        <h2>Evidencia fotográfica</h2>${photoBlock}
      </section>
      <section class="section">
        <h2>Firma del receptor</h2>
        <div class="signature">${signatureSvg}</div>
        <div class="subtitle">${escapeHtml(movement.receptorNombre ?? '')} · DNI ${escapeHtml(movement.receptorDni ?? '')}</div>
      </section>
      <section class="section">
        <h2>Sello criptográfico SHA-256</h2>
        <div class="integrity">Integridad local verificada</div>
        <div class="hash">${escapeHtml(movement.hashSha256 ?? '')}</div>
      </section>
      <div class="compliance"><strong>Registro documental de apoyo APCI/SUNAT.</strong> La validez y los requisitos aplicables deben ser revisados por el área institucional competente. Este documento y su hash local no constituyen una firma digital certificada ni una aprobación oficial.</div>
      <footer class="footer">Generado localmente por la aplicación de Asociación Pataz · ${formatTimestamp(new Date().toISOString())}</footer>
    </body>
  </html>`;
}

export async function shareDeliveryActPdf(
  movement: WarehouseMovementRecord,
): Promise<void> {
  if (!movement.hashSha256) {
    throw new Error('El movimiento no tiene un pasaporte fiduciario para exportar.');
  }

  const signatureSvg = buildSignatureSvg(movement.firmaSvgPaths);
  const photoDataUri = await getPhotoDataUri(movement.fotoUri);
  const { uri } = await Print.printToFileAsync({
    html: buildActHtml(movement, signatureSvg, photoDataUri),
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(`El PDF se generó en ${new File(uri).name}, pero no hay una opción de compartir disponible en este dispositivo.`);
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: 'Compartir Acta Digital de Entrega',
    mimeType: 'application/pdf',
    UTI: '.pdf',
  });
}
