import { useEffect, useRef, useState } from "react";
import { buildSignature, drawStrokes, type Signature, type Stroke } from "./signature";

const COLORS = ["#000000", "#0b2a5b"];
const SIZE = 3.6; // grosor base en px del lienzo

export default function SignatureModal({
  onAccept,
  onCancel,
}: {
  onAccept: (s: Signature) => void;
  onCancel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const frame = useRef(0);
  const [color, setColor] = useState(COLORS[0]);
  const [empty, setEmpty] = useState(true);
  const colorRef = useRef(color); // para que redraw() vea el color actual desde el ResizeObserver
  colorRef.current = color;

  // Redibuja todo (pocos puntos); se agrupa en un solo dibujo por frame.
  function redraw() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const c = canvas.current!;
      const ctx = c.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      drawStrokes(ctx, strokes.current, colorRef.current, SIZE);
    });
  }

  // Ajusta la resolución del lienzo a su tamaño en pantalla.
  useEffect(() => {
    const c = canvas.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      redraw();
    });
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(redraw, [color]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Con mouse o lápiz sin presión real (0 o 0.5 fijo) el grosor es constante (p = 0.5).
  function point(e: PointerEvent | React.PointerEvent, prev?: number) {
    const r = canvas.current!.getBoundingClientRect();
    const real = e.pointerType === "pen" && e.pressure > 0 && e.pressure !== 0.5;
    const raw = real ? e.pressure : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: prev === undefined ? raw : prev * 0.6 + raw * 0.4 };
  }

  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([point(e)]);
    setEmpty(false);
    redraw();
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const s = strokes.current[strokes.current.length - 1];
    // Los eventos "coalesced" traen todos los puntos intermedios del lápiz.
    for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
      s.push(point(ev, s[s.length - 1].p));
    }
    redraw();
  }

  function clear() {
    strokes.current = [];
    setEmpty(true);
    redraw();
  }

  function accept() {
    const sig = buildSignature(strokes.current, color, SIZE);
    if (sig) onAccept(sig);
  }

  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-label="Dibujar firma">
        <h2>Dibujá tu firma</h2>
        <canvas
          ref={canvas}
          className="sign-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
        <div className="modal-bar">
          <div className="colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={"swatch" + (c === color ? " on" : "")}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={"Color " + c}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Otro color" />
          </div>
          <div className="actions">
            <button onClick={clear} disabled={empty}>
              Borrar
            </button>
            <button onClick={onCancel}>Cancelar</button>
            <button className="primary" onClick={accept} disabled={empty}>
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
