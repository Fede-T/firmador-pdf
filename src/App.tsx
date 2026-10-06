import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { openPdf, type PDFDocumentProxy, type PDFPageProxy } from "./pdf";
import PdfPage from "./PdfPage";
import "./App.css";

const MAX_PAGE_WIDTH = 1000;
const GUTTER = 48; // margen horizontal del visor

export default function App() {
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(MAX_PAGE_WIDTH);
  const doc = useRef<PDFDocumentProxy | null>(null);
  const viewer = useRef<HTMLElement>(null);

  // Las páginas se ajustan al ancho disponible del visor.
  useEffect(() => {
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.min(MAX_PAGE_WIDTH, Math.floor(e.contentRect.width) - GUTTER)),
    );
    ro.observe(viewer.current!);
    return () => ro.disconnect();
  }, []);

  async function abrir() {
    const path = await open({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    try {
      const next = await openPdf(await readFile(path));
      await doc.current?.loadingTask.destroy();
      doc.current = next;
      setPages(await Promise.all(Array.from({ length: next.numPages }, (_, i) => next.getPage(i + 1))));
      viewer.current!.scrollTop = 0; // documento nuevo: arrancar desde arriba
      setError("");
    } catch (e) {
      // Si falla, se conserva el documento que ya estaba abierto.
      setError(e instanceof Error ? e.message : "No se pudo abrir el archivo.");
    }
  }

  return (
    <>
      <header className="toolbar">
        <button className="primary" onClick={abrir}>
          Abrir PDF
        </button>
        {error && <span className="error">{error}</span>}
      </header>
      <main ref={viewer} className="viewer">
        {pages.length === 0 && !error && <p className="empty">Abrí un PDF para empezar.</p>}
        {pages.map((p) => (
          <PdfPage key={p.pageNumber} page={p} width={width} />
        ))}
      </main>
    </>
  );
}
