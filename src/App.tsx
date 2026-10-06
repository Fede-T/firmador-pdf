import { useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { openPdf, type PDFDocumentProxy, type PDFPageProxy } from "./pdf";
import PdfPage from "./PdfPage";
import { stampSignatures } from "./save";
import SignatureModal from "./SignatureModal";
import type { Placed, Signature } from "./signature";
import "./App.css";

// Logotipo opcional: branding/logotype.svg|png (ver branding/README.md). Sin archivo, no se muestra nada.
const logotype = Object.values(
  import.meta.glob("/branding/logotype.{svg,png}", { eager: true, query: "?url", import: "default" }),
)[0] as string | undefined;

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
  const [notice, setNotice] = useState("");
  const nextId = useRef(0);
  const file = useRef<{ path: string; bytes: Uint8Array } | null>(null); // PDF abierto
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

  // Muestra el PDF. Lanza si no se puede abrir (se conserva el que estaba).
  async function cargar(bytes: Uint8Array, keepScroll = false) {
    const next = await openPdf(bytes);
    await doc.current?.loadingTask.destroy();
    doc.current = next;
    setPages(await Promise.all(Array.from({ length: next.numPages }, (_, i) => next.getPage(i + 1))));
    if (!keepScroll) viewer.current!.scrollTop = 0; // documento nuevo: arrancar desde arriba
    setPlaced([]); // las firmas pertenecen al PDF abierto (o ya quedaron estampadas en él)
    setSelectedId(null);
    setPending(null);
  }

  async function abrir() {
    const path = await open({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    try {
      const bytes = await readFile(path);
      await cargar(bytes);
      file.current = { path, bytes };
      setError("");
      setNotice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el archivo.");
    }
  }

  // "Guardar como": el diálogo propone el mismo nombre y carpeta del original, así que aceptar
  // lo sobrescribe (Windows pide confirmar). El PDF nuevo se arma entero en memoria antes de
  // escribir. Después se recarga el PDF guardado, para que un segundo guardado no estampe las
  // firmas dos veces.
  async function guardar() {
    const f = file.current!;
    const path = await save({ defaultPath: f.path, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    try {
      const out = await stampSignatures(f.bytes, pages, placed);
      await writeFile(path, out);
      file.current = { path, bytes: out };
      await cargar(out, true);
      setError("");
      setNotice("Guardado.");
    } catch {
      setNotice("");
      setError("No se pudo guardar. Verificá que el archivo no esté abierto en otro programa.");
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
    setNotice("");
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
        <button className="primary" onClick={guardar} disabled={placed.length === 0}>
          Guardar como
        </button>
        {notice && <span className="hint">{notice}</span>}
        {pending && <span className="hint">Hacé clic en la página para colocar la firma (Esc cancela).</span>}
        {error && <span className="error">{error}</span>}
      </header>
      <main ref={viewer} className="viewer">
        {pages.length === 0 && !error && (
          <div className="empty">
            {logotype && <img src={logotype} className="logotype" alt="" />}
            <p>Abrí un PDF para empezar.</p>
            <small className="credit">Firmador de PDF · Desarrollado por Federico Troncoso</small>
          </div>
        )}
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
