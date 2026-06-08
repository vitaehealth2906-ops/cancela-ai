// Geração da PERSONA do público + narrativas de cancelamento, a partir dos
// insights que o criador preenche (dados do Instagram dele).
//
// A ideia: entender QUEM é o público antes de julgar o vídeo, para que a
// análise seja calibrada por esse público — e não por "qualquer coisa".

import Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Insights, Persona } from "./types";

const PersonaSchema = z.object({
  resumo: z
    .string()
    .describe("Quem é esse público, em 2-3 frases (perfil, valores, expectativas)"),
  valores: z
    .array(z.string())
    .describe("O que esse público valoriza e espera do criador"),
  sensibilidades: z
    .array(z.string())
    .describe("Temas/gatilhos a que esse público específico reage mal"),
  narrativas: z
    .array(
      z.object({
        titulo: z.string().describe("Nome curto da narrativa de cancelamento"),
        descricao: z
          .string()
          .describe(
            "Como essa narrativa surgiria e por que ESSE público reagiria a ela"
          ),
      })
    )
    .describe("Possíveis narrativas de cancelamento específicas desse público"),
});

const RUBRICA_PERSONA = `Você é estrategista de comunidades e público para criadores de conteúdo (Instagram, TikTok, YouTube). A partir dos dados de público que o criador informa (insights do Instagram dele), seu trabalho é:

1. Montar uma PERSONA do público: quem são, o que valorizam, o que esperam desse criador.
2. Listar as possíveis NARRATIVAS DE CANCELAMENTO específicas desse público — ou seja, que tipos de fala/conteúdo ESSA audiência interpretaria mal e que poderiam virar uma onda de reações negativas.

PRINCÍPIOS:
- Seja ESPECÍFICO ao público informado, nunca genérico. Um público de humor ácido reage diferente de um público família/educativo.
- As narrativas devem refletir os valores e sensibilidades reais desse público, considerando nicho, faixa etária, gênero predominante, região e tom do conteúdo.
- Não exagere nem invente sensibilidades que não fazem sentido para esse público. O objetivo é precisão, não alarmismo.
- Pense em como um trecho poderia ser "clipável" e viralizar negativamente DENTRO dessa comunidade.

Responda em português do Brasil.`;

export async function gerarPersona(insights: Insights): Promise<Persona> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  const client = new Anthropic();

  const entrada = `DADOS DO PÚBLICO (insights do Instagram do criador):
- Nicho / tema: ${insights.nicho || "(não informado)"}
- Tipo de conteúdo: ${insights.tipoConteudo || "(não informado)"}
- Principais cidades: ${insights.cidades || "(não informado)"}
- País principal: ${insights.pais || "(não informado)"}
- Faixa etária predominante: ${insights.faixaEtaria || "(não informado)"}
- Gênero predominante: ${insights.genero || "(não informado)"}
- Faixa de seguidores: ${insights.seguidores || "(não informado)"}
- Tom do conteúdo: ${insights.tom || "(não informado)"}
- Descrição livre do público/conteúdo: ${insights.descricao || "(não informado)"}

Monte a persona e as narrativas de cancelamento específicas desse público.`;

  const resp = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: RUBRICA_PERSONA, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: entrada }],
    output_config: { effort: "medium", format: zodOutputFormat(PersonaSchema) },
  });

  if (!resp.parsed_output) {
    throw new Error("Não foi possível gerar a persona do público.");
  }
  return resp.parsed_output;
}
