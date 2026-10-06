# Firmador de PDF

Aplicación de escritorio (Windows) para agregar firmas manuscritas a un PDF usando una tableta gráfica o el mouse. Funciona sin conexión a internet. No hace firma digital criptográfica: la firma se estampa como un dibujo vectorial con fondo transparente.

Hecho con Tauri v2, React + TypeScript (Vite), `pdfjs-dist` (visor) y `pdf-lib` (guardado).

## Uso

1. **Abrir PDF** y elegir el archivo.
2. **Agregar firma**, dibujarla en el panel, elegir el color y **Aceptar**.
3. La firma sigue al mouse: clic en la página para colocarla. Después se puede arrastrar, cambiar de tamaño (esquinas o botones − / +), duplicar y eliminar (botón o Supr).
4. **Guardar como**: propone el nombre y la carpeta del original; aceptar lo sobrescribe.

No se admiten PDFs con contraseña o restricciones. Las firmas viven solo en memoria mientras la app está abierta.

## Desarrollo

Requisitos: Node.js, Rust y las [dependencias de Tauri para Windows](https://tauri.app/start/prerequisites/) (WebView2 ya viene con Windows 11).

```bash
npm install
npm run tauri dev
```

## Instalador

```bash
npm run tauri build
```

El instalador (`.exe`, NSIS) queda en `src-tauri/target/release/bundle/nsis/`. La primera vez Tauri descarga NSIS, así que ese paso necesita internet; la app instalada no.

## Versión con logos propios (opcional)

El repositorio trae la versión genérica. Para una con ícono y logotipo propios, pegá los archivos en `branding/`
(ver [branding/README.md](branding/README.md)) y corré `npm run tauri build`. Esa carpeta no se sube a git.

## Ajustes rápidos

- Tamaños permitidos de la firma: `STEPS` en `src/PlacedSignature.tsx`.
- Alto del panel de firma: `.modal` en `src/App.css`.

## Créditos

Federico Troncoso
