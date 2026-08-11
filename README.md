# Content Machine

> Um tópico entra. Dois drafts saem.

## A origem

Julio Pessan escreve sobre IA, infraestrutura e o futuro do trabalho. O problema nunca foi falta de ideia. Era o abismo entre "tenho um insight" e "tenho um artigo pronto pro Medium *e* um post nativo pro LinkedIn", cada um respeitando as regras de um formato diferente, sem soar como texto genérico de IA.

Escrever os dois à mão consumia a energia que devia ir para pensar. Delegar para um LLM genérico devolvia prosa cheia de travessão, "leverage" e fechamentos motivacionais vazios. O oposto de uma voz com opinião.

Content Machine existe para fechar essa lacuna: um pipeline editorial que aplica um framework de escrita real (HITS), aprende com cada edição humana e não trava quando um modelo grátis bate rate limit.

## O que ele faz

1. Você digita um tópico (e, opcionalmente, um dado real que a IA não deveria inventar sozinha).
2. O sistema escreve um artigo completo pro Medium seguindo o framework **HITS**: Headline, Hook, "Why You Should Care", The Twist, "What It Means", "What You Can Do", Parting Thought. Regras rígidas de voz: sem travessão, sem "revolutionary", com uma opinião real e uma admissão honesta de incerteza.
3. Sem inventar nada de novo, o mesmo insight é reescrito do zero no formato nativo do LinkedIn: gancho isolado na primeira linha, sem estrutura de markdown, fechando com uma pergunta específica.
4. Você lê, edita, dá uma nota de 1 a 10 e explica o que mudou. O sistema extrai uma lição reutilizável daquela edição e injeta as 6 mais recentes no prompt do próximo artigo. A máquina fica menos genérica a cada rodada.
5. Capas para os dois formatos (1500×750 e 1200×1200) são desenhadas localmente em `<canvas>`, sem gastar token e sem risco de a IA inventar um visual fora da marca.

## Como funciona por baixo

```
navegador (React)  →  /api/generate  →  OpenRouter
                         (Vercel serverless)
```

- O frontend nunca fala direto com a OpenRouter. Toda chamada passa por [`api/generate.js`](api/generate.js), uma função serverless que guarda `OPENROUTER_API_KEY` como env var. A chave nunca aparece no navegador.
- A função tenta uma lista de modelos gratuitos em ordem: `google/gemma-4-31b-it:free` → `google/gemma-4-26b-a4b-it:free` → `openai/gpt-oss-20b:free`. Se um modelo devolve rate limit (429), fica indisponível (502/503/504) ou é retirado do tier grátis (404), a próxima opção assume automaticamente. O usuário não vê a queda.
- As lições ficam no `localStorage` do navegador, não em um banco. Cada uma carrega um `scope` (hook, structure, voice, specificity, topic-selection), a nota dada e a headline de origem.

## O que ainda não resolve

A rota `/api/generate` não tem autenticação nem rate limit por usuário: qualquer pessoa com a URL pública consome a mesma cota grátis da OpenRouter. Serve bem para uso pessoal ou de um time pequeno; para expor a um público maior, a função precisa de um limite por IP ou sessão antes disso. As lições também vivem só no navegador que as criou, então trocar de máquina ou limpar o `localStorage` zera a memória.

## Rodando localmente

```bash
npm install
npm run dev
```

O app sobe em `http://localhost:5173`. As chamadas para `/api/generate` só funcionam com `vercel dev` (que executa a função serverless) ou em produção. Rodar só `vite dev` serve a UI, mas a geração de conteúdo depende da function:

```bash
npx vercel dev
```

## Deploy

Já está publicado via GitHub → Vercel, com deploy automático a cada push em `main`. Para replicar:

1. Importe este repositório na Vercel.
2. Defina a env var `OPENROUTER_API_KEY` no projeto (Settings → Environment Variables).
3. Pronto. O framework é detectado automaticamente (Vite).

## Stack

Vite + React 19 + Tailwind, sem backend próprio além da função serverless. O `<canvas>` das capas e a extração de lições rodam 100% no cliente; a única saída de rede é `/api/generate`.

---

Julio Pessan — AI Strategist and Technology Thought Leader.
