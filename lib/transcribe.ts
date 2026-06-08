// Transcrição de áudio/vídeo via Whisper na API da Groq (tier gratuito).
//
// A Groq expõe um endpoint compatível com a OpenAI e roda o whisper-large-v3.
// Aceita o arquivo de vídeo diretamente (mp4, webm, mpeg, etc.) e extrai o
// áudio do lado do servidor — não precisamos de ffmpeg para o caso comum.
// Limite no tier gratuito: 25 MB por arquivo.

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

// Recebe o ÁUDIO já extraído/comprimido (Blob), não o vídeo bruto.
export async function transcreverAudio(
  audio: Blob,
  filename = "audio.mp3"
): Promise<TranscriptResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY não configurada. Crie uma chave em console.groq.com e adicione no .env.local."
    );
  }

  if (audio.size > LIMITE_BYTES) {
    throw new Error(
      `O áudio extraído ficou com ${(audio.size / 1024 / 1024).toFixed(
        1
      )} MB, acima do limite de 25 MB. ` +
        "O vídeo é muito longo — recorte um trecho menor."
    );
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", MODELO);
  // verbose_json devolve os segmentos com marcação de tempo,
  // o que permite localizar exatamente ONDE está cada risco.
  form.append("response_format", "verbose_json");

  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => "");
    throw new Error(
      `Falha na transcrição (HTTP ${resp.status}). ${detalhe.slice(0, 300)}`
    );
  }

  const data = (await resp.json()) as {
    text: string;
    language?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  };

  return {
    texto: data.text?.trim() ?? "",
    idioma: data.language,
    segmentos: (data.segments ?? []).map((s) => ({
      inicio: s.start,
      fim: s.end,
      texto: s.text.trim(),
    })),
  };
}
