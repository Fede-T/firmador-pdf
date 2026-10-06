import { useEffect, useRef, useState } from "react";
import type { PDFPageProxy } from "./pdf";
import PlacedSignature, { SigCanvas, fitWidth } from "./PlacedSignature";
import type { Placed, Signature } from "./signature";

type Props = {
  page: PDFPageProxy;
  width: number;
  items: Placed[]; // firmas colocadas en esta página
  selectedId: number | null;
  pending: { sig: Signature; w?: number } | null; // firma que sigue al mouse esperando el clic
  onSelect: (id: number | null) => void;
  onChange: (id: number, patch: Partial<Pick<Placed, "x" | "y" | "w">>) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onPlace: (page: number, x: number, y: number, w: number) => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Una página del PDF. Ocupa su tamaño final desde el inicio (para que el scroll
 * sea correcto) pero solo dibuja el canvas mientras está cerca de la pantalla.
 * Las firmas se guardan en puntos de la vista; `scale` los pasa a píxeles.
 */
export default function PdfPage({
  page,
  width,
  items,
  selectedId,
  pending,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  onPlace,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  // viewport.scale = 1 incluye la rotación y el CropBox de la página.
  const base = page.getViewport({ scale: 1 });
  const pw = base.width;
  const ph = base.height;
  const scale = width / pw; // px de pantalla por punto
  const height = ph * scale;

  // Esquina superior izquierda (en puntos) de la firma pendiente centrada en el mouse,
  // sin salirse de la página.
  const pendW = pending ? fitWidth(pending.sig, pw, ph, pending.w) : 0;
  const pendH = pending ? (pendW * pending.sig.h) / pending.sig.w : 0;
  function pendingPos(e: React.PointerEvent) {
    const r = box.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / scale - pendW / 2, 0, pw - pendW),
      y: clamp((e.clientY - r.top) / scale - pendH / 2, 0, ph - pendH),
    };
  }

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "100% 0px" });
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current!;
    if (!near) {
      c.width = c.height = 0; // libera memoria de la página lejana
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });
    c.width = viewport.width;
    c.height = viewport.height;
    const task = page.render({ canvas: c, viewport });
    task.promise.catch(() => {}); // cancelada al cambiar de tamaño o salir de pantalla
    return () => task.cancel();
  }, [near, page, scale]);

  return (
    <div
      ref={box}
      className={"page" + (pending ? " placing" : "")}
      style={{ width, height }}
      onPointerMove={pending ? (e) => setGhost(pendingPos(e)) : undefined}
      onPointerLeave={() => setGhost(null)}
      onPointerDown={(e) => {
        if (!pending) return onSelect(null); // clic en la página: deselecciona
        const { x, y } = pendingPos(e);
        onPlace(page.pageNumber, x, y, pendW);
      }}
    >
      <canvas ref={canvas} style={{ width, height }} />
      {items.map((it) => (
        <PlacedSignature
          key={it.id}
          item={it}
          scale={scale}
          pw={pw}
          ph={ph}
          selected={it.id === selectedId}
          onSelect={() => onSelect(it.id)}
          onChange={(patch) => onChange(it.id, patch)}
          onDelete={() => onDelete(it.id)}
          onDuplicate={() => onDuplicate(it.id)}
        />
      ))}
      {pending && ghost && (
        <div className="sig ghost" style={{ left: ghost.x * scale, top: ghost.y * scale }}>
          <SigCanvas sig={pending.sig} wpx={pendW * scale} />
        </div>
      )}
    </div>
  );
}
