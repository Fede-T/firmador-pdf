// Genera los íconos de la app (src-tauri/icons). Usa branding/icon.svg|png si existe;
// si no, el ícono genérico del repositorio. Con --generic fuerza el genérico (para revertir).
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const GENERIC = "src/assets/icono-generico.svg";
const custom = ["branding/icon.svg", "branding/icon.png"].find(existsSync);
const src = process.argv.includes("--generic") ? GENERIC : (custom ?? GENERIC);
console.log("Íconos desde:", src);
execSync(`npx tauri icon "${src}"`, { stdio: "inherit" });
// Solo se usa Windows: se descartan los íconos de Android e iOS.
for (const d of ["android", "ios"]) rmSync(`src-tauri/icons/${d}`, { recursive: true, force: true });
