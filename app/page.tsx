"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Film,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  CheckCircle2,
  X,
  RotateCcw,
  ArrowRight,
  Users,
  Heart,
  Flame,
  Pencil,
} from "lucide-react";
import type { Insights, Persona, Analise, Chance, Mudanca, TurnoRefino, ErroUX } from "@/lib/types";
import { extrairAudioNoNavegador, type SessaoExtracao } from "@/lib/ffmpeg-client";

type Resposta = { transcricao: { idioma?: string; texto: string }; analise: Analise };

const VAZIO: Insights = {
  nicho: "",
  tipoConteudo: "",
  cidades: "",
  pais: "",
  faixaEtaria: "",
  genero: "",
  seguidores: "",
  tom: "",
  descricao: "",
};

const CHANCE: Record<Chance, { label: string; cls: string; dot: string }> = {
  baixa: { label: "Baixa chance de cancelamento", cls: "bg-ok-bg text-ok-fg ring-ok-border", dot: "#5e8b6f" },
  media: { label: "Média chance de cancelamento", cls: "bg-[#faf1df] text-[#8a5a1f] ring-[#e8d3a6]", dot: "#c9742e" },
  alta: { label: "Alta chance de cancelamento", cls: "bg-danger-bg text-danger-fg ring-danger-border", dot: "#b5503f" },
};

const CATEGORIA_LABEL: Record<string, string> = {
  discurso_de_odio: "Discurso de ódio",
  preconceito_discriminacao: "Preconceito / discriminação",
  conteudo_sexual_impróprio: "Conteúdo sexual impróprio",
  desinformacao: "Desinformação",
  apropriacao_cultural: "Apropriação cultural",
  insensibilidade: "Insensibilidade",
  linguagem_ofensiva: "Linguagem ofensiva",
  tema_polemico: "Tema polêmico",
  juridico_difamacao: "Jurídico / difamação",
  outro: "Outro",
};

const SUGESTOES_REFINO = [
  "O público é mais velho do que parece",
  "O tom é mais ácido, aguentam mais",
  "Faltou um tema sensível importante",
  "Eles não idolatram nenhuma figura",
];

const ERROS: Record<string, ErroUX> = {
  FORMATO: {
    codigo: "FORMATO",
    titulo: "Esse arquivo não dá para analisar",
    corpo: "Envie um vídeo ou áudio (MP4, MOV, WEBM ou MP3).",
    acao: "Escolher outro arquivo",
  },
  SEM_AUDIO: {
    codigo: "SEM_AUDIO",
    titulo: "Não ouvi nenhuma fala aqui",
    corpo: "O vídeo parece não ter fala audível. Envie um com narração ou diálogo.",
  },
  AUDIO_GRANDE: {
    codigo: "AUDIO_GRANDE",
    titulo: "Vídeo longo demais para uma análise só",
    corpo: "Mesmo cortando, o áudio passou do limite. Envie um trecho mais curto.",
  },
  TIMEOUT: {
    codigo: "TIMEOUT",
    titulo: "A análise demorou mais que o esperado",
    corpo: "Pode ter sido a conexão ou um pico de uso.",
    acao: "Tentar de novo",
  },
  RATE: {
    codigo: "RATE",
    titulo: "Muita gente analisando agora",
    corpo: "Atingimos o limite momentâneo. Tente de novo em cerca de 1 minuto.",
    acao: "Tentar de novo",
  },
  REDE: {
    codigo: "REDE",
    titulo: "Perdi a conexão no meio",
    corpo: "Verifique sua internet e tente de novo.",
    acao: "Tentar de novo",
  },
  CONFIG: {
    codigo: "CONFIG",
    titulo: "Algo do nosso lado precisa de ajuste",
    corpo: "A configuração do servidor está incompleta. Já estamos vendo isso.",
  },
  WORKER: {
    codigo: "WORKER",
    titulo: "Não consegui preparar o áudio",
    corpo: "Esse arquivo deu problema ao extrair o áudio. Tente outro arquivo.",
    acao: "Tentar de novo",
  },
  MODELO: {
    codigo: "MODELO",
    titulo: "A análise não saiu como esperado",
    corpo: "O modelo não devolveu um resultado válido.",
    acao: "Tentar de novo",
  },
  DESCONHECIDO: {
    codigo: "DESCONHECIDO",
    titulo: "Algo deu errado aqui",
    corpo: "Tente de novo em instantes.",
    acao: "Tentar de novo",
  },
};

