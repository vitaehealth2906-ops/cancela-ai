// Erros categorizados, compartilhados pelas rotas de API.
// A ideia: o servidor SEMPRE responde JSON com { erro, codigo }, e o cliente
// traduz o `codigo` numa mensagem amigável — nunca vaza stack trace nem o corpo
// cru de um provedor externo.

import Anthropic from "@anthropic-ai/sdk";

export class ErroApi extends Error {
  codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroApi";
    this.codigo = codigo;
  }
}

export function classificarErro(e: unknown): string {
  if (e instanceof ErroApi) return e.codigo;

  // Timeouts (AbortSignal.timeout do fetch, ou timeout do cliente Anthropic) e
  // chaves ausentes — detectados por nome/mensagem, sem depender de classes que
  // podem não existir nesta versão do SDK.
  if (e instanceof Error) {
    const txt = `${e.name} ${e.message}`.toLowerCase();
    if (e.name === "AbortError" || e.name === "TimeoutError" || txt.includes("timed out") || txt.includes("timeout")) {
      return "TIMEOUT";
    }
    if (txt.includes("anthropic_api_key") || txt.includes("groq_api_key")) return "CONFIG";
  }

  // Erros tipados do SDK Anthropic (APIError é a base garantida).
  if (e instanceof Anthropic.APIError) {
    if (e.status === 429) return "RATE";
    if (e.status === 401 || e.status === 403) return "CONFIG";
    if (!e.status) return "REDE"; // erro de conexão, sem status HTTP
    return "MODELO";
  }

  return "DESCONHECIDO";
}

const STATUS_POR_CODIGO: Record<string, number> = {
  VALIDACAO: 400,
  SEM_AUDIO: 422,
  AUDIO_GRANDE: 413,
  MODELO: 422,
  TIMEOUT: 504,
  RATE: 429,
  REDE: 502,
  CONFIG: 500,
  DESCONHECIDO: 500,
};

export function statusDe(codigo: string): number {
  return STATUS_POR_CODIGO[codigo] ?? 500;
}

// Mensagem curta e neutra para o corpo do JSON (o texto bonito vem do cliente).
const MENSAGEM_POR_CODIGO: Record<string, string> = {
  VALIDACAO: "Requisição inválida.",
  SEM_AUDIO: "Não foi possível extrair fala do vídeo.",
  AUDIO_GRANDE: "O áudio ficou grande demais.",
  MODELO: "O modelo não retornou um resultado válido.",
  TIMEOUT: "A operação demorou mais que o esperado.",
  RATE: "Muitas requisições agora. Tente novamente em instantes.",
  REDE: "Falha de conexão com um serviço externo.",
  CONFIG: "Configuração do servidor incompleta.",
  DESCONHECIDO: "Algo deu errado.",
};

export function corpoErro(codigo: string): { erro: string; codigo: string } {
  return { erro: MENSAGEM_POR_CODIGO[codigo] ?? MENSAGEM_POR_CODIGO.DESCONHECIDO, codigo };
}
