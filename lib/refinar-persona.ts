// Refino conversacional da persona: o criador diz, em linguagem natural, o que
// não bate ("o público é mais velho", "faltou citar tal tema"), e a IA reemite a
// persona inteira já ajustada + uma resposta amigável + a lista de mudanças.
//
// Modelo: Claude Opus 4.8 com effort "low" — refino é edição incremental, merece
// a inteligência do Opus mas leve e rápida. (Opus aceita effort; Haiku não.)

import Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PersonaSchema, entradaPersona } from "./persona";
import { ErroApi } from "./erros";
import type { Insights, Persona, Mudanca, TurnoRefino } from "./types";

const RefinoSchema = z.object({
  persona: PersonaSchema.describe("A persona COMPLETA já ajustada (não um patch)"),
  resposta: z
    .string()
    .describe("Resposta curta e amigável ao criador, dizendo o que você ajustou"),
  mudancas: z
    .array(
      z.object({
        campo: z
          .string()
          .describe("Parte ajustada: resumo, valores, sensibilidades ou narrativas"),
        resumo: z.string().describe("O que mudou, em 1 frase curta"),
      })
    )
    .describe("Lista das mudanças aplicadas (vazia se nada mudou)"),
});

const RUBRICA_REFINO = `Você é o mesmo estrategista de público que montou a persona. O criador está revisando e te diz, em linguagem natural, o que não bate ou o que faltou. Sua tarefa:

1. Ajustar a PERSONA conforme o pedido, mantendo tudo o que já estava certo. Reemita a persona INTEIRA (resumo, valores, sensibilidades, narrativas) já corrigida — nunca um pedaço só.
2. Escrever uma RESPOSTA curta e cordial ao criador (1-2 frases), confirmando o ajuste.
3. Listar as MUDANÇAS que você aplicou (campo + o que mudou).

PRINCÍPIOS:
- Respeite o pedido do criador: ele conhece o público dele melhor que ninguém.
- Mantenha a persona específica e realista — não inche com sensibilidades genéricas.
- Se o pedido for vago, faça a interpretação mais razoável e explique na resposta.

Responda em português do Brasil.`;

export async function refinarPersona(
  insights: Insights,
  personaAtual: Persona,
  correcao: string,
  historico: TurnoRefino[]
): Promise<{ persona: Persona; resposta: string; mudancas: Mudanca[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErroApi("CONFIG", "ANTHROPIC_API_KEY não configurada.");
  }
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });

  const conversa = historico
    .slice(-6)
    .map((t) => `${t.autor === "criador" ? "Criador" : "Você"}: ${t.texto}`)
    .join("\n");

  const entrada = `${entradaPersona(insights)}

PERSONA ATUAL (a ser ajustada):
${JSON.stringify(personaAtual, null, 2)}
${conversa ? `\nHISTÓRICO DA CONVERSA:\n${conversa}\n` : ""}
PEDIDO DE AJUSTE DO CRIADOR:
"${correcao}"

Ajuste a persona conforme o pedido e devolva a persona completa, a resposta e as mudanças.`;

  const resp = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: RUBRICA_REFINO, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: entrada }],
    output_config: { effort: "low", format: zodOutputFormat(RefinoSchema) },
  });

  if (!resp.parsed_output) {
    throw new ErroApi("MODELO", "Não foi possível refinar a persona.");
  }
  return resp.parsed_output;
}
