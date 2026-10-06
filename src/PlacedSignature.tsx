import { useEffect, useRef } from "react";
import { drawStrokes, type Placed, type Signature } from "./signature";

const DEFAULT_W = 150; // ancho inicial de una firma nueva, en puntos
// Anchos permitidos (puntos): el tamaño siempre salta entre estos pasos, como en Adobe.
const STEPS = [48, 60, 75, 95, 120, 150, 190, 240, 300, 380, 475];
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Ancho que ocupa una firma en una página de pw x ph puntos: nunca más grande que la página. */
export function fitWidth(sig: Signature, pw: number, ph: number, wanted = DEFAULT_W) {
  return Math.min(wanted, pw * 0.9, (ph * 0.9 * sig.w) / sig.h);
}

/** Paso más cercano a w que entre en `max` (si ninguno entra, el propio max). */
function snap(w: number, max: number) {
  const ok = STEPS.filter((s) => s <= max);
  return ok.length ? ok.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)) : max;
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
type Drag = { mode: "move" | Corner; sx: number; sy: number; ox: number; oy: number; ow: number };

type Props = {
  item: Placed;
  scale: number; // px de pantalla por punto
  pw: number; // tamaño de la página, en puntos
  ph: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Pick<Placed, "x" | "y" | "w">>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

export default function PlacedSignature({ item, scale, pw, ph, selected, onSelect, onChange, onDelete, onDuplicate }: Props) {
  const drag = useRef<Drag | null>(null);
  const asp = item.sig.h / item.sig.w;
  const h = item.w * asp;

  function down(e: React.PointerEvent, mode: Drag["mode"]) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, ow: item.w };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    if (d.mode === "move") {
      onChange({ x: clamp(d.ox + dx, 0, pw - item.w), y: clamp(d.oy + dy, 0, ph - h) });
      return;
    }
    // Redimensionar: la esquina opuesta queda fija y la proporción se mantiene.
    const right = d.mode.endsWith("e");
    const bottom = d.mode.startsWith("s");
    const oh = d.ow * asp;
    const ax = right ? d.ox : d.ox + d.ow;
    const ay = bottom ? d.oy : d.oy + oh;
    const cx = (right ? d.ox + d.ow : d.ox) + dx;
    const cy = (bottom ? d.oy + oh : d.oy) + dy;
    const maxW = Math.min(right ? pw - ax : ax, (bottom ? ph - ay : ay) / asp); // que no se salga de la página
    const w = snap(Math.max(Math.abs(cx - ax), Math.abs(cy - ay) / asp), maxW);
    onChange({ w, x: right ? ax : ax - w, y: bottom ? ay : ay - w * asp });
  }

  // Botones − / +: siguiente o anterior paso de tamaño. Crece centrado en horizontal y fijo en
  // vertical respecto del borde pegado al menú, así los botones no se mueven bajo el mouse.
  const below = item.y * scale < 44; // el menú va debajo si no hay lugar arriba
  const maxPage = Math.min(pw, ph / asp);
  const smaller = STEPS.filter((s) => s < item.w - 0.5).pop();
  const bigger = STEPS.find((s) => s > item.w + 0.5 && s <= maxPage);
  function resizeTo(w: number) {
    onChange({
      w,
      x: clamp(item.x - (w - item.w) / 2, 0, pw - w),
      y: clamp(below ? item.y + h - w * asp : item.y, 0, ph - w * asp),
    });
  }

  const corners: Corner[] = ["nw", "ne", "sw", "se"];
  return (
    <div
      className={"sig" + (selected ? " selected" : "")}
      style={{ left: item.x * scale, top: item.y * scale, width: item.w * scale, height: h * scale }}
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
          <div className={"sig-actions" + (below ? " below" : "")} onPointerDown={(e) => e.stopPropagation()}>
            <button title="Reducir" aria-label="Reducir" disabled={smaller === undefined} onClick={() => resizeTo(smaller!)}>
              <Icon d={ICONS.minus} />
            </button>
            <button title="Agrandar" aria-label="Agrandar" disabled={bigger === undefined} onClick={() => resizeTo(bigger!)}>
              <Icon d={ICONS.plus} />
            </button>
            <button title="Duplicar" aria-label="Duplicar" onClick={onDuplicate}>
              <Icon d={ICONS.copy} />
            </button>
            <button className="danger" title="Eliminar (Supr)" aria-label="Eliminar" onClick={onDelete}>
              <Icon d={ICONS.trash} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
