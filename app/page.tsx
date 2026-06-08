"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Film,
  Sparkles,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  CheckCircle2,
  X,
  RotateCcw,
  AtSign,
  ArrowRight,
  Users,
  Heart,
  Flame,
  Pencil,
} from "lucide-react";
import type { Insights, Persona, Analise, Chance } from "@/lib/types";

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

const CHANCE: Record<Chance, { label: string; chip: string }> = {
  baixa: { label: "Baixa chance de cancelamento", chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  media: { label: "Média chance de cancelamento", chip: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  alta: { label: "Alta chance de cancelamento", chip: "bg-red-50 text-red-700 ring-red-600/20" },
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

function corGravidade(g: number) {
  if (g >= 76) return "#ef4444";
  if (g >= 51) return "#f97316";
  if (g >= 21) return "#f59e0b";
  return "#10b981";
}

function fmtTempo(s: number) {
  if (!s || s < 0) return null;
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  return `${m}:${seg.toString().padStart(2, "0")}`;
}

/* ----------------------------- Componentes UI ----------------------------- */

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

/* --------------------------------- Página --------------------------------- */

export default function Home() {
  const [view, setView] = useState<"onboarding" | "persona" | "hub">("onboarding");
  const [insights, setInsights] = useState<Insights>(VAZIO);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroOnb, setErroOnb] = useState<string | null>(null);

  // estado do hub
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resposta | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // carrega do localStorage
  useEffect(() => {
    try {
      const i = localStorage.getItem("cancelaia.insights");
      const p = localStorage.getItem("cancelaia.persona");
      if (i) setInsights(JSON.parse(i));
      if (i && p) {
        setPersona(JSON.parse(p));
        setView("hub");
      }
    } catch {}
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
    try {
      const resp = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insights),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || "Falha ao analisar o público.");
      setPersona(data.persona);
      localStorage.setItem("cancelaia.insights", JSON.stringify(insights));
      localStorage.setItem("cancelaia.persona", JSON.stringify(data.persona));
      setView("persona");
    } catch (e) {
      setErroOnb(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setGerando(false);
    }
  }

  function escolher(f: File | null) {
    setErro(null);
    setResultado(null);
    if (f && !f.type.startsWith("video/") && !f.type.startsWith("audio/")) {
      setErro("Envie um arquivo de vídeo (ou áudio).");
      return;
    }
    setArquivo(f);
  }

  async function simular() {
    if (!arquivo || !persona) return;
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const { extrairAudioNoNavegador } = await import("@/lib/ffmpeg-client");
      const audio = await extrairAudioNoNavegador(arquivo, (m) => setEtapa(m));
      setEtapa("Transcrevendo e analisando à luz do seu público…");
      const form = new FormData();
      form.append("audio", audio, "audio.mp3");
      form.append("insights", JSON.stringify(insights));
      form.append("persona", JSON.stringify(persona));
      const resp = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || "Falha na análise.");
      setResultado(data as Resposta);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
      setEtapa("");
    }
  }

  const a = resultado?.analise;
  const chance = a ? CHANCE[a.chance_cancelamento] : null;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              cancela<span className="text-brand-600">.ai</span>
            </span>
          </div>
          {view === "hub" && (
            <button
              onClick={() => setView("onboarding")}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-brand-600"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar público
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:pt-12">
        {/* ============================ ONBOARDING ============================ */}
        {view === "onboarding" && (
          <div className="animate-fade-up">
            <div className="mb-7 text-center">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                <AtSign className="h-3.5 w-3.5" /> Passo 1 · Conheça seu público
              </span>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Vamos estudar o seu público primeiro
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-slate-500">
                A análise é feita <strong className="font-semibold text-slate-700">sob medida para o seu público</strong> —
                não para "qualquer um". Abra o <strong>Instagram</strong>, toque em{" "}
                <strong>Insights → Público</strong> e preencha abaixo o que aparecer lá.
                Assim entendemos as narrativas que essa audiência poderia enxergar no
                vídeo que você vai anexar.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
                  className={`${inputCls} min-h-[96px] resize-y`}
                  placeholder="ex: público jovem, engajado em pautas sociais, que valoriza autenticidade e reage mal a discurso preconceituoso. Posto humor do dia a dia…"
                  value={insights.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                />
              </Campo>

              {erroOnb && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{erroOnb}</span>
                </div>
              )}

              <button
                onClick={continuar}
                disabled={gerando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gerando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Estudando seu público…
                  </>
                ) : (
                  <>
                    Continuar <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================== PERSONA ============================== */}
        {view === "persona" && persona && (
          <div className="animate-fade-up space-y-5">
            <div className="text-center">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                <Users className="h-3.5 w-3.5" /> Entendemos seu público
              </span>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                É assim que vamos avaliar seu vídeo
              </h1>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[15px] leading-relaxed text-slate-700">{persona.resumo}</p>

              {persona.valores?.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Heart className="h-4 w-4 text-slate-400" /> O que esse público valoriza
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {persona.valores.map((v, i) => (
                      <span key={i} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {persona.sensibilidades?.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Flame className="h-4 w-4 text-slate-400" /> Temas sensíveis para eles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {persona.sensibilidades.map((v, i) => (
                      <span key={i} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {persona.narrativas?.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Possíveis narrativas de cancelamento nesse público
                </h3>
                <div className="space-y-3">
                  {persona.narrativas.map((n, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">{n.titulo}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{n.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setView("onboarding")}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              <button
                onClick={() => setView("hub")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Ir para a análise do vídeo <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================================ HUB ================================ */}
        {view === "hub" && (
          <div className="animate-fade-up">
            <div className="mb-7 text-center">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                <Sparkles className="h-3.5 w-3.5" /> Passo 2 · Analise seu vídeo
              </span>
              <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Anexe o vídeo e simule a reação do seu público
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-slate-500">
                Vamos avaliar a fala do vídeo considerando o público
                {insights.nicho ? <> de <strong className="font-semibold text-slate-700">{insights.nicho}</strong></> : null} que
                você descreveu.
              </p>
            </div>

            {/* Upload card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                  over ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40"
                }`}
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                  <Upload className="h-5 w-5 text-brand-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Clique para escolher ou arraste o vídeo aqui</p>
                <p className="mt-1 text-xs text-slate-400">MP4, MOV, WEBM, MP3 · qualquer tamanho (extraímos só o áudio)</p>
                <input ref={inputRef} type="file" accept="video/*,audio/*" hidden onChange={(e) => escolher(e.target.files?.[0] ?? null)} />
              </button>

              {arquivo && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Film className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{arquivo.name}</p>
                    <p className="text-xs text-slate-400">{(arquivo.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button onClick={() => setArquivo(null)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600" aria-label="Remover">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <button
                onClick={simular}
                disabled={!arquivo || carregando}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {carregando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Simular cancelamento
                  </>
                )}
              </button>

              {erro && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{erro}</span>
                </div>
              )}
            </div>

            {carregando && (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="text-sm font-medium text-slate-600">{etapa || "Processando…"}</p>
                <p className="text-xs text-slate-400">Na primeira vez, o processador de áudio é baixado (~32 MB). Depois fica rápido.</p>
              </div>
            )}

            {/* Resultado */}
            {a && chance && (
              <section className="mt-8 animate-fade-up space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${chance.chip}`}>
                    {chance.label}
                  </span>
                  <h2 className="mt-4 text-lg font-semibold text-slate-900">Veredito</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{a.resumo}</p>
                </div>

                <div>
                  <h3 className="mb-3 px-1 text-sm font-semibold text-slate-700">
                    O que poderia pegar mal com seu público ({a.achados.length})
                  </h3>
                  {a.achados.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      Nada que esse público reprovaria de forma relevante. Ainda assim, revise as recomendações abaixo.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {a.achados.map((f, i) => {
                        const tempo = fmtTempo(f.inicio_segundos);
                        return (
                          <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="h-1 w-full" style={{ backgroundColor: corGravidade(f.gravidade) }} />
                            <div className="p-5">
                              <h4 className="text-[15px] font-semibold text-slate-900">{f.titulo}</h4>
                              <p className="mb-3 mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                                {CATEGORIA_LABEL[f.categoria] ?? f.categoria}
                              </p>
                              {f.trecho && (
                                <blockquote className="mb-4 border-l-2 border-slate-200 pl-3 text-sm italic text-slate-600">
                                  {tempo && <span className="mr-1.5 font-mono text-xs not-italic text-brand-600">{tempo}</span>}
                                  “{f.trecho}”
                                </blockquote>
                              )}
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Por que pega mal com seu público</p>
                              <p className="mb-4 text-sm leading-relaxed text-slate-600">{f.explicacao}</p>
                              <div className="flex gap-2.5 rounded-xl bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-100">
                                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                                <div>
                                  <p className="mb-0.5 text-xs font-semibold text-brand-700">Como melhorar</p>
                                  <p className="text-sm leading-relaxed text-slate-700">{f.sugestao}</p>
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Recomendações gerais</h3>
                    <ul className="space-y-2.5">
                      {a.melhorias.map((m, i) => (
                        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-600">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
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
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" /> Analisar outro vídeo
                </button>
              </section>
            )}
          </div>
        )}

        <p className="mt-10 text-center text-xs leading-relaxed text-slate-400">
          A análise é uma estimativa gerada por IA a partir da fala do vídeo e dos dados de público que você informa.
          Use como apoio à decisão — não substitui julgamento humano nem orientação jurídica.
        </p>
      </main>
    </div>
  );
}
