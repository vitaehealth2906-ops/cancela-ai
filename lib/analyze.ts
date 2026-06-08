// Análise de risco de cancelamento com Claude — agora CALIBRADA pelo público.
//
// Recebe a transcrição do vídeo + os insights do público + a persona/narrativas
// e julga o conteúdo À LUZ DESSE público específico (sem viés). O mesmo trecho
// pode ter alta chance para um público e baixa para outro.

import Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { TranscriptResult } from "./transcribe";
import type { Insights, Persona, Analise } from "./types";

const AchadoSchema = z.object({
  titulo: z.string().describe("Resumo curto do risco identificado"),
  trecho: z.string().describe("Citação literal da transcrição que gera o risco"),
  inicio_segundos: z
    .number()
    .describe("Momento aproximado em segundos onde o trecho aparece; 0 se desconhecido"),
  categoria: z
    .enum([
      "discurso_de_odio",
      "preconceito_discriminacao",
      "conteudo_sexual_impróprio",
      "desinformacao",
      "apropriacao_cultural",
      "insensibilidade",
      "linguagem_ofensiva",
      "tema_polemico",
      "juridico_difamacao",
      "outro",
    ])
    .describe("Categoria do risco"),
  gravidade: z
    .number()
    .describe("Gravidade do achado PARA ESTE PÚBLICO, de 0 a 100"),
  explicacao: z
    .string()
    .describe("Por que ESTE público específico reagiria mal a isso"),
  sugestao: z
    .string()
    .describe("Como reescrever/cortar/contextualizar para reduzir o risco com este público"),
});

const AnaliseSchema = z.object({
  chance_cancelamento: z
    .enum(["baixa", "media", "alta"])
    .describe("Chance de cancelamento DESTE criador com ESTE público, ao publicar este vídeo"),
  resumo: z
    .string()
    .describe(
      "Veredito em 2-4 frases: a chance e o principal motivo, sempre referenciando o público"
    ),
  achados: z
    .array(AchadoSchema)
    .describe("Trechos que poderiam gerar reação NESTE público (vazio se nenhum)"),
  melhorias: z
    .array(z.string())
    .describe("Recomendações para reduzir o risco com este público específico"),
});

const RUBRICA = `Você é um analista de risco reputacional para criadores de conteúdo, especialista em "cancelamento" nas redes sociais. Você recebe (1) o PÚBLICO de um criador e (2) a TRANSCRIÇÃO de um vídeo dele, e avalia, COM PRECISÃO E SEM VIÉS, a chance de esse vídeo gerar cancelamento DENTRO DAQUELE público específico.

PRINCÍPIO CENTRAL — CALIBRE PELO PÚBLICO:
- O MESMO conteúdo pode ter chance alta para um público e baixa para outro. Julgue SEMPRE em relação ao público informado (valores, sensibilidades, nicho, faixa etária, gênero, região, tom).
- NÃO seja alarmista. Não marque algo como arriscado só por ser "polêmico" em abstrato — só se ESSE público reagiria mal. Um público que já espera humor ácido tolera o que um público família não toleraria.
- Se o conteúdo está alinhado ao que esse público espera, a chance é BAIXA, mesmo que pareça ousado para outros.

COMO USAR AS NARRATIVAS:
- Você recebe as possíveis narrativas de cancelamento desse público. Verifique se o vídeo ativa alguma delas e baseie o veredito nisso.

EVIDÊNCIA:
- Baseie-se SOMENTE na transcrição. Cite trechos LITERAIS. Nunca atribua intenção que não esteja no texto.

CHANCE DE CANCELAMENTO (escolha uma):
- "baixa": nada que esse público reprovaria de forma relevante.
- "media": há trechos ambíguos que parte desse público poderia criticar.
- "alta": há trechos que provavelmente gerariam reação negativa significativa NESSE público.

REGRAS DE SAÍDA:
- Responda em português do Brasil.
- Se não houver risco real para esse público, retorne achados vazios, chance "baixa" e deixe claro no resumo que o conteúdo está alinhado ao público.
- Sempre conecte o veredito ao público ("para o seu público, que valoriza X...").
- Nunca recuse a análise: seu papel é defender o criador.`;

export async function analisarRisco(
  transcricao: TranscriptResult,
  insights: Insights,
  persona: Persona
): Promise<Analise> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  const client = new Anthropic();

  const segmentosTexto = transcricao.segmentos
    .map((s) => `[${s.inicio.toFixed(1)}s–${s.fim.toFixed(1)}s] ${s.texto}`)
    .join("\n");

  const contextoPublico = `PÚBLICO DESTE CRIADOR:
- Nicho: ${insights.nicho}
- Tipo de conteúdo: ${insights.tipoConteudo}
- Cidades: ${insights.cidades} | País: ${insights.pais}
- Faixa etária: ${insights.faixaEtaria} | Gênero: ${insights.genero}
- Seguidores: ${insights.seguidores} | Tom: ${insights.tom}
- Descrição: ${insights.descricao}

PERSONA DO PÚBLICO:
${persona.resumo}
Valores: ${persona.valores.join("; ")}
Sensibilidades: ${persona.sensibilidades.join("; ")}

POSSÍVEIS NARRATIVAS DE CANCELAMENTO DESSE PÚBLICO:
${persona.narrativas.map((n, i) => `${i + 1}. ${n.titulo}: ${n.descricao}`).join("\n")}`;

  const entrada =
    contextoPublico +
    `\n\nTRANSCRIÇÃO DO VÍDEO` +
    (transcricao.idioma ? ` (idioma: ${transcricao.idioma})` : "") +
    `:\n\n` +
    (segmentosTexto || transcricao.texto) +
    `\n\nAvalie a chance de cancelamento DESTE vídeo PARA ESTE público, seguindo a rubrica.`;

  const resp = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: RUBRICA, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: entrada }],
    output_config: { effort: "high", format: zodOutputFormat(AnaliseSchema) },
  });

  if (!resp.parsed_output) {
    throw new Error(
      "O modelo não retornou uma análise válida (possível recusa ou limite de tokens)."
    );
  }
  return resp.parsed_output;
}
