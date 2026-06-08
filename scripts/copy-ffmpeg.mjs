// Copia o "core" do ffmpeg.wasm para public/ffmpeg após o npm install.
// Roda automaticamente (postinstall) — assim qualquer máquina que rodar
// "npm install" já fica com o motor de áudio pronto, sem precisar versionar
// o binário de 32 MB no repositório.

import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const dest = join(root, "public", "ffmpeg");

try {
  if (!existsSync(join(src, "ffmpeg-core.wasm"))) {
    console.warn("[copy-ffmpeg] @ffmpeg/core não encontrado; pulando.");
    process.exit(0);
  }
  mkdirSync(dest, { recursive: true });
  copyFileSync(join(src, "ffmpeg-core.js"), join(dest, "ffmpeg-core.js"));
  copyFileSync(join(src, "ffmpeg-core.wasm"), join(dest, "ffmpeg-core.wasm"));
  console.log("[copy-ffmpeg] core copiado para public/ffmpeg ✓");
} catch (e) {
  console.warn("[copy-ffmpeg] falhou:", e.message);
}
