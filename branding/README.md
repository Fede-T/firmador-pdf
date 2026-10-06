# Branding personalizado (opcional)

El repositorio trae la versión genérica, sin logos. Para una versión con identidad propia,
copiá tus archivos en esta carpeta con **estos nombres exactos** (todo lo demás de la carpeta
se ignora en git, así que tus logos no se suben):

| Archivo | Para qué | Formato |
|---|---|---|
| `icon.svg` (o `icon.png`) | Ícono de la app: barra de tareas, esquina de la ventana, `.exe` e instalador | Cuadrado. SVG, o PNG de 1024×1024 o más |
| `logotype.svg` (o `logotype.png`) | Logotipo (logo + texto) que se muestra sobre "Abrí un PDF para empezar" | Horizontal, fondo transparente. SVG, o PNG de unos 1200 px de ancho |

Consejos:
- En los SVG, convertí los textos a curvas/trazados ("outline" / "create outlines"). Si no, dependen de
  tipografías instaladas y pueden verse distinto.
- El logotipo se muestra sobre fondo claro (`#F8FAFC`).
- Los dos archivos son independientes: podés poner solo uno.

Para aplicarlo: `npm run tauri build` (genera los íconos y arma el instalador).
Para probarlo en desarrollo: `npm run icons` y luego `npm run tauri dev`.
Para volver al ícono genérico (aunque haya archivos acá): `npm run icons:generic`.