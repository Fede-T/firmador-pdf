import { useEffect, useRef, useState } from "react";
import type { PDFPageProxy } from "./pdf";

/**
 * Una página del PDF. Ocupa su tamaño final desde el inicio (para que el scroll
 * sea correcto) pero solo dibuja el canvas mientras está cerca de la pantalla.
 */
export default function PdfPage({ page, width }: { page: PDFPageProxy; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

  // viewport.scale = 1 incluye la rotación y el CropBox de la página.
  const base = page.getViewport({ scale: 1 });
  const scale = width / base.width;
  const height = base.height * scale;

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
    <div ref={box} className="page" style={{ width, height }}>
      <canvas ref={canvas} style={{ width, height }} />
    </div>
  );
}
