# CancelRadar 🎬⚡

Plataforma onde o criador de conteúdo **anexa um vídeo**, clica em **Simular**, e o sistema:

1. **Transcreve** o áudio do vídeo (Whisper-large-v3 via Groq, grátis);
2. **Analisa** a fala com IA (Claude Opus 4.8) buscando riscos de cancelamento;
3. Retorna um **score 0–100**, os **trechos problemáticos** (com momento no vídeo, categoria, gravidade e sugestão) e **recomendações** para reduzir o risco.

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar as chaves
copy .env.local.example .env.local   # (Windows)  |  cp no Linux/Mac
# edite .env.local e preencha ANTHROPIC_API_KEY e OPENAI_API_KEY

# 3. Subir em desenvolvimento
npm run dev
```

Abra http://localhost:3000

## Chaves necessárias

| Variável            | Para quê                       | Onde pegar                          |
| ------------------- | ------------------------------ | ----------------------------------- |
| `ANTHROPIC_API_KEY` | Análise de risco (Claude)      | https://console.anthropic.com/      |
| `GROQ_API_KEY`      | Transcrição do áudio (Whisper) | https://console.groq.com/keys (grátis) |

## Como funciona (arquitetura)

```
Navegador (app/page.tsx)
   │  upload do vídeo + botão "Simular"
   ▼
POST /api/analyze (app/api/analyze/route.ts)
   │
   ├─ lib/transcribe.ts → Whisper (Groq) transforma fala em texto (com timestamps)
   │
   └─ lib/analyze.ts → Claude lê a transcrição e devolve análise estruturada
           • prompt caching na "rubrica" (system prompt estável)
           • structured outputs (Zod) → JSON sempre válido
           • adaptive thinking + effort "high" → mais precisão
   ▼
Resultado renderizado: score, achados e melhorias
```

## Detalhes técnicos

- **Precisão**: o modelo é instruído a citar trechos **literais** como evidência,
  calibrar a gravidade e não inventar riscos. Conteúdo seguro recebe nota baixa.
- **Prompt caching**: a rubrica grande fica em `system` com `cache_control`, então
  a partir da 2ª análise você paga ~10% pelo prefixo reaproveitado.
- **Limite de tamanho**: o tier gratuito da Groq aceita até **25 MB** por arquivo.
  Para vídeos maiores, comprima ou extraia só o áudio
  (ex.: `ffmpeg -i in.mp4 -vn -b:a 64k out.mp3`).

## Próximos passos possíveis

- Análise também da **imagem/cenas** (frames → visão do Claude).
- Comparar com **polêmicas recentes** via web search.
- Histórico de análises por usuário (banco de dados).
