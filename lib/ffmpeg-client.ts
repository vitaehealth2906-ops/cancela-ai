// Extração de áudio NO NAVEGADOR usando ffmpeg.wasm.
//
// Por que no navegador: a Vercel limita uploads a ~4,5 MB por requisição.
// Em vez de enviar o vídeo inteiro, extraímos e comprimimos só o áudio aqui
// no cliente (MP3 mono 16 kHz, 24 kbps) e enviamos apenas esse arquivo pequeno.
//
// O "core" (motor wasm, ~32 MB) é hospedado junto do app em /ffmpeg, então
// não dependemos de CDN externo. Ele é baixado uma vez e fica em cache.

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let carregado = false;

async function obterFFmpeg(aoProgredir?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg && carregado) return ffmpeg;

  ffmpeg = new FFmpeg();
  aoProgredir?.("Preparando o processador de áudio (primeira vez baixa ~32 MB)…");

  const base = "/ffmpeg";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });

  carregado = true;
  return ffmpeg;
}

const LIMITE_AUDIO = 4.3 * 1024 * 1024; // margem segura abaixo dos 4,5 MB da Vercel

export async function extrairAudioNoNavegador(
  arquivo: File,
  aoProgredir?: (msg: string) => void
): Promise<Blob> {
  const ff = await obterFFmpeg(aoProgredir);

  const ext = (arquivo.name.split(".").pop() || "mp4").toLowerCase();
  const entrada = `entrada.${ext}`;
  const saida = "saida.mp3";

  aoProgredir?.("Lendo o vídeo…");
  await ff.writeFile(entrada, await fetchFile(arquivo));

  aoProgredir?.("Extraindo e comprimindo o áudio…");
  await ff.exec([
    "-i", entrada,
    "-vn", // descarta o vídeo
    "-ac", "1", // mono
    "-ar", "16000", // 16 kHz
    "-b:a", "24k", // 24 kbps (ótimo para fala/ASR)
    "-y",
    saida,
  ]);

  const data = (await ff.readFile(saida)) as Uint8Array;

  // Limpa os arquivos da memória do wasm.
  await ff.deleteFile(entrada).catch(() => {});
  await ff.deleteFile(saida).catch(() => {});

  if (data.byteLength > LIMITE_AUDIO) {
    const min = Math.floor(LIMITE_AUDIO / (24 * 1024 / 8) / 60);
    throw new Error(
      `O áudio extraído ficou grande demais para enviar (vídeo muito longo). ` +
        `Envie um trecho de até ~${min} minutos.`
    );
  }

  return new Blob([new Uint8Array(data)], { type: "audio/mpeg" });
}
