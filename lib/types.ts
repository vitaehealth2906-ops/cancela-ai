// Tipos compartilhados entre cliente e servidor.

export interface Insights {
  nicho: string;
  tipoConteudo: string;
  cidades: string;
  pais: string;
  faixaEtaria: string;
  genero: string;
  seguidores: string;
  tom: string;
  descricao: string;
}

export interface NarrativaCancelamento {
  titulo: string;
  descricao: string;
}

export interface Persona {
  resumo: string;
  valores: string[];
  sensibilidades: string[];
  narrativas: NarrativaCancelamento[];
}

export type Chance = "baixa" | "media" | "alta";

export interface Achado {
  titulo: string;
  trecho: string;
  inicio_segundos: number;
  categoria: string;
  gravidade: number;
  explicacao: string;
  sugestao: string;
}

export interface Analise {
  chance_cancelamento: Chance;
  resumo: string;
  achados: Achado[];
  melhorias: string[];
}
