/** Punto del trazo: x,y en px del lienzo de captura; p = presión (0..1). */
export type Point = { x: number; y: number; p: number };
export type Stroke = Point[];

/**
 * Firma como trazos vectoriales. Las coordenadas son relativas a la esquina
 * superior izquierda de su caja (0,0 .. w,h), así que se puede escalar a
 * cualquier tamaño multiplicando todo (incluido `size`) por el mismo factor.
 */
export type Signature = {
  strokes: Stroke[];
  color: string;
  w: number;
  h: number;
  size: number; // grosor base del trazo, en las mismas unidades
};

/** Punto ya suavizado, con su grosor. */
export type Sample = { x: number; y: number; w: number };

/** Grosor según presión. A p = 0.5 (mouse o lápiz sin presión) da exactamente `size`. */
export const widthFor = (size: number, p: number) => size * (0.4 + 1.2 * p);

/** Filtro 1-2-1 repetido: quita el temblor del lápiz sin mover los extremos. */
function relax(v: number[], times: number): number[] {
  let cur = v;
  for (let t = 0; t < times; t++) {
    cur = cur.map((x, i) => (i === 0 || i === cur.length - 1 ? x : (cur[i - 1] + 2 * x + cur[i + 1]) / 4));
  }
  return cur;
}

/**
 * Suaviza un trazo: descarta puntos casi repetidos, filtra posición y presión
 * (para que no se vea poligonal ni el grosor "salte"), interpola con
 * Catmull-Rom y afina levemente las puntas, como una pluma.
 */
export function smooth(stroke: Stroke, size: number): Sample[] {
  const raw = stroke.filter((p, i) => i === 0 || Math.hypot(p.x - stroke[i - 1].x, p.y - stroke[i - 1].y) >= 1);
  if (raw.length === 1) raw.push(raw[0]);
  const xs = relax(raw.map((p) => p.x), 3);
  const ys = relax(raw.map((p) => p.y), 3);
  const ps = relax(raw.map((p) => p.p), 6);
  const pts: Point[] = raw.map((_, i) => ({ x: xs[i], y: ys[i], p: ps[i] }));

  const out: Sample[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const n = Math.min(12, Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2)));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push({
        x: cr(p0.x, p1.x, p2.x, p3.x),
        y: cr(p0.y, p1.y, p2.y, p3.y),
        w: widthFor(size, p1.p + (p2.p - p1.p) * t),
      });
    }
  }
  const last = pts[pts.length - 1];
  out.push({ x: last.x, y: last.y, w: widthFor(size, last.p) });

  // Puntas afinadas: el grosor crece desde 35% hasta 100% en los primeros/últimos ~4 grosores.
  const len = [0];
  for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y));
  const total = len[len.length - 1];
  const ramp = size * 4;
  if (total > ramp * 2) {
    out.forEach((s, i) => (s.w *= 0.35 + 0.65 * Math.min(1, len[i] / ramp, (total - len[i]) / ramp)));
  }
  return out;
}

/**
 * Contorno cerrado del trazo (borde izquierdo, punta redonda, borde derecho de
 * vuelta y punta inicial). Se rellena de una vez: sin cortes entre segmentos.
 * Lo usa tanto la pantalla como el guardado en el PDF.
 */
export function outline(m: Sample[]): { x: number; y: number }[] {
  const N = m.length;
  const normal = (i: number) => {
    const a = m[Math.max(i - 1, 0)];
    const b = m[Math.min(i + 1, N - 1)];
    return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2; // ángulo de la normal izquierda
  };
  const ang = m.map((_, i) => normal(i));
  // Sin movimiento (punto suelto) el ángulo no importa: sale un círculo.
  const poly: { x: number; y: number }[] = [];
  const side = (i: number, th: number) => ({
    x: m[i].x + (Math.cos(th) * m[i].w) / 2,
    y: m[i].y + (Math.sin(th) * m[i].w) / 2,
  });
  const CAP = 8;
  for (let i = 0; i < N; i++) poly.push(side(i, ang[i]));
  for (let k = 1; k < CAP; k++) poly.push(side(N - 1, ang[N - 1] - (Math.PI * k) / CAP));
  for (let i = N - 1; i >= 0; i--) poly.push(side(i, ang[i] + Math.PI));
  for (let k = 1; k < CAP; k++) poly.push(side(0, ang[0] + Math.PI - (Math.PI * k) / CAP));
  return poly;
}

/** Dibuja los trazos en un canvas (fondo transparente). `scale` convierte unidades de firma a px. */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  color: string,
  size: number,
  scale = 1,
) {
  ctx.fillStyle = color;
  for (const s of strokes) {
    const poly = outline(smooth(s, size));
    ctx.beginPath();
    poly.forEach((p, i) => (i ? ctx.lineTo(p.x * scale, p.y * scale) : ctx.moveTo(p.x * scale, p.y * scale)));
    ctx.closePath();
    ctx.fill();
  }
}

/** Recorta los trazos a su caja y arma la firma. Devuelve null si no hay nada dibujado. */
export function buildSignature(strokes: Stroke[], color: string, size: number): Signature | null {
  const pts = strokes.flat();
  if (pts.length === 0) return null;
  const pad = widthFor(size, 1) / 2 + 1; // el trazo más grueso no debe quedar cortado
  const minX = Math.min(...pts.map((p) => p.x)) - pad;
  const minY = Math.min(...pts.map((p) => p.y)) - pad;
  const maxX = Math.max(...pts.map((p) => p.x)) + pad;
  const maxY = Math.max(...pts.map((p) => p.y)) + pad;
  return {
    strokes: strokes.map((s) => s.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }))),
    color,
    w: maxX - minX,
    h: maxY - minY,
    size,
  };
}
