// Genera los íconos de la app (src-tauri/icons). Usa branding/icon.svg|png si existe;
// si no, el ícono genérico del repositorio.
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const src = ["branding/icon.svg", "branding/icon.png"].find(existsSync) ?? "src/assets/icono-generico.svg";
console.log("Íconos desde:", src);
execSync(`npx tauri icon "${src}"`, { stdio: "inherit" });
// Solo se usa Windows: se descartan los íconos de Android e iOS.
for (const d of ["android", "ios"]) rmSync(`src-tauri/icons/${d}`, { recursive: true, force: true });
