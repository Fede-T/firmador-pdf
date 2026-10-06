import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

// El worker se sirve desde la propia app (sin CDN) para que funcione offline.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

/** Abre el PDF para mostrarlo. Lanza un Error con mensaje listo para el usuario. */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  let doc: PDFDocumentProxy;
  try {
    // pdf.js transfiere (vacía) el buffer al worker: le pasamos una copia
    // para conservar los bytes originales para el guardado.
    doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "PasswordException") {
      throw new Error("El PDF está protegido con contraseña. Esta herramienta no puede abrirlo.");
    }
    throw new Error("No se pudo abrir el archivo: está dañado o no es un PDF válido.");
  }
  // getPermissions() devuelve null si el PDF no está cifrado.
  if ((await doc.getPermissions()) !== null) {
    await doc.loadingTask.destroy();
    throw new Error("El PDF tiene restricciones o cifrado. Esta herramienta no puede abrirlo.");
  }
  return doc;
}
