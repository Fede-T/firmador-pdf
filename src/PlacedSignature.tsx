import { useEffect, useRef } from "react";
import { drawStrokes, type Placed, type Signature } from "./signature";

const DEFAULT_L = 95; // lado mayor inicial de una firma nueva, en puntos
// Tamaños permitidos (puntos) del LADO MAYOR de la firma: el tamaño salta entre estos pasos,
// como en Adobe. Usar el lado mayor evita que una firma alta y angosta salga gigante.
const STEPS = [2, 5, 10, 14, 18, 20, 28, 36, 42, 48, 54, 60, 75, 85, 95, 120, 150, 190, 240, 300, 380, 475];
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Caja que envuelve a un rectángulo w x h girado `rot` grados. */
function bboxOf(w: number, h: number, rot: number) {
  const c = Math.abs(Math.cos(rad(rot)));
  const s = Math.abs(Math.sin(rad(rot)));
  return { bw: w * c + h * s, bh: w * s + h * c };
}

/** Esquina superior izquierda (sin rotar) de una firma con centro lo más cerca posible de (cx, cy)
 * sin que su caja girada se salga de la página. */
export function placeAt(cx: number, cy: number, w: number, h: number, rot: number, pw: number, ph: number) {
  const { bw, bh } = bboxOf(w, h, rot);
  return { x: clamp(cx, bw / 2, pw - bw / 2) - w / 2, y: clamp(cy, bh / 2, ph - bh / 2) - h / 2 };
}

/** ¿Entra una firma de w x h, girada y centrada en (cx, cy), en la página? */
function fits(cx: number, cy: number, w: number, h: number, rot: number, pw: number, ph: number) {
  const { bw, bh } = bboxOf(w, h, rot);
  const e = 0.01;
  return bw / 2 <= cx + e && cx + bw / 2 <= pw + e && bh / 2 <= cy + e && cy + bh / 2 <= ph + e;
}

/** Ancho inicial de una firma en una página de pw x ph puntos (nunca mayor al 90% de la página). */
export function startWidth(sig: Signature, pw: number, ph: number, wanted?: number, rot = 0) {
  const asp = sig.h / sig.w;
  const w = wanted ?? DEFAULT_L / Math.max(1, asp);
  const { bw, bh } = bboxOf(w, w * asp, rot);
  return w * Math.min(1, (pw * 0.9) / bw, (ph * 0.9) / bh);
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  copy: "M9 9h11v11H9z M5 15H4V4h11v1",
  trash: "M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  reset: "M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10",
};

/** Dibuja la firma en un canvas de `wpx` píxeles de ancho. */
export function SigCanvas({ sig, wpx }: { sig: Signature; wpx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hpx = (wpx * sig.h) / sig.w;
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.ceil(wpx * dpr);
    c.height = Math.ceil(hpx * dpr);
    drawStrokes(c.getContext("2d")!, sig.strokes, sig.color, sig.size, (wpx * dpr) / sig.w);
  }, [sig, wpx, hpx]);
  return <canvas ref={ref} style={{ width: wpx, height: hpx, display: "block" }} />;
}

type Corner = "nw" | "ne" | "sw" | "se";
const SIGNS: Record<Corner, [number, number]> = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] };
type Drag = {
  mode: "move" | "rotate" | Corner;
  sx: number; // posición del puntero al empezar (px de pantalla)
  sy: number;
  cx: number; // centro de la firma al empezar (puntos)
  cy: number;
  w: number;
  rot: number;
};

