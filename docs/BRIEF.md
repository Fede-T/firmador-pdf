# Brief — Firmador de PDF (escritorio, offline)

> Herramienta independiente de la organización (mpn.com.ar). No comparte código, base de datos ni infraestructura con el sitio web ni con el futuro sistema de tesorería.

## Objetivo

Aplicación de escritorio para Windows 11 que permite abrir un PDF, agregarle firmas manuscritas dibujadas con una tableta gráfica, y guardar el resultado como un PDF nuevo. Nada más. Funciona 100% sin internet.

## Alcance

**Incluye**
- Abrir un PDF desde el disco.
- Ver todas las páginas con scroll.
- Dibujar una firma con la tableta (o mouse) en un panel de captura.
- Colocar la firma sobre cualquier página, moverla, redimensionarla y eliminarla.
- Agregar tantas firmas como se quiera, en cualquier página.
- Elegir el color del trazo (negro por defecto).
- Guardar como un PDF nuevo.

**No incluye (no construir)**
- Firma digital criptográfica ni certificados. Es una firma manuscrita estampada como dibujo.
- Guardado persistente de firmas. Viven solo en memoria mientras la app está abierta.
- Soporte de PDFs protegidos con contraseña o restricciones. Si aparece uno, mostrar un error claro.
- Cuentas, nube, sincronización, telemetría, actualizaciones automáticas, otros formatos de archivo.
- Edición de texto o de cualquier otro contenido del PDF.

## Entorno

- **Sistema operativo:** Windows 11 (Tauri permite Mac/Linux más adelante, pero no es requisito).
- **Tableta:** modelo genérico que se comporta como lápiz estándar de Windows (movimiento tipo mouse + presión). Usar Pointer Events (`pointerType`, `pressure`). Si `pressure` viene en 0 o 0.5 fijo (mouse), usar grosor constante.

## Stack

| Capa | Elección |
|---|---|
| Shell de escritorio | Tauri v2 |
| Interfaz | React + TypeScript (Vite) |
| Render del PDF en pantalla | `pdfjs-dist` (pdf.js) |
| Escritura del PDF final | `pdf-lib` |
| Abrir/guardar archivos | `@tauri-apps/plugin-dialog` y `@tauri-apps/plugin-fs` |
| Estilos | CSS estándar con variables (sin Tailwind) |

Mantener las dependencias al mínimo. No agregar librerías de estado, UI kits ni nada que no esté justificado.

## Comportamiento detallado

### Captura de firma
- Panel (modal) con un lienzo donde se dibuja con el lápiz.
- Se guarda como **trazos vectoriales** (listas de puntos con presión), no como imagen. Así escala sin perder calidad y el fondo es transparente por definición.
- El grosor varía con la presión. Suavizar las curvas (por ejemplo interpolación Catmull-Rom o similar) para que el trazo se sienta fluido y natural, parecido a Adobe.
- Botones: Borrar (limpiar el lienzo), Cancelar, Aceptar.
- Selector de color del trazo: negro por defecto, con una paleta corta (negro, azul oscuro y opcionalmente un selector libre).
- Al aceptar, la firma se coloca en el centro de la página visible, lista para mover.

### Colocación y edición
- La firma se arrastra libremente sobre la página.
- Se redimensiona desde las esquinas **manteniendo la proporción**.
- Se elimina con un botón visible al seleccionarla y con la tecla Supr.
- Una firma puede duplicarse (opcional, solo si es barato) para ponerla en varias páginas sin redibujar.
- Las firmas no pueden salirse de la página donde están.
- No hay deshacer/rehacer en la primera versión, salvo que resulte trivial.

### Guardado
- "Guardar como" con diálogo nativo. Nombre sugerido: `<original>-firmado.pdf`.
- Cada firma se estampa en la página, posición y tamaño elegidos, como **trazado vectorial** (no como imagen rasterizada), con fondo transparente.
- El texto y el contenido original del PDF no se modifican.
- Si el PDF tiene páginas rotadas o un `CropBox` distinto del `MediaBox`, la firma debe quedar en el lugar correcto.

## Puntos técnicos críticos

1. **Conversión de coordenadas.** La posición en pantalla (píxeles, origen arriba a la izquierda) debe coincidir exacto con la posición en el PDF (puntos, origen abajo a la izquierda). Guardar posición y tamaño de cada firma en coordenadas relativas a la página (porcentaje o puntos PDF), no en píxeles de pantalla, para que el zoom no afecte el resultado.
2. **Fluidez del trazo.** Usar `getCoalescedEvents()` para capturar todos los puntos del lápiz y dibujar con `requestAnimationFrame`. Deshabilitar gestos táctiles del navegador en el lienzo (`touch-action: none`).
3. **Rendimiento con PDFs grandes.** Renderizar solo las páginas visibles (carga diferida).
4. **Funcionamiento Offline** Debe ser capaz de funcionar sin acceso a internet.

## Criterios de aceptación

- [ ] Abre un PDF de varias páginas y lo muestra correctamente.
- [ ] Dibujar con la tableta produce un trazo suave con grosor variable.
- [ ] Se puede cambiar el color del trazo antes de aceptar.
- [ ] La firma se mueve, se redimensiona con proporción fija y se elimina.
- [ ] Se pueden colocar al menos 10 firmas en distintas páginas en una misma sesión.
- [ ] El PDF guardado se abre bien en Adobe Reader, Chrome y Edge, y cada firma queda exactamente donde se vio en pantalla.
- [ ] El fondo de la firma es transparente: no tapa el texto de abajo.
- [ ] El archivo original queda intacto.
- [ ] Funciona sin conexión a internet (probar con la red desactivada).
- [ ] Si se abre un PDF protegido o dañado, muestra un mensaje claro y no se cierra.
- [ ] Genera un instalador de Windows (`.msi` o `.exe`) con `npm run tauri build`.

## Diseño visual

Consistente con el sistema de diseño de la organización, versión mínima:

- Tipografías: **Poppins** (encabezados) y **Open Sans** (texto). Incluirlas **localmente** en la app (no desde Google Fonts), porque no hay internet.
- Acción principal: azul `#1E5AA8`; hover/active: `#15427B`; texto sobre el botón: blanco.
- Texto: gris `#1F2937` (fuerte), `#6B7280` (secundario). Bordes: `#E5E7EB`.
- Fondo de la aplicación: `#F8FAFC`. Las páginas del PDF sobre blanco con una sombra leve.
- Un solo tema, sin modo oscuro.
- Interfaz en español. Sin necesidad de i18n.
- Interfaz simple: barra superior con "Abrir PDF", "Agregar firma" y "Guardar como". Nada más a la vista.

## Seguridad y privacidad

- Sin llamadas de red. Configurar los permisos de Tauri con el mínimo necesario (solo diálogo y lectura/escritura de archivos elegidos por el usuario).
- Sin telemetría ni logs que contengan contenido de documentos.
- Las firmas nunca se escriben a disco fuera del PDF final.

## Entrega

- Repositorio con README breve: cómo correr en desarrollo, cómo generar el instalador.
- Código en TypeScript, comentado donde la lógica no sea obvia (sobre todo la conversión de coordenadas).
- Sin sobreingeniería: sin backend, sin base de datos, sin abstracciones "por si acaso".