function traduzErro(codigo?: string): ErroUX {
  return ERROS[codigo ?? "DESCONHECIDO"] ?? ERROS.DESCONHECIDO;
}

function mensagemOnb(codigo?: string): string {
  switch (codigo) {
    case "RATE":
      return "Muita gente gerando agora. Tente de novo em cerca de 1 minuto.";
    case "TIMEOUT":
      return "Demorou mais que o esperado. Tente de novo.";
    case "CONFIG":
      return "Configuração do servidor incompleta. Já estamos vendo isso.";
    default:
      return "Não consegui estudar o público agora. Tente de novo.";
  }
}

function corGravidade(g: number) {
  if (g >= 76) return "#b5503f";
  if (g >= 51) return "#c9742e";
  if (g >= 21) return "#c99a3e";
  return "#5e8b6f";
}

function fmtTempo(s: number) {
  if (!s || s < 0) return null;
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  return `${m}:${seg.toString().padStart(2, "0")}`;
}

function lerDuracao(f: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(f);
      const el = document.createElement(f.type.startsWith("audio/") ? "audio" : "video");
      const limpar = () => URL.revokeObjectURL(url);
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        const d = el.duration;
        limpar();
        resolve(Number.isFinite(d) ? d : 0);
      };
      el.onerror = () => {
        limpar();
        resolve(0);
      };
      setTimeout(() => {
        limpar();
        resolve(0);
      }, 4000);
      el.src = url;
    } catch {
      resolve(0);
    }
  });
}

/* ----------------------------- Componentes UI ----------------------------- */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
      <span className="h-px w-6 bg-brand-200" />
      {children}
      <span className="h-px w-6 bg-brand-200" />
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "focus-ring w-full rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-stone-400";

function Medidor({ chance }: { chance: Chance }) {
  const ordem: Chance[] = ["baixa", "media", "alta"];
  const ativo = ordem.indexOf(chance);
  return (
    <div className="flex gap-1.5" aria-hidden>
      {ordem.map((_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full transition"
          style={{ backgroundColor: i <= ativo ? CHANCE[chance].dot : "var(--stone-200)" }}
        />
      ))}
    </div>
  );
}

/* --------------------------------- Página --------------------------------- */

