# Como publicar na Vercel (passo a passo)

O app já está pronto pra Vercel. Como a publicação fica **na sua conta**, só
você pode fazer o login — mas são poucos passos. Faça tudo no terminal, dentro
da pasta do projeto (`c:\Users\win11\Downloads\a`).

> ⚠️ Antes: revogue e gere novas chaves (as antigas foram expostas no chat):
> - Anthropic: https://console.anthropic.com/settings/keys
> - Groq: https://console.groq.com/keys

---

## Opção A — Vercel CLI (mais rápido, sem GitHub)

```powershell
# 1. Instalar a CLI da Vercel (uma vez só)
npm i -g vercel

# 2. Fazer login (abre o navegador pra você entrar com Google/GitHub/email)
vercel login

# 3. Criar o projeto (responda ENTER em tudo; aceite os padrões)
vercel

# 4. Cadastrar as chaves de API no ambiente de produção
#    (vai pedir pra colar o valor de cada uma)
vercel env add ANTHROPIC_API_KEY production
vercel env add GROQ_API_KEY production

# 5. Publicar de verdade (gera o link público final)
vercel --prod
```

No fim do passo 5, a Vercel mostra o **link de produção** (algo como
`https://cancel-radar-xxxx.vercel.app`). **Esse é o link que você manda pros
seus usuários.** 🎉

---

## Opção B — GitHub + painel da Vercel (visual)

1. Suba esta pasta para um repositório no GitHub.
2. Entre em https://vercel.com → **Add New → Project** → importe o repositório.
3. Em **Environment Variables**, adicione:
   - `ANTHROPIC_API_KEY` = sua chave da Anthropic
   - `GROQ_API_KEY` = sua chave da Groq
4. Clique em **Deploy**. Ao terminar, copie o link público.

---

## Observações importantes

- **As chaves NÃO vão no código.** Elas ficam só nas "Environment Variables"
  da Vercel (o arquivo `.env.local` é ignorado e nunca é enviado).
- **Limite de upload da Vercel (4,5 MB):** já resolvido — o áudio é extraído e
  comprimido no navegador do usuário antes de enviar. Vídeos longos (acima de
  ~25 min) podem passar do limite; nesse caso o app pede pra enviar um trecho.
- **Tempo de função (60s no plano grátis):** suficiente para a transcrição +
  análise da maioria dos vídeos. Para vídeos muito longos, considere o plano Pro.
- **Custos:** cada análise consome um pouco da sua cota da Anthropic (Claude). A
  transcrição na Groq tem tier gratuito. Monitore o uso nos respectivos consoles.