type Props = {
  item: Placed;
  scale: number; // px de pantalla por punto
  pw: number; // tamaño de la página, en puntos
  ph: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Pick<Placed, "x" | "y" | "w" | "rot">>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

export default function PlacedSignature({ item, scale, pw, ph, selected, onSelect, onChange, onDelete, onDuplicate }: Props) {
  const drag = useRef<Drag | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const asp = item.sig.h / item.sig.w;
  const k = Math.max(1, asp); // el lado mayor es w * k
  const steps = STEPS.map((s) => s / k); // pasos expresados como ancho
  const h = item.w * asp;
  const cx = item.x + item.w / 2;
  const cy = item.y + h / 2;
  const { bw, bh } = bboxOf(item.w, h, item.rot);

  function down(e: React.PointerEvent, mode: Drag["mode"]) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, cx, cy, w: item.w, rot: item.rot };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;

    if (d.mode === "move") {
      onChange(placeAt(d.cx + dx, d.cy + dy, d.w, d.w * asp, d.rot, pw, ph));
      return;
    }

    if (d.mode === "rotate") {
      // Ángulo del puntero respecto del centro en pantalla; el tirador está "arriba" (rot = 0).
      const r = body.current!.getBoundingClientRect();
      let rot = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      rot = ((((rot + 180) % 360) + 360) % 360) - 180;
      if (e.shiftKey) rot = Math.round(rot / 15) * 15; // Shift: pasos de 15°
      else if (Math.abs(rot) < 2.5) rot = 0; // imán en horizontal
      if (!fits(pw / 2, ph / 2, item.w, h, rot, pw, ph)) return; // girada no entra en la página
      onChange({ rot, ...placeAt(cx, cy, item.w, h, rot, pw, ph) });
      return;
    }

    // Redimensionar desde una esquina: la esquina opuesta queda fija en la página (aunque la
    // firma esté girada) y la proporción se mantiene. Se calcula en el sistema de la firma.
    const [sx, sy] = SIGNS[d.mode];
    const t = rad(d.rot);
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const R = (x: number, y: number) => [x * cos - y * sin, x * sin + y * cos];
    const dh = d.w * asp;
    const [ox, oy] = R((sx * d.w) / 2, (sy * dh) / 2);
    const ax = d.cx - ox; // esquina opuesta (ancla)
    const ay = d.cy - oy;
    const px = d.cx + ox + dx; // dónde está ahora el puntero
    const py = d.cy + oy + dy;
    const vx = (px - ax) * cos + (py - ay) * sin; // vector ancla -> puntero, sin girar
    const vy = -(px - ax) * sin + (py - ay) * cos;
    const want = Math.max(Math.abs(vx), Math.abs(vy) / asp);
    // Paso más cercano al deseado que entre en la página.
    const order = [...steps].sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    for (const w of order) {
      const [ex, ey] = R((sx * w) / 2, (sy * w * asp) / 2);
      const ncx = ax + ex;
      const ncy = ay + ey;
      if (fits(ncx, ncy, w, w * asp, d.rot, pw, ph)) {
        onChange({ w, x: ncx - w / 2, y: ncy - (w * asp) / 2 });
        return;
      }
    }
  }

  // Botones − / +: siguiente o anterior paso de tamaño. Crece centrado en horizontal y fijo en
  // vertical respecto del borde pegado al menú, así los botones no se mueven bajo el mouse.
  const top = cy - bh / 2;
  const below = top * scale < 80; // el menú va debajo si no hay lugar arriba
  const smaller = steps.filter((s) => s < item.w - 0.5).pop();
  const bigger = steps.find((s) => s > item.w + 0.5 && bboxOf(s, s * asp, item.rot).bw <= pw && bboxOf(s, s * asp, item.rot).bh <= ph);
  function resizeTo(w: number) {
    const nh = w * asp;
    const ncy = cy + (below ? -1 : 1) * ((nh - h) / 2);
    onChange({ w, ...placeAt(cx, ncy, w, nh, item.rot, pw, ph) });
  }

  const corners: Corner[] = ["nw", "ne", "sw", "se"];
  return (
    // Caja externa = caja que envuelve a la firma girada; solo ordena el menú.
    <div
      className="sig-box"
      style={{ left: (cx - bw / 2) * scale, top: top * scale, width: bw * scale, height: bh * scale }}
    >
      <div
        ref={body}
        className={"sig" + (selected ? " selected" : "")}
        style={{
          left: ((bw - item.w) / 2) * scale,
          top: ((bh - h) / 2) * scale,
          width: item.w * scale,
          height: h * scale,
          transform: `rotate(${item.rot}deg)`,
        }}
        onPointerDown={(e) => down(e, "move")}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <SigCanvas sig={item.sig} wpx={item.w * scale} />
        {selected && (
          <>
            {corners.map((c) => (
              <span key={c} className={"handle " + c} onPointerDown={(e) => down(e, c)} />
            ))}
            <span className="rotate-handle" title="Girar (Shift: de a 15°)" onPointerDown={(e) => down(e, "rotate")} />
          </>
        )}
      </div>
      {selected && (
        <div className={"sig-actions" + (below ? " below" : "")} onPointerDown={(e) => e.stopPropagation()}>
          <button title="Reducir" aria-label="Reducir" disabled={smaller === undefined} onClick={() => resizeTo(smaller!)}>
            <Icon d={ICONS.minus} />
          </button>
          <button title="Agrandar" aria-label="Agrandar" disabled={bigger === undefined} onClick={() => resizeTo(bigger!)}>
            <Icon d={ICONS.plus} />
          </button>
          <button
            title="Restablecer giro"
            aria-label="Restablecer giro"
            disabled={item.rot === 0}
            onClick={() => onChange({ rot: 0, ...placeAt(cx, cy, item.w, h, 0, pw, ph) })}
          >
            <Icon d={ICONS.reset} />
          </button>
          <button title="Duplicar" aria-label="Duplicar" onClick={onDuplicate}>
            <Icon d={ICONS.copy} />
          </button>
          <button className="danger" title="Eliminar (Supr)" aria-label="Eliminar" onClick={onDelete}>
            <Icon d={ICONS.trash} />
          </button>
        </div>
      )}
    </div>
  );
}