export default function Home() {
  const [view, setView] = useState<"onboarding" | "persona" | "hub">("onboarding");
  const [insights, setInsights] = useState<Insights>(VAZIO);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [gerando, setGerando] = useState(false);
  const [etapaOnb, setEtapaOnb] = useState("");
  const [erroOnb, setErroOnb] = useState<string | null>(null);

  // refino conversacional
  const [correcao, setCorrecao] = useState("");
  const [refinando, setRefinando] = useState(false);
  const [erroRefino, setErroRefino] = useState<string | null>(null);
  const [conversa, setConversa] = useState<TurnoRefino[]>([]);
  const [ultimoDiff, setUltimoDiff] = useState<Mudanca[] | null>(null);

  // hub
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState<ErroUX | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resposta | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessaoRef = useRef<SessaoExtracao | null>(null);

  useEffect(() => {
    try {
      const i = localStorage.getItem("cancelaia.insights");
      const p = localStorage.getItem("cancelaia.persona");
      if (i) setInsights(JSON.parse(i));
      if (i && p) {
        setPersona(JSON.parse(p));
        setView("hub");
      }
    } catch {
      /* ignore */
    }
  }, []);

  function set<K extends keyof Insights>(k: K, v: string) {
    setInsights((s) => ({ ...s, [k]: v }));
  }

  async function continuar() {
    setErroOnb(null);
    if (!insights.nicho.trim() || !insights.descricao.trim()) {
      setErroOnb("Preencha pelo menos o nicho e a descrição do seu público.");
      return;
    }
    setGerando(true);
    const msgs = [
      "Lendo o seu público…",
      "Mapeando valores e gatilhos…",
      "Escrevendo as narrativas de risco…",
    ];
    let i = 0;
    setEtapaOnb(msgs[0]);
    const timer = window.setInterval(() => {
      i = (i + 1) % msgs.length;
      setEtapaOnb(msgs[i]);
    }, 2500);
    try {
      let resp: Response;
      try {
        resp = await fetch("/api/persona", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(insights),
        });
      } catch {
        setErroOnb("Perdi a conexão. Verifique a internet e tente de novo.");
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErroOnb(mensagemOnb(data.codigo));
        return;
      }
      setPersona(data.persona);
      setConversa([]);
      setUltimoDiff(null);
      localStorage.setItem("cancelaia.insights", JSON.stringify(insights));
      localStorage.setItem("cancelaia.persona", JSON.stringify(data.persona));
      setView("persona");
    } finally {
      clearInterval(timer);
      setGerando(false);
      setEtapaOnb("");
    }
  }

  async function refinar() {
    if (!persona || !correcao.trim() || refinando) return;
    const pedido = correcao.trim();
    const historico = conversa.slice(-6);
    setErroRefino(null);
    setRefinando(true);
    setConversa((c) => [...c, { autor: "criador", texto: pedido }]);
    setCorrecao("");
    try {
      let resp: Response;
      try {
        resp = await fetch("/api/persona/refinar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insights, personaAtual: persona, correcao: pedido, historico }),
        });
      } catch {
        setErroRefino("Perdi a conexão. Tente de novo.");
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErroRefino(mensagemOnb(data.codigo));
        return;
      }
      setPersona(data.persona);
      localStorage.setItem("cancelaia.persona", JSON.stringify(data.persona));
      setConversa((c) => [...c, { autor: "consultor", texto: data.resposta || "Pronto, ajustei o perfil." }]);
      setUltimoDiff(Array.isArray(data.mudancas) ? data.mudancas : []);
      window.setTimeout(() => setUltimoDiff(null), 6000);
    } finally {
      setRefinando(false);
    }
  }

  function realce(campo: string): string {
    if (!ultimoDiff) return "";
    return ultimoDiff.some((m) => (m.campo ?? "").toLowerCase().includes(campo))
      ? "ring-2 ring-brand-200"
      : "";
  }

  async function escolher(f: File | null) {
    setErro(null);
    setResultado(null);
    setAviso(null);
    if (!f) {
      setArquivo(null);
      return;
    }
    if (!f.type.startsWith("video/") && !f.type.startsWith("audio/")) {
      setErro(traduzErro("FORMATO"));
      return;
    }
    setArquivo(f);
    const dur = await lerDuracao(f);
    if (dur > 24 * 60) {
      setAviso(`Esse arquivo tem cerca de ${Math.round(dur / 60)} min — vou focar nos primeiros ~25 minutos de fala.`);
    }
  }

  async function simular() {
    if (!arquivo || !persona) return;
    setErro(null);
    setResultado(null);
    setCarregando(true);
    setPct(null);
    setEtapa("");

    const sessao = extrairAudioNoNavegador(arquivo, ({ etapa: et, pct: p }) => {
      if (et !== undefined) setEtapa(et);
      if (p !== undefined) setPct(p);
    });
    sessaoRef.current = sessao;

    try {
      const audio = await sessao.promessa;
      setPct(null);
      setEtapa("Transcrevendo e analisando à luz do seu público…");
      const form = new FormData();
      form.append("audio", audio, "audio.mp3");
      form.append("insights", JSON.stringify(insights));
      form.append("persona", JSON.stringify(persona));

      let resp: Response;
      try {
        resp = await fetch("/api/analyze", { method: "POST", body: form });
      } catch {
        setErro(traduzErro("REDE"));
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(traduzErro(data.codigo));
        return;
      }
      setResultado(data as Resposta);
    } catch (e) {
      const codigo =
        e && typeof e === "object" && "codigo" in e ? String((e as { codigo: unknown }).codigo) : "DESCONHECIDO";
      if (codigo !== "CANCELADO") setErro(traduzErro(codigo));
    } finally {
      setCarregando(false);
      setEtapa("");
      setPct(null);
      sessaoRef.current = null;
    }
  }

  function cancelar() {
    sessaoRef.current?.cancelar();
    setCarregando(false);
    setEtapa("");
    setPct(null);
  }

  const a = resultado?.analise;
  const chance = a ? CHANCE[a.chance_cancelamento] : null;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-icon bg-brand-600 text-white shadow-sm">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </div>
            <span className="font-display text-[19px] font-semibold tracking-tight text-ink">
              cancela<span className="text-brand-600">.ai</span>
            </span>
          </div>
          {view === "hub" && (
            <button
              onClick={() => setView("onboarding")}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 transition hover:text-brand-700"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar público
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:pt-14">
        {/* ============================ ONBOARDING ============================ */}
        {view === "onboarding" && (
          <div className="animate-fade-up">
            <div className="mb-8 text-center">
              <Kicker>Passo 1 · Conheça seu público</Kicker>
              <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.5rem] sm:leading-[1.1]">
                Antes do vídeo, vamos estudar o seu público
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-stone-500">
                A leitura é feita <strong className="font-semibold text-stone-700">sob medida para a sua audiência</strong> —
                não para "qualquer um". Abra o <strong>Instagram</strong>, toque em{" "}
                <strong>Insights → Público</strong> e preencha abaixo o que aparecer. É com isso que
                entendemos como essa galera leria o vídeo que você vai anexar.
              </p>
            </div>

            <div className="space-y-5 rounded-card border border-stone-200 bg-surface p-5 shadow-md sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Nicho / tema principal *">
                  <input
                    className={inputCls}
                    placeholder="ex: humor, finanças, maternidade…"
                    value={insights.nicho}
                    onChange={(e) => set("nicho", e.target.value)}
                  />
                </Campo>
                <Campo label="Tipo de conteúdo que mais posta">
                  <select className={inputCls} value={insights.tipoConteudo} onChange={(e) => set("tipoConteudo", e.target.value)}>
                    <option value="">Selecione…</option>
                    <option>Reels</option>
                    <option>Carrossel</option>
                    <option>Stories</option>
                    <option>Vídeos longos (YouTube)</option>
                    <option>Mistura de formatos</option>
                  </select>
                </Campo>
                <Campo label="Principais cidades">
                  <input
                    className={inputCls}
                    placeholder="ex: São Paulo, Rio, Belo Horizonte"
                    value={insights.cidades}
                    onChange={(e) => set("cidades", e.target.value)}
                  />
                </Campo>
                <Campo label="País principal">
                  <input
                    className={inputCls}
                    placeholder="ex: Brasil"
                    value={insights.pais}
                    onChange={(e) => set("pais", e.target.value)}
                  />
                </Campo>
                <Campo label="Faixa etária predominante">
                  <select className={inputCls} value={insights.faixaEtaria} onChange={(e) => set("faixaEtaria", e.target.value)}>
                    <option value="">Selecione…</option>
                    <option>13–17</option>
                    <option>18–24</option>
                    <option>25–34</option>
                    <option>35–44</option>
                    <option>45–54</option>
                    <option>55+</option>
                  </select>
                </Campo>
                <Campo label="Gênero predominante">
                  <select className={inputCls} value={insights.genero} onChange={(e) => set("genero", e.target.value)}>
                    <option value="">Selecione…</option>
                    <option>Maioria mulheres</option>
                    <option>Maioria homens</option>
                    <option>Equilibrado</option>
                  </select>
                </Campo>
                <Campo label="Faixa de seguidores">
                  <select className={inputCls} value={insights.seguidores} onChange={(e) => set("seguidores", e.target.value)}>
                    <option value="">Selecione…</option>
                    <option>Menos de 1 mil</option>
                    <option>1 mil – 10 mil</option>
                    <option>10 mil – 100 mil</option>
                    <option>100 mil – 1 milhão</option>
                    <option>Mais de 1 milhão</option>
                  </select>
                </Campo>
                <Campo label="Tom do conteúdo">
                  <select className={inputCls} value={insights.tom} onChange={(e) => set("tom", e.target.value)}>
                    <option value="">Selecione…</option>
                    <option>Humor</option>
                    <option>Educativo</option>
                    <option>Opinião / Debate</option>
                    <option>Inspiracional</option>
                    <option>Notícias</option>
                    <option>Lifestyle</option>
                    <option>Outro</option>
                  </select>
                </Campo>
              </div>

              <Campo label="Descreva seu público e o que costuma postar *">
                <textarea
                  className={`${inputCls} min-h-[104px] resize-y`}
                  placeholder="ex: público jovem, engajado em pautas sociais, que valoriza autenticidade e reage mal a discurso preconceituoso. Posto humor do dia a dia…"
                  value={insights.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                />
              </Campo>

              {erroOnb && (
                <div className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{erroOnb}</span>
                </div>
              )}

              <button
                onClick={continuar}
                disabled={gerando}
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gerando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {etapaOnb || "Estudando seu público…"}
                  </>
                ) : (
                  <>
                    Estudar meu público <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              {gerando && (
                <p className="text-center text-xs text-stone-400">
                  Leva poucos segundos — estamos lendo a sua audiência, não um público genérico.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============================== PERSONA ============================== */}
        {view === "persona" && persona && (
          <div className="animate-fade-up space-y-5">
            <div className="text-center">
              <Kicker>Seu público, decifrado</Kicker>
              <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.5rem] sm:leading-[1.1]">
                É assim que vamos avaliar seu vídeo
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-stone-500">
                Confira se batemos com a sua audiência. Se algo não fechar, é só me dizer ali embaixo —
                eu ajusto o perfil na hora.
              </p>
            </div>

            <div className={`rounded-card border border-stone-200 bg-surface p-5 shadow-md transition sm:p-7 ${realce("resumo")}`}>
              <p className="text-pretty text-[15px] leading-relaxed text-stone-700">{persona.resumo}</p>

              {persona.valores?.length > 0 && (
                <div className={`mt-6 rounded-xl transition ${realce("valor")}`}>
                  <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-stone-700">
                    <Heart className="h-4 w-4 text-sev-calm" /> O que esse público valoriza
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {persona.valores.map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-chip bg-sunken px-3 py-1.5 text-xs font-medium text-stone-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-sev-calm" /> {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {persona.sensibilidades?.length > 0 && (
                <div className={`mt-5 rounded-xl transition ${realce("sensib")}`}>
                  <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-stone-700">
                    <Flame className="h-4 w-4 text-sev-warn" /> Temas sensíveis para eles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {persona.sensibilidades.map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-chip bg-sunken px-3 py-1.5 text-xs font-medium text-stone-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-sev-warn" /> {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {persona.narrativas?.length > 0 && (
              <div className={`rounded-card border border-stone-200 bg-surface p-5 shadow-md transition sm:p-7 ${realce("narrativ")}`}>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-700">
                  <Users className="h-4 w-4 text-stone-400" /> Como o cancelamento poderia nascer nessa galera
                </h3>
                <div className="space-y-3">
                  {persona.narrativas.map((n, i) => (
                    <div key={i} className="flex gap-3.5 rounded-xl bg-sunken p-4">
                      <span className="font-display text-lg font-semibold leading-none text-brand-600">
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{n.titulo}</p>
                        <p className="mt-1 text-sm leading-relaxed text-stone-600">{n.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refino conversacional */}
            <div className="rounded-card border border-brand-100 bg-brand-50/50 p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-900">
                <Pencil className="h-4 w-4 text-brand-600" /> Algo não bate? Ajuste conversando
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
                Você conhece sua audiência melhor que ninguém. Diga o que corrigir e eu refaço o perfil.
              </p>

              {conversa.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  {conversa.map((t, i) =>
                    t.autor === "criador" ? (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white shadow-sm">
                          {t.texto}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface px-3.5 py-2 text-sm text-stone-700 shadow-sm ring-1 ring-stone-200">
                          {t.texto}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {ultimoDiff && ultimoDiff.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ultimoDiff.map((m, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-chip bg-ok-bg px-2.5 py-1 text-[11px] font-medium text-ok-fg ring-1 ring-inset ring-ok-border">
                      <CheckCircle2 className="h-3 w-3" /> {m.resumo}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <textarea
                  className={`${inputCls} min-h-[60px] resize-y`}
                  placeholder="ex: na real meu público é mais velho, 35+, e leva tudo mais a sério…"
                  value={correcao}
                  onChange={(e) => setCorrecao(e.target.value)}
                  disabled={refinando}
                />
                {conversa.length === 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {SUGESTOES_REFINO.map((s) => (
                      <button
                        key={s}
                        onClick={() => setCorrecao(s)}
                        disabled={refinando}
                        className="rounded-chip border border-brand-200 bg-surface px-2.5 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {erroRefino && <p className="mt-2 text-xs text-danger-fg">{erroRefino}</p>}
                <button
                  onClick={refinar}
                  disabled={refinando || !correcao.trim()}
                  className="focus-ring mt-3 flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-surface px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refinando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Refinando o perfil…
                    </>
                  ) : (
                    <>
                      <Pencil className="h-3.5 w-3.5" /> Refinar perfil
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center">
              <button
                onClick={() => setView("onboarding")}
                className="text-sm font-medium text-stone-500 transition hover:text-brand-700"
              >
                Editar os dados do público
              </button>
              <button
                onClick={() => setView("hub")}
                className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:justify-center"
              >
                Avaliar meu vídeo <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================================ HUB ================================ */}
        {view === "hub" && (
          <div className="animate-fade-up">
            <div className="mb-8 text-center">
              <Kicker>Passo 2 · Analise seu vídeo</Kicker>
              <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.5rem] sm:leading-[1.1]">
                Anexe o vídeo e simule a reação do seu público
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-stone-500">
                Vou avaliar a fala do vídeo pensando no público
                {insights.nicho ? (
                  <>
                    {" "}de <strong className="font-semibold text-stone-700">{insights.nicho}</strong>
                  </>
                ) : null}{" "}
                que você descreveu.
              </p>
            </div>

            <div className="rounded-card border border-stone-200 bg-surface p-5 shadow-md sm:p-6">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  escolher(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`focus-ring flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-11 text-center transition ${
                  over ? "border-brand-500 bg-brand-50" : "border-stone-300 bg-sunken hover:border-brand-400 hover:bg-brand-50/40"
                }`}
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-stone-200">
                  <Upload className="h-5 w-5 text-brand-600" />
                </div>
                <p className="text-sm font-semibold text-stone-700">Clique para escolher ou arraste o vídeo aqui</p>
                <p className="mt-1 text-xs text-stone-400">
                  MP4, MOV, WEBM ou MP3 · qualquer tamanho — extraímos só o áudio, aqui no seu navegador
                </p>
                <input ref={inputRef} type="file" accept="video/*,audio/*" hidden onChange={(e) => escolher(e.target.files?.[0] ?? null)} />
              </button>

              {arquivo && (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-sunken px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Film className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-700">{arquivo.name}</p>
                    <p className="text-xs text-stone-400">{(arquivo.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  {!carregando && (
                    <button
                      onClick={() => {
                        setArquivo(null);
                        setAviso(null);
                      }}
                      className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600"
                      aria-label="Remover"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {aviso && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#e8d3a6] bg-[#faf1df] px-4 py-3 text-sm text-[#8a5a1f]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{aviso}</span>
                </div>
              )}

              {!carregando ? (
                <button
                  onClick={simular}
                  disabled={!arquivo}
                  className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShieldCheck className="h-4 w-4" /> Simular reação do público
                </button>
              ) : (
                <div className="mt-4 rounded-xl border border-stone-200 bg-sunken px-4 py-4">
                  <div className="flex items-center gap-2.5 text-sm font-medium text-stone-700">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    {etapa || "Processando…"}
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
                    <div
                      className={`h-full rounded-full bg-brand-500 transition-all duration-300 ${pct === null ? "animate-pulse-soft" : ""}`}
                      style={{ width: pct === null ? "100%" : `${pct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-stone-400">
                      Na 1ª vez, o processador de áudio (~32 MB) é baixado. Depois fica rápido.
                    </p>
                    <button onClick={cancelar} className="shrink-0 text-xs font-medium text-stone-500 underline-offset-2 transition hover:text-danger-fg hover:underline">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {erro && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger-border bg-danger-bg px-4 py-3.5 text-danger-fg">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{erro.titulo}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-danger-fg/85">{erro.corpo}</p>
                    {erro.acao && erro.codigo !== "FORMATO" && (
                      <button
                        onClick={simular}
                        disabled={!arquivo}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2 disabled:no-underline disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> {erro.acao}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Resultado */}
            {a && chance && (
              <section className="mt-8 animate-rise-in space-y-6">
                <div className="rounded-card border border-stone-200 bg-surface p-6 shadow-lg sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={`inline-flex items-center gap-2 rounded-chip px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${chance.cls}`}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chance.dot }} />
                      {chance.label}
                    </span>
                  </div>
                  <div className="mt-4">
                    <Medidor chance={a.chance_cancelamento} />
                    <div className="mt-1.5 flex justify-between text-[11px] font-medium uppercase tracking-wide text-stone-400">
                      <span>Baixa</span>
                      <span>Média</span>
                      <span>Alta</span>
                    </div>
                  </div>
                  <h2 className="mt-5 font-display text-xl font-semibold text-ink">Leitura geral</h2>
                  <p className="mt-1.5 text-pretty text-[15px] leading-relaxed text-stone-600">{a.resumo}</p>
                </div>

                <div>
                  <h3 className="mb-3 px-1 text-sm font-semibold text-stone-700">
                    O que poderia pegar mal com seu público ({a.achados.length})
                  </h3>
                  {a.achados.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-card border border-ok-border bg-ok-bg px-5 py-4 text-sm text-ok-fg">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      Nada que esse público reprovaria de forma relevante. Ainda assim, vale revisar as recomendações abaixo.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {a.achados.map((f, i) => {
                        const tempo = fmtTempo(f.inicio_segundos);
                        return (
                          <div
                            key={i}
                            className="overflow-hidden rounded-card border border-stone-200 bg-surface shadow-sm"
                            style={{ borderLeft: `3px solid ${corGravidade(f.gravidade)}` }}
                          >
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="text-[15px] font-semibold text-ink">{f.titulo}</h4>
                                <span
                                  className="shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold text-white"
                                  style={{ backgroundColor: corGravidade(f.gravidade) }}
                                >
                                  {f.gravidade}
                                </span>
                              </div>
                              <p className="mb-3 mt-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                {CATEGORIA_LABEL[f.categoria] ?? f.categoria}
                              </p>
                              {f.trecho && (
                                <blockquote className="mb-4 rounded-lg bg-sunken px-3.5 py-2.5 text-sm italic text-stone-600">
                                  {tempo && <span className="mr-1.5 font-mono text-xs not-italic text-brand-600">{tempo}</span>}
                                  “{f.trecho}”
                                </blockquote>
                              )}
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                Por que pega mal com seu público
                              </p>
                              <p className="mb-4 text-sm leading-relaxed text-stone-600">{f.explicacao}</p>
                              <div className="flex gap-2.5 rounded-xl bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-100">
                                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                                <div>
                                  <p className="mb-0.5 text-xs font-semibold text-brand-700">Como contornar</p>
                                  <p className="text-sm leading-relaxed text-stone-700">{f.sugestao}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {a.melhorias?.length > 0 && (
                  <div className="rounded-card border border-stone-200 bg-surface p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-stone-700">Recomendações gerais</h3>
                    <ul className="space-y-2.5">
                      {a.melhorias.map((m, i) => (
                        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-stone-600">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sev-calm" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => {
                    setResultado(null);
                    setArquivo(null);
                    setAviso(null);
                  }}
                  className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-surface px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  <RotateCcw className="h-4 w-4" /> Analisar outro vídeo
                </button>
              </section>
            )}
          </div>
        )}

        <p className="mx-auto mt-12 max-w-xl text-center text-xs leading-relaxed text-stone-400">
          A leitura é uma estimativa gerada por IA a partir da fala do vídeo e dos dados de público que
          você informa. Use como apoio à decisão — não substitui o seu julgamento nem orientação jurídica.
        </p>
      </main>
    </div>
  );
}
