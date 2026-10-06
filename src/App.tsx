import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { openPdf, type PDFDocumentProxy, type PDFPageProxy } from "./pdf";
import PdfPage from "./PdfPage";
import SignatureModal from "./SignatureModal";
import { drawStrokes, type Signature } from "./signature";
import "./App.css";

const MAX_PAGE_WIDTH = 1000;
const GUTTER = 48; // margen horizontal del visor

export default function App() {
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(MAX_PAGE_WIDTH);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<Signature | null>(null); // provisorio: la colocación es la etapa 3
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
        <button onClick={() => setSigning(true)} disabled={pages.length === 0}>
          Agregar firma
        </button>
        {signature && <SignaturePreview sig={signature} />}
        {error && <span className="error">{error}</span>}
      </header>
      <main ref={viewer} className="viewer">
        {pages.length === 0 && !error && <p className="empty">Abrí un PDF para empezar.</p>}
        {pages.map((p) => (
          <PdfPage key={p.pageNumber} page={p} width={width} />
        ))}
      </main>
      {signing && (
        <SignatureModal
          onAccept={(s) => {
            setSignature(s);
            setSigning(false);
          }}
          onCancel={() => setSigning(false)}
        />
      )}
    </>
  );
}

// Provisorio (etapa 2): permite ver la firma aceptada. Se reemplaza en la etapa 3.
function SignaturePreview({ sig }: { sig: Signature }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = Math.min(1, 160 / sig.w, 40 / sig.h);
  useEffect(() => {
    const c = ref.current!;
    c.width = sig.w * scale;
    c.height = sig.h * scale;
    drawStrokes(c.getContext("2d")!, sig.strokes, sig.color, sig.size, scale);
  }, [sig, scale]);
  return <canvas ref={ref} className="preview" />;
}
