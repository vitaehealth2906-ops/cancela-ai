// Extração de áudio NO NAVEGADOR usando ffmpeg.wasm.
//
// Por que no navegador: a Vercel limita uploads a ~4,5 MB por requisição. Em vez
// de enviar o vídeo inteiro, extraímos e comprimimos só o áudio aqui no cliente
// (MP3 mono 16 kHz, 24 kbps) e enviamos apenas esse arquivo pequeno.
//
// Robustez:
// - O @ffmpeg/ffmpeg já roda o core wasm num Web Worker interno, então o trabalho
//   pesado NÃO bloqueia a thread da UI (fim do "congelar" com vídeo grande).
// - Reportamos progresso REAL via ff.on("progress") -> barra de %.
// - `-t 1500` corta em 25 min, garantindo que o áudio não estoure o teto de envio.
// - Devolvemos { promessa, cancelar }: cancelar() encerra o worker (terminate) e
//   reinicia o motor, de modo que dá pra abortar uma extração longa.

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let carregado = false;

const LIMITE_AUDIO = 4.3 * 1024 * 1024; // margem segura abaixo dos 4,5 MB da Vercel
const CORTE_SEGUNDOS = "1500"; // 25 min

export type Progresso = { etapa?: string; pct?: number };

function erroCom(codigo: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { codigo });
}

async function obterFFmpeg(aoProgredir?: (p: Progresso) => void): Promise<FFmpeg> {
  if (ffmpeg && carregado) return ffmpeg;

  ffmpeg = new FFmpeg();
  aoProgredir?.({ etapa: "Preparando o processador de áudio (na 1ª vez baixa ~32 MB)…" });

  const base = "/ffmpeg";
  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
  } catch {
    ffmpeg = null;
    throw erroCom("WORKER", "Não consegui preparar o processador de áudio.");
  }

  carregado = true;
  return ffmpeg;
}

export interface SessaoExtracao {
  promessa: Promise<Blob>;
  cancelar: () => void;
}

export function extrairAudioNoNavegador(
  arquivo: File,
  aoProgredir?: (p: Progresso) => void
): SessaoExtracao {
  let cancelado = false;

  function cancelar() {
    cancelado = true;
    try {
      ffmpeg?.terminate();
    } catch {
      /* ignore */
    }
    // Força recarregar o motor na próxima extração.
    ffmpeg = null;
    carregado = false;
  }

  const promessa = (async (): Promise<Blob> => {
    const ff = await obterFFmpeg(aoProgredir);
    if (cancelado) throw erroCom("CANCELADO", "Extração cancelada.");

    const onProgress = ({ progress }: { progress: number }) => {
      const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
      aoProgredir?.({ pct });
    };
    ff.on("progress", onProgress);

    const ext = (arquivo.name.split(".").pop() || "mp4").toLowerCase();
    const entrada = `entrada.${ext}`;
    const saida = "saida.mp3";

    try {
      aoProgredir?.({ etapa: "Lendo o vídeo…", pct: 0 });
      await ff.writeFile(entrada, await fetchFile(arquivo));
      if (cancelado) throw erroCom("CANCELADO", "Extração cancelada.");

      aoProgredir?.({ etapa: "Extraindo e comprimindo o áudio…" });
      await ff.exec([
        "-i", entrada,
        "-t", CORTE_SEGUNDOS, // no máximo ~25 min de áudio
        "-vn", // descarta o vídeo
        "-ac", "1", // mono
        "-ar", "16000", // 16 kHz
        "-b:a", "24k", // 24 kbps (ótimo para fala/ASR)
        "-y",
        saida,
      ]);
      if (cancelado) throw erroCom("CANCELADO", "Extração cancelada.");

      const data = (await ff.readFile(saida)) as Uint8Array;
      await ff.deleteFile(entrada).catch(() => {});
      await ff.deleteFile(saida).catch(() => {});

      if (data.byteLength > LIMITE_AUDIO) {
        throw erroCom(
          "AUDIO_GRANDE",
          "O áudio extraído ficou grande demais. Envie um trecho mais curto."
        );
      }

      aoProgredir?.({ etapa: "Áudio pronto.", pct: 100 });
      return new Blob([new Uint8Array(data)], { type: "audio/mpeg" });
    } catch (e) {
      if (cancelado) throw erroCom("CANCELADO", "Extração cancelada.");
      if (e && typeof e === "object" && "codigo" in e) throw e;
      throw erroCom("WORKER", "Não consegui preparar o áudio desse arquivo.");
    } finally {
      try {
        ff.off("progress", onProgress);
      } catch {
        /* ignore */
      }
    }
  })();

  return { promessa, cancelar };
}
