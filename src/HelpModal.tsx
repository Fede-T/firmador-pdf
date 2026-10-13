import { useEffect } from "react";

const STEPS: [string, string][] = [
  ["Abrí un PDF", "Con «Abrir PDF» elegí el archivo. Se ven todas las páginas con scroll."],
  ["Dibujá tu firma", "«Agregar firma» abre un panel: firmá con la tableta o el mouse, elegí el color y tocá Aceptar. Borrar limpia el panel."],
  ["Colocala", "La firma te sigue por la pantalla: hacé clic en la página donde la querés. Esc cancela."],
  ["Ajustala", "Arrastrala para moverla. Las esquinas cambian el tamaño con libertad (con Shift, de a pasos). Los botones − y + cambian de a pasos. El círculo de arriba la gira (con Shift, de a 15°)."],
  ["Menú de la firma", "Sobre la firma seleccionada: tamaño original, restablecer giro, duplicar (para ponerla en otra página) y eliminar. También podés eliminarla con Supr."],
  ["Guardá", "«Guardar como» propone el mismo nombre y carpeta: aceptar sobrescribe el original, y Windows te pide confirmar. Si elegís otro nombre, el original no se toca."],
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onPointerDown={onClose}>
      <div className="modal help" role="dialog" aria-label="Ayuda" onPointerDown={(e) => e.stopPropagation()}>
        <h2>Cómo usar el firmador</h2>
        <ol>
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <div className="actions">
          <button className="primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
