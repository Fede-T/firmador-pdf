import {
  PDFDocument,
  closePath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
} from "pdf-lib";
import type { PDFPageProxy } from "./pdf";
import { outline, smooth, type Placed } from "./signature";

/**
 * Devuelve el PDF con las firmas estampadas como trazados vectoriales rellenos
 * (sin imagen, fondo transparente). El contenido original no se toca.
 *
 * Coordenadas: cada firma está en puntos de la vista de pdf.js (origen arriba a la
 * izquierda, con rotación y CropBox aplicados). `viewport.convertToPdfPoint` pasa
 * cada punto al espacio de usuario del PDF (origen abajo a la izquierda, sin rotar),
 * que es donde se escribe el contenido de la página. Así rotaciones y CropBox quedan bien.
 */
export async function stampSignatures(bytes: Uint8Array, pages: PDFPageProxy[], placed: Placed[]) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const it of placed) {
    const viewport = pages[it.page - 1].getViewport({ scale: 1 });
    const k = it.w / it.sig.w; // unidades de firma -> puntos de la vista
    // Giro alrededor del centro de la firma (en la vista, y hacia abajo, igual que en pantalla).
    const cx = it.x + it.w / 2;
    const cy = it.y + (it.w * it.sig.h) / it.sig.w / 2;
    const cos = Math.cos((it.rot * Math.PI) / 180);
    const sin = Math.sin((it.rot * Math.PI) / 180);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(it.sig.color.slice(i, i + 2), 16) / 255);
    const ops = [pushGraphicsState(), setFillingRgbColor(r, g, b)];
    for (const stroke of it.sig.strokes) {
      outline(smooth(stroke, it.sig.size)).forEach((p, i) => {
        const dx = it.x + p.x * k - cx;
        const dy = it.y + p.y * k - cy;
        const [x, y] = viewport.convertToPdfPoint(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos);
        ops.push(i ? lineTo(x, y) : moveTo(x, y));
      });
      ops.push(closePath(), fill());
    }
    ops.push(popGraphicsState());
    pdf.getPage(it.page - 1).pushOperators(...ops);
  }
  return pdf.save();
}
