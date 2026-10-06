import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { openPdf, type PDFDocumentProxy, type PDFPageProxy } from "./pdf";
import PdfPage from "./PdfPage";
import SignatureModal from "./SignatureModal";
import type { Placed, Signature } from "./signature";
import "./App.css";

const MAX_PAGE_WIDTH = 1000;
const GUTTER = 48; // margen horizontal del visor

export default function App() {
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(MAX_PAGE_WIDTH);
  const [signing, setSigning] = useState(false);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Firma que sigue al mouse hasta que se hace clic en una página.
  const [pending, setPending] = useState<{ sig: Signature; w?: number } | null>(null);
  const nextId = useRef(0);
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

  // Supr elimina la firma seleccionada; Esc cancela la colocación o deselecciona.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (signing) return;
      if (e.key === "Delete" && selectedId !== null) remove(selectedId);
      if (e.key === "Escape") (pending ? setPending(null) : setSelectedId(null));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function abrir() {
    const path = await open({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    try {
      const next = await openPdf(await readFile(path));
      await doc.current?.loadingTask.destroy();
      doc.current = next;
      setPages(await Promise.all(Array.from({ length: next.numPages }, (_, i) => next.getPage(i + 1))));
      viewer.current!.scrollTop = 0; // documento nuevo: arrancar desde arriba
      setPlaced([]); // las firmas pertenecen al PDF abierto
      setSelectedId(null);
      setPending(null);
      setError("");
    } catch (e) {
      // Si falla, se conserva el documento que ya estaba abierto.
      setError(e instanceof Error ? e.message : "No se pudo abrir el archivo.");
    }
  }

  function remove(id: number) {
    setPlaced((l) => l.filter((p) => p.id !== id));
    setSelectedId(null);
  }

  function place(page: number, x: number, y: number, w: number) {
    const id = ++nextId.current;
    setPlaced((l) => [...l, { id, sig: pending!.sig, page, x, y, w }]);
    setSelectedId(id);
    setPending(null);
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
        {pending && <span className="hint">Hacé clic en la página para colocar la firma (Esc cancela).</span>}
        {error && <span className="error">{error}</span>}
      </header>
      <main ref={viewer} className="viewer">
        {pages.length === 0 && !error && <p className="empty">Abrí un PDF para empezar.</p>}
        {pages.map((p) => (
          <PdfPage
            key={p.pageNumber}
            page={p}
            width={width}
            items={placed.filter((s) => s.page === p.pageNumber)}
            selectedId={selectedId}
            pending={pending}
            onSelect={setSelectedId}
            onChange={(id, patch) => setPlaced((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)))}
            onDelete={remove}
            onDuplicate={(id) => {
              // La copia conserva el tamaño y se coloca con un clic, en cualquier página.
              const s = placed.find((x) => x.id === id)!;
              setPending({ sig: s.sig, w: s.w });
              setSelectedId(null);
            }}
            onPlace={place}
          />
        ))}
      </main>
      {signing && (
        <SignatureModal
          onAccept={(s) => {
            setPending({ sig: s });
            setSelectedId(null);
            setSigning(false);
          }}
          onCancel={() => setSigning(false)}
        />
      )}
    </>
  );
}
