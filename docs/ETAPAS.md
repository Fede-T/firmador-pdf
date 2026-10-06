# Etapas de desarrollo

Cada etapa se verifica antes de pasar a la siguiente. No se hace push hasta que la etapa esté aprobada.

## 1. Visor de PDF — hecha, en verificación
- Dependencias, plugins de Tauri (diálogo y fs) con permisos mínimos y fuentes locales.
- "Abrir PDF" con diálogo nativo.
- Páginas con scroll y carga diferida, ajustadas al ancho de la ventana.
- Errores claros para PDFs protegidos o dañados.
- Al abrir otro PDF, el scroll vuelve al inicio.

## 2. Captura de firma
- Modal con lienzo (Pointer Events, `getCoalescedEvents`, `requestAnimationFrame`, `touch-action: none`).
- Trazos vectoriales con presión (grosor constante si es mouse) y suavizado Catmull-Rom.
- Paleta de color (negro, azul oscuro, selector libre).
- Botones Borrar, Cancelar y Aceptar.

## 3. Colocación y edición
- La firma sigue el rastro del mouse y se aplica al momento de clickear (sigue siendo posible moverla arrastrandola).
- Arrastrar, redimensionar desde las esquinas con proporción fija, eliminar con botón y con Supr.
- Límites de página, coordenadas relativas a la página (independientes del zoom), duplicar.
- Mínimo 10 firmas en distintas páginas.

## 4. Guardado
- "Guardar como" con nombre sugerido `<original>.pdf`.
- Estampado vectorial con `pdf-lib`, fondo transparente.
- Páginas rotadas y CropBox distinto de MediaBox.

## 5. Cierre
- CSP estricta y revisión de permisos.
- Prueba offline.
- README (desarrollo e instalador) y `npm run tauri build`.
- Crédito y ícono de la app.
- Revisión de los criterios de aceptación del BRIEF.
