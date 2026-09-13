/**
 * Reduce una imagen en el navegador antes de subirla: las fotos de teléfono de 5-12 MB superarían
 * el límite de 4,5 MB por petición de Vercel y tardarían mucho. Fotos: JPEG a 0,85 (1600 px por
 * defecto). Logos: `conservarPng` mantiene el PNG (fondo transparente); SVG y GIF se suben tal cual.
 */
export async function reducirImagen(archivo: File, maxLado = 1600, conservarPng = false): Promise<File> {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif' || archivo.type === 'image/svg+xml') return archivo;
  const mapa = await createImageBitmap(archivo).catch(() => null);
  if (!mapa) return archivo;
  const escala = Math.min(1, maxLado / Math.max(mapa.width, mapa.height));
  if (escala === 1 && archivo.size < 1_000_000) return archivo;
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext('2d')!.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  const png = conservarPng && archivo.type === 'image/png';
  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.85));
  if (!blob) return archivo;
  return new File([blob], archivo.name.replace(/\.\w+$/, '') + (png ? '.png' : '.jpg'), { type: blob.type });
}

/** Engancha la reducción a un <input type=file>: al elegir un archivo lo sustituye por su versión reducida. */
export function reducirAlElegir(input: HTMLInputElement, maxLado = 1600, conservarPng = false) {
  if (input.dataset.reducir) return;
  input.dataset.reducir = '1';
  input.addEventListener('change', async () => {
    const original = input.files?.[0];
    if (!original) return;
    const reducida = await reducirImagen(original, maxLado, conservarPng);
    if (reducida !== original) { const dt = new DataTransfer(); dt.items.add(reducida); input.files = dt.files; }
  });
}
