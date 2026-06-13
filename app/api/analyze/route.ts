import { NextRequest, NextResponse } from "next/server";
import { transcreverAudio } from "@/lib/transcribe";
import { analisarRisco } from "@/lib/analyze";
import { classificarErro, statusDe, corpoErro } from "@/lib/erros";
import type { Insights, Persona } from "@/lib/types";

export const runtime = "nodejs";
// Fica em 60s de propósito: o plano gratuito da Vercel limita (clampa) a 60s, e
// a defesa real contra timeout é o effort/tokens menores em lib/analyze.ts.
export const maxDuration = 60;

// O navegador já extrai e comprime o áudio. Aqui só recebemos esse áudio pequeno.
const LIMITE_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const insightsRaw = form.get("insights");
    const personaRaw = form.get("persona");

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { erro: "Nenhum áudio recebido.", codigo: "VALIDACAO" },
        { status: 400 }
      );
    }
    if (audio.size > LIMITE_AUDIO_BYTES) {
      return NextResponse.json(
        { erro: "O áudio é grande demais. Envie um trecho mais curto.", codigo: "AUDIO_GRANDE" },
        { status: 413 }
      );
    }
    if (typeof insightsRaw !== "string" || typeof personaRaw !== "string") {
      return NextResponse.json(
        { erro: "Dados do público ausentes. Refaça o onboarding.", codigo: "VALIDACAO" },
        { status: 400 }
      );
    }

    let insights: Insights;
    let persona: Persona;
    try {
      insights = JSON.parse(insightsRaw) as Insights;
      persona = JSON.parse(personaRaw) as Persona;
    } catch {
      return NextResponse.json(corpoErro("VALIDACAO"), { status: 400 });
    }

    // 1) Transcreve o áudio (Whisper via Groq)
    const transcricao = await transcreverAudio(audio, "audio.mp3");
    if (!transcricao.texto) {
      return NextResponse.json(
        {
          erro: "Não foi possível extrair fala do vídeo. Verifique se há áudio audível.",
          codigo: "SEM_AUDIO",
        },
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
    const codigo = classificarErro(e);
    return NextResponse.json(corpoErro(codigo), { status: statusDe(codigo) });
  }
}
