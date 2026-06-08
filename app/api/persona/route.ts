import { NextRequest, NextResponse } from "next/server";
import { gerarPersona } from "@/lib/persona";
import type { Insights } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const insights = (await req.json()) as Insights;
    if (!insights || !insights.nicho) {
      return NextResponse.json(
        { erro: "Preencha pelo menos o nicho do seu público." },
        { status: 400 }
      );
    }
    const persona = await gerarPersona(insights);
    return NextResponse.json({ persona });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
