import { NextRequest, NextResponse } from "next/server";
import { gerarPersona } from "@/lib/persona";
import { classificarErro, statusDe, corpoErro } from "@/lib/erros";
import type { Insights } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let insights: Insights;
    try {
      insights = (await req.json()) as Insights;
    } catch {
      return NextResponse.json(corpoErro("VALIDACAO"), { status: 400 });
    }
    if (!insights || !insights.nicho?.trim()) {
      return NextResponse.json(
        { erro: "Preencha pelo menos o nicho do seu público.", codigo: "VALIDACAO" },
        { status: 400 }
      );
    }
    const persona = await gerarPersona(insights);
    return NextResponse.json({ persona });
  } catch (e) {
    const codigo = classificarErro(e);
    return NextResponse.json(corpoErro(codigo), { status: statusDe(codigo) });
  }
}
