// Transcrição de áudio/vídeo via Whisper na API da Groq (tier gratuito).
//
// A Groq expõe um endpoint compatível com a OpenAI e roda o whisper-large-v3.
// Recebe o ÁUDIO já extraído/comprimido (Blob) — não o vídeo bruto.
// Limite no tier gratuito: 25 MB por arquivo.

import { ErroApi } from "./erros";

export interface TranscriptSegment {
  inicio: number; // segundos
  fim: number; // segundos
  texto: string;
}

export interface TranscriptResult {
  texto: string;
  idioma?: string;
  segmentos: TranscriptSegment[];
}

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO = "whisper-large-v3";
const LIMITE_BYTES = 25 * 1024 * 1024; // 25 MB (tier gratuito da Groq)
const TIMEOUT_MS = 40_000;

export async function transcreverAudio(
  audio: Blob,
  filename = "audio.mp3"
): Promise<TranscriptResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ErroApi("CONFIG", "GROQ_API_KEY não configurada.");
  }

  if (audio.size > LIMITE_BYTES) {
    throw new ErroApi("AUDIO_GRANDE", "O áudio extraído passou de 25 MB.");
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", MODELO);
  // verbose_json devolve segmentos com marcação de tempo (localiza cada risco).
  form.append("response_format", "verbose_json");

  let resp: Response;
  try {
    resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // Timeout/abort ou falha de rede — não vaza detalhe do provedor.
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      throw new ErroApi("TIMEOUT", "A transcrição demorou mais que o esperado.");
    }
    throw new ErroApi("REDE", "Falha de conexão ao transcrever o áudio.");
  }

  if (!resp.ok) {
    // Nunca repassamos o corpo cru da Groq para o cliente.
    if (resp.status === 429) {
      throw new ErroApi("RATE", "Limite de transcrições atingido. Tente em 1 minuto.");
    }
    throw new ErroApi("REDE", `Falha na transcrição (HTTP ${resp.status}).`);
  }

  const data = (await resp.json()) as {
    text?: string;
    language?: string;
    segments?: Array<{ start: number; end: number; text?: string }>;
  };

  return {
    texto: data.text?.trim() ?? "",
    idioma: data.language,
    segmentos: (data.segments ?? []).map((s) => ({
      inicio: s.start,
      fim: s.end,
      texto: (s.text ?? "").trim(),
    })),
  };
}
