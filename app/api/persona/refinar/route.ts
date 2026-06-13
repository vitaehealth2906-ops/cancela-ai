import { NextRequest, NextResponse } from "next/server";
import { refinarPersona } from "@/lib/refinar-persona";
import { classificarErro, statusDe, corpoErro } from "@/lib/erros";
import type { Insights, Persona, TurnoRefino } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: {
      insights?: Insights;
      personaAtual?: Persona;
      correcao?: string;
      historico?: TurnoRefino[];
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(corpoErro("VALIDACAO"), { status: 400 });
    }

    const { insights, personaAtual, correcao, historico } = body;
    if (!insights || !personaAtual || typeof correcao !== "string" || !correcao.trim()) {
      return NextResponse.json(
        { erro: "Escreva o que você quer ajustar no público.", codigo: "VALIDACAO" },
        { status: 400 }
      );
    }

    const resultado = await refinarPersona(
      insights,
      personaAtual,
      correcao.trim(),
      Array.isArray(historico) ? historico : []
    );
    return NextResponse.json(resultado);
  } catch (e) {
    const codigo = classificarErro(e);
    return NextResponse.json(corpoErro(codigo), { status: statusDe(codigo) });
  }
}
