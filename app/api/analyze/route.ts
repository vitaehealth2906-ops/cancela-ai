import { NextRequest, NextResponse } from "next/server";
import { transcreverAudio } from "@/lib/transcribe";
import { analisarRisco } from "@/lib/analyze";
import type { Insights, Persona } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // segundos (limite do plano gratuito da Vercel)

// O navegador já extrai e comprime o áudio. Aqui só recebemos esse áudio pequeno.
const LIMITE_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const insightsRaw = form.get("insights");
    const personaRaw = form.get("persona");

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ erro: "Nenhum áudio recebido." }, { status: 400 });
    }
    if (audio.size > LIMITE_AUDIO_BYTES) {
      return NextResponse.json(
        { erro: "O áudio é grande demais. Envie um vídeo mais curto." },
        { status: 413 }
      );
    }
    if (typeof insightsRaw !== "string" || typeof personaRaw !== "string") {
      return NextResponse.json(
        { erro: "Dados do público ausentes. Refaça o onboarding." },
        { status: 400 }
      );
    }

    const insights = JSON.parse(insightsRaw) as Insights;
    const persona = JSON.parse(personaRaw) as Persona;

    // 1) Transcreve o áudio (Whisper via Groq)
    const transcricao = await transcreverAudio(audio, "audio.mp3");
    if (!transcricao.texto) {
      return NextResponse.json(
        { erro: "Não foi possível extrair fala do vídeo. Verifique se há áudio audível." },
        { status: 422 }
      );
    }

    // 2) Analisa o risco À LUZ DO PÚBLICO (Claude)
    const analise = await analisarRisco(transcricao, insights, persona);

    return NextResponse.json({
      transcricao: { idioma: transcricao.idioma, texto: transcricao.texto },
      analise,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
