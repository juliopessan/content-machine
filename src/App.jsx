import React, { useState, useEffect } from "react";
import DecryptText from "./components/DecryptText.jsx";

const PILLARS = [
  "AI Agents",
  "AI Infrastructure",
  "Tech Disruption",
  "Big Tech Strategy",
  "Future of Work",
];

const MEDIUM_SYSTEM = `You are Julio Pessan's ghostwriter for Medium thought-leadership articles, targeting the Partner Program with 50%+ completion rates.

Content pillars (the article must fit one): ${PILLARS.join(" | ")}.

Follow the HITS framework as the article's backbone:
- Headline: use a Quantified Disruption, Provocative Contrast, or Insider Story formula. Numbers over adjectives. No filler words like "amazing" or "incredible".
- Hook (first 40-50 words): a burning question, shared frustration, or mind-bender. Chatty, direct, first line must earn the second line.
- Why You Should Care (80-100 words): tie the topic to the reader's career, money, or daily work. Light FOMO, not manipulative.
- The Twist (120-150 words): a contrarian insight or overlooked detail, narrated as a reveal ("While everyone watches X, the real move is Y"). Ground it in one concrete mechanism or example. Never invent a specific statistic, named study, or named person. If you don't have a real one, describe the dynamic instead of faking a data point.
- What It Means (120-150 words): 2-3 sub-points covering immediate impact, the domino effect, and who wins.
- What You Can Do (120-150 words): 3-5 concrete, mentor-voice steps a reader could start this week.
- Parting Thought (60-80 words): a visionary close or a specific question that invites comments. No generic "the future is bright" filler.

Voice rules, non-negotiable:
- First person ("I", "you"). Paragraphs of 2-3 lines. Vary sentence rhythm, do not make every sentence the same length.
- Banned words and patterns: em dashes, "leverage", "utilize", "foster", "delve", "nestled", "tapestry", "revolutionary", "game-changing", "unlock", rule-of-three synonym cycling ("catalyst, partner, foundation"), vague attributions ("industry observers say"), generic upbeat closers ("exciting times ahead").
- Have an actual opinion somewhere in the piece. Acknowledge one piece of uncertainty or trade-off, since total confidence reads as fake.
- Mark exactly 5 to 7 short phrases for emphasis by wrapping them in **double asterisks**. Use asterisks for nothing else.
- The second-to-last line of the body must be exactly: "What's your take? Share your thoughts in the comments, I read every one."
- The last line of the body must be exactly: "Julio Pessan - AI Strategist and Technology Thought Leader. Follow for insights that empower your future in technology."

Length constraint (hard, technical limit on this pipeline): the ENTIRE response, including headline, subtitle, tags, pillar, body and JSON syntax, must fit under 1000 output tokens. In practice that means the "body" field must be 450-550 words. Running long causes the response to get cut off mid-JSON and fail to parse, so when in doubt write shorter, not longer.

Output format: plain text fields, NOT JSON. Follow this shape exactly, with BODY last:

HEADLINE: <the headline on one line>
SUBTITLE: <under 10 words, teases the twist, one line>
PILLAR: <one of the five pillar names exactly as listed above>
TAGS: <5 lowercase tags separated by commas>
BODY:
<the full article, blank line between paragraphs, **bold** markers inline>

Write nothing before HEADLINE and nothing after the article. Do not wrap the output in code fences. Do not use JSON. Quotes, apostrophes and line breaks inside the article are fine, since this is not JSON.`;

const LINKEDIN_SYSTEM = `You are adapting an already-written Medium article into a native LinkedIn post for Julio Pessan (Gen AI Architect Lead, AI Strategist). You will receive the Medium headline, subtitle, and opening as context.

Do not summarize the article. Rewrite for LinkedIn's native format:
- Line 1: the hook, standalone. It must work as a scroll-stopper by itself, before anyone clicks "see more".
- 2 to 4 short paragraphs (1-3 sentences each) carrying the twist and exactly ONE concrete, actionable takeaway. No headers, no bullet lists, no markdown structure, since LinkedIn is read as plain text on a phone.
- Close with one specific question that invites a real reply. Never "thoughts?" or "what do you think?".

Voice rules: same discipline as the Medium piece. No em dashes, no "leverage/utilize/foster/delve/game-changing/revolutionary/unlock", first person, varied rhythm, no invented statistics or named studies, one honest note of uncertainty or trade-off somewhere.

Mark exactly 3 to 5 short phrases for emphasis with **double asterisks**, nothing else uses asterisks.

Length: 120-180 words total.

Output format: plain text fields, NOT JSON. Follow this shape exactly, with POST last:

HASHTAGS: <2-3 specific tags separated by commas, without the # symbol, not generic ones like AI or innovation>
POST:
<the full post, blank line between paragraphs, **bold** markers inline>

Write nothing before HASHTAGS and nothing after the post. Do not wrap the output in code fences. Do not use JSON. Quotes, apostrophes and line breaks inside the post are fine, since this is not JSON.`;

const LOADING_MESSAGES = {
  medium: [
    "Varrendo os sinais do tópico",
    "Convocando o painel de entrevistadores",
    "Extraindo a história por trás da ideia",
    "Moldando o rascunho no framework HITS",
    "Aplicando as regras de humanização",
    "Cortando adjetivo vago e travessão",
  ],
  linkedin: [
    "Traduzindo o insight pro formato nativo",
    "Reescrevendo o gancho pra parar o scroll",
    "Convocando o conselho de escritores",
    "Convertendo ênfase em negrito Unicode",
  ],
};

const STAGES = [
  { id: "signal", num: "01", label: "SINAL" },
  { id: "medium", num: "02", label: "RASCUNHO" },
  { id: "linkedin", num: "03", label: "ADAPTA" },
  { id: "done", num: "04", label: "PRONTO" },
];

function stageState(stageId, phase) {
  const order = ["signal", "medium", "linkedin", "done"];
  const phaseIndex =
    phase === "idle" || phase === "error" ? -1 : order.indexOf(phase === "done" ? "done" : phase);
  const stageIndex = order.indexOf(stageId);
  if (phase === "idle") return "pending";
  if (phase === "error") return stageIndex === 0 ? "done" : "pending";
  if (stageIndex < phaseIndex) return "done";
  if (stageIndex === phaseIndex) return phase === "done" ? "done" : "active";
  if (stageId === "signal") return "done";
  return "pending";
}

function toBoldSansUnicode(str) {
  return str.replace(/[A-Za-z0-9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d5d4 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d5ee + (code - 97));
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + (code - 48));
    return ch;
  });
}

function renderInlineBold(text, keyPrefix) {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={`${keyPrefix}-${i}`}
          className="font-semibold border-b-2 border-[#D97757] pb-[1px]"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function buildMediumCopyText(m) {
  const tagsLine = m.tags && m.tags.length ? `\n\nTags: ${m.tags.join(", ")}` : "";
  return `${m.headline}\n\n${m.subtitle}\n\n${m.body}${tagsLine}`;
}

function formatLinkedinForDisplay(post) {
  return post.replace(/\*\*(.+?)\*\*/g, (_, p1) => toBoldSansUnicode(p1));
}

function buildLinkedinCopyText(l) {
  const body = formatLinkedinForDisplay(l.post);
  const tags =
    l.hashtags && l.hashtags.length
      ? "\n\n" + l.hashtags.map((t) => `#${t.replace(/\s+/g, "")}`).join(" ")
      : "";
  return `${body}${tags}`;
}

// Isola a primeira linha do post (o "hook" que o LINKEDIN_SYSTEM exige como
// scroll-stopper standalone) do resto, para tipar só ela.
function splitHook(post) {
  const idx = post.indexOf("\n\n");
  if (idx === -1) return { hook: post, rest: "" };
  return { hook: post.slice(0, idx), rest: post.slice(idx + 2) };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Efeito de máquina de escrever: revela `text` caractere a caractere. Some
// para nada quando o texto muda ou reduced-motion está ativo (mostra tudo
// de uma vez).
function useTypewriter(text, { speed = 20, enabled = true } = {}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !text) {
      setCount(0);
      return;
    }
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, enabled, speed]);

  const done = !enabled || count >= text.length;
  return { display: text.slice(0, count), done };
}

// Espelha a ordem de fallback usada em api/generate.js — só para exibição
// ("opção X da lista") no painel de execução, a chamada real e a chave
// ficam inteiramente no servidor.
const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
];

async function requestJSON(system, userMessage, onModelTried) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, userMessage }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error === "rate_limit" ? "rate_limit" : data.error || `http_${response.status}`;
    throw new Error(message);
  }
  if (onModelTried) onModelTried(data.model);
  return { text: data.text, truncated: data.truncated, model: data.model };
}

/**
 * Lê a saída em campos delimitados. O campo `tailKey` consome todo o resto do
 * texto, então prosa com aspas, apóstrofos e quebras de linha passa intacta.
 */
function parseFields(text, tailKey) {
  const clean = text.replace(/```[a-z]*\n?|```/gi, "").trim();
  const tailRe = new RegExp(`^\\s*${tailKey}\\s*:\\s*`, "im");
  const match = tailRe.exec(clean);
  if (!match) {
    throw new Error(`campo ${tailKey} não veio na resposta. Início: "${clean.slice(0, 100)}"`);
  }
  const head = clean.slice(0, match.index);
  const tail = clean.slice(match.index + match[0].length).trim();

  const fields = {};
  for (const line of head.split("\n")) {
    const m = /^\s*([A-Z_]+)\s*:\s*(.*)$/.exec(line);
    if (m) fields[m[1].toUpperCase()] = m[2].trim();
  }
  fields[tailKey.toUpperCase()] = tail;
  return fields;
}

function splitList(value) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function parseMedium(text) {
  const f = parseFields(text, "BODY");
  if (!f.HEADLINE || !f.BODY) {
    throw new Error("a resposta veio sem headline ou sem corpo do artigo.");
  }
  const pillar = PILLARS.find((p) => p.toLowerCase() === (f.PILLAR || "").toLowerCase());
  return {
    headline: f.HEADLINE,
    subtitle: f.SUBTITLE || "",
    pillar: pillar || f.PILLAR || PILLARS[0],
    tags: splitList(f.TAGS).slice(0, 5),
    body: f.BODY,
  };
}

function parseLinkedin(text) {
  const f = parseFields(text, "POST");
  if (!f.POST) throw new Error("a resposta veio sem o texto do post.");
  return { post: f.POST, hashtags: splitList(f.HASHTAGS).slice(0, 3) };
}

function parseLesson(text) {
  const f = parseFields(text, "LESSON");
  if (!f.LESSON) throw new Error("a resposta veio sem a lição.");
  const allowed = ["hook", "structure", "voice", "specificity", "topic-selection"];
  const scope = (f.SCOPE || "").toLowerCase();
  return { lesson: f.LESSON, scope: allowed.includes(scope) ? scope : "voice" };
}

async function callClaude(system, userMessage, parse, onModelTried) {
  let { text, truncated, model } = await requestJSON(system, userMessage, onModelTried);
  if (truncated) {
    const tighterMsg = `${userMessage}\n\nIMPORTANT: your previous attempt got cut off because it ran over the token budget. This time keep the text noticeably shorter (aim for 400-450 words for a Medium body, or 100-130 words for a LinkedIn post) so the complete output fits inside the limit.`;
    const retry = await requestJSON(system, tighterMsg, onModelTried);
    if (retry.truncated) {
      throw new Error(
        "A resposta foi cortada duas vezes seguidas pelo limite de tokens, mesmo pedindo um texto mais curto na segunda tentativa."
      );
    }
    text = retry.text;
    model = retry.model;
  }
  return { data: parse(text), model };
}

const LESSON_SYSTEM = `You extract ONE reusable writing lesson from an editor's feedback on a draft you previously generated.

You will receive: the headline, the content pillar, a score from 1 to 10, and the editor's note about what they changed or disliked.

Write a lesson that is:
- Actionable as a writing instruction for future drafts, not a description of this one draft. Bad: "the hook about token costs was weak". Good: "open with the reader's own failure, not with an industry trend".
- Specific enough to change behavior. Avoid generic advice like "be more engaging" or "write better hooks".
- One sentence, imperative mood, under 25 words.
- Written in English, since it gets injected into an English writing prompt.

If the editor's note is empty or too vague to yield a real lesson, derive the lesson from the score alone and be conservative.

Output format: plain text fields, NOT JSON. Follow this shape exactly:

SCOPE: <one of: hook, structure, voice, specificity, topic-selection>
LESSON: <one imperative sentence under 25 words, on a single line>

Write nothing else. Do not wrap the output in code fences. Do not use JSON.`;

const STORAGE_KEY = "contentmachine:lessons";
const MAX_INJECTED_LESSONS = 6;

async function loadLessons() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function persistLessons(lessons) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
    return true;
  } catch (e) {
    console.error("storage set failed", e);
    return false;
  }
}

function buildMediumSystem(lessons) {
  if (!lessons.length) return MEDIUM_SYSTEM;
  const recent = lessons.slice(0, MAX_INJECTED_LESSONS);
  const block = recent.map((l, i) => `${i + 1}. [${l.scope}] ${l.lesson}`).join("\n");
  return `${MEDIUM_SYSTEM}

LESSONS FROM PREVIOUS DRAFTS (the editor corrected these before, do not repeat the mistakes):
${block}

These lessons override the generic guidance above when they conflict.`;
}

function pillarStats(lessons) {
  const map = new Map();
  for (const l of lessons) {
    if (!l.pillar || typeof l.score !== "number") continue;
    const cur = map.get(l.pillar) || { total: 0, count: 0 };
    cur.total += l.score;
    cur.count += 1;
    map.set(l.pillar, cur);
  }
  return [...map.entries()]
    .map(([pillar, v]) => ({ pillar, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg);
}

const COVER_THEMES = {
  dark: { bg: "#1C1F18", ink: "#EDEAE0", muted: "rgba(237,234,224,0.45)", rule: "rgba(237,234,224,0.18)", accent: "#C4F04C", chipInk: "#14150F" },
  light: { bg: "#F2F0EA", ink: "#14150F", muted: "rgba(20,21,15,0.45)", rule: "rgba(20,21,15,0.18)", accent: "#D97757", chipInk: "#F2F0EA" },
};

const DISPLAY_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO_STACK = "ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace";

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitBlock(ctx, { headline, subtitle, maxWidth, maxHeight, maxLines, startSize, minSize, subRatio }) {
  let size = startSize;
  let result = null;

  while (size >= minSize) {
    ctx.font = `700 ${size}px ${DISPLAY_STACK}`;
    const lines = wrapLines(ctx, headline, maxWidth);
    const lineH = size * 1.06;

    const subSize = Math.round(size * subRatio);
    let subLines = [];
    if (subtitle) {
      ctx.font = `italic ${subSize}px Georgia, 'Times New Roman', serif`;
      subLines = wrapLines(ctx, subtitle, maxWidth).slice(0, 2);
    }
    const subGap = subtitle ? subSize * 0.95 : 0;
    const subH = subtitle ? subLines.length * subSize * 1.3 : 0;
    const totalH = lines.length * lineH + subGap + subH;

    if (lines.length <= maxLines && totalH <= maxHeight) {
      return { size, lines, lineH, subSize, subLines, subGap, totalH };
    }
    result = { size, lines, lineH, subSize, subLines, subGap, totalH };
    size -= 3;
  }

  // Piso atingido: corta linhas até caber na altura disponível, preservando o rodapé.
  const { lineH, subSize, subLines, subGap } = result;
  const subH = subLines.length * subSize * 1.3;
  const roomForLines = Math.max(1, Math.floor((maxHeight - subGap - subH) / lineH));
  const keep = Math.min(result.lines.length, roomForLines, maxLines);
  const lines = result.lines.slice(0, keep);
  if (keep < result.lines.length) {
    lines[keep - 1] = lines[keep - 1].replace(/\s+\S*$/, "") + "...";
  }
  return {
    size: minSize,
    lines,
    lineH,
    subSize,
    subLines,
    subGap,
    totalH: lines.length * lineH + subGap + subH,
  };
}

function drawCover(canvas, { headline, subtitle, pillar, themeKey, format }) {
  if (!canvas) return;
  const W = format === "medium" ? 1500 : 1200;
  const H = format === "medium" ? 750 : 1200;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const t = COVER_THEMES[themeKey];
  const pad = format === "medium" ? 90 : 100;

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  // eyebrow: short rule + mono label
  const eyebrowY = pad + 8;
  ctx.strokeStyle = t.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, eyebrowY);
  ctx.lineTo(pad + 46, eyebrowY);
  ctx.stroke();

  ctx.fillStyle = t.muted;
  ctx.font = `500 ${format === "medium" ? 19 : 21}px ${MONO_STACK}`;
  ctx.textBaseline = "middle";
  const eyebrowText = (pillar || "AI STRATEGY").toUpperCase().split("").join(" ");
  ctx.fillText(eyebrowText, pad + 66, eyebrowY);

  // --- Zonas de layout, calculadas de baixo para cima antes de desenhar qualquer texto ---
  const isMedium = format === "medium";
  const bylineBaseline = H - pad;
  const ruleY = bylineBaseline - (isMedium ? 46 : 58);
  const nodeR = isMedium ? 17 : 19;
  const nodeY = ruleY - (isMedium ? 42 : 52) - nodeR;
  const contentTop = eyebrowY + (isMedium ? 76 : 94);
  const contentBottom = nodeY - nodeR - (isMedium ? 40 : 48);
  const availH = Math.max(120, contentBottom - contentTop);

  const maxTextW = W - pad * 2;
  const block = fitBlock(ctx, {
    headline,
    subtitle,
    maxWidth: maxTextW,
    maxHeight: availH,
    maxLines: isMedium ? 4 : 6,
    startSize: isMedium ? 88 : 96,
    minSize: isMedium ? 40 : 44,
    subRatio: isMedium ? 0.34 : 0.36,
  });

  // Bloco centralizado dentro da zona livre, nunca ultrapassando o topo dela.
  let y = contentTop + Math.max(0, (availH - block.totalH) / 2);

  ctx.fillStyle = t.ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${block.size}px ${DISPLAY_STACK}`;
  for (const ln of block.lines) {
    ctx.fillText(ln, pad, y + block.size * 0.82);
    y += block.lineH;
  }

  if (block.subLines.length) {
    y += block.subGap;
    ctx.fillStyle = t.muted;
    ctx.font = `italic ${block.subSize}px Georgia, 'Times New Roman', serif`;
    for (const ln of block.subLines) {
      ctx.fillText(ln, pad, y + block.subSize * 0.8);
      y += block.subSize * 1.3;
    }
  }

  // pipeline nodes, echoing the run panel
  const span = isMedium ? 420 : 470;
  const gap = span / 3;
  ctx.strokeStyle = t.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad + nodeR, nodeY);
  ctx.lineTo(pad + span - nodeR, nodeY);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const cx = pad + gap * i;
    ctx.beginPath();
    ctx.arc(cx, nodeY, nodeR, 0, Math.PI * 2);
    ctx.fillStyle = t.accent;
    ctx.fill();
    ctx.fillStyle = t.chipInk;
    ctx.font = `500 ${isMedium ? 15 : 17}px ${MONO_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`0${i + 1}`, cx, nodeY + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // footer rule + byline
  ctx.strokeStyle = t.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, ruleY);
  ctx.lineTo(W - pad, ruleY);
  ctx.stroke();

  const footTextSize = isMedium ? 21 : 24;
  ctx.font = `500 ${footTextSize}px ${MONO_STACK}`;
  ctx.fillStyle = t.ink;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("JULIO PESSAN", pad, bylineBaseline);
  ctx.fillStyle = t.muted;
  ctx.font = `400 ${footTextSize - 3}px ${MONO_STACK}`;
  const right = "AI STRATEGIST";
  const rw = ctx.measureText(right).width;
  ctx.fillText(right, W - pad - rw, bylineBaseline);

  // corner mark
  const markSize = isMedium ? 34 : 38;
  ctx.fillStyle = t.accent;
  ctx.fillRect(W - pad - markSize, pad - 8, markSize, markSize);
  ctx.fillStyle = t.chipInk;
  ctx.font = `500 ${markSize * 0.52}px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C", W - pad - markSize / 2, pad - 8 + markSize / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function CoverStudio({ mediumData }) {
  const mediumRef = React.useRef(null);
  const linkedinRef = React.useRef(null);
  const [themeKey, setThemeKey] = useState("dark");

  useEffect(() => {
    if (!mediumData) return;
    const payload = {
      headline: mediumData.headline,
      subtitle: mediumData.subtitle,
      pillar: mediumData.pillar,
      themeKey,
    };
    const render = () => {
      drawCover(mediumRef.current, { ...payload, format: "medium" });
      drawCover(linkedinRef.current, { ...payload, format: "linkedin" });
    };
    render();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(render).catch(() => {});
    }
  }, [mediumData, themeKey]);

  function download(ref, name) {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  if (!mediumData) return null;

  return (
    <div className="mt-24">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Eyebrow>Capas</Eyebrow>
        <div className="flex items-center gap-2">
          {[
            ["dark", "Escuro"],
            ["light", "Claro"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setThemeKey(key)}
              className={`mono-face text-[10px] tracking-[0.16em] uppercase px-3.5 py-2 border transition-colors ${
                themeKey === key
                  ? "bg-[#14150F] text-[#F2F0EA] border-[#14150F]"
                  : "border-[#14150F]/30 text-[#14150F]/60 hover:border-[#14150F]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#14150F]/12 border border-[#14150F]/12 mt-6">
        <div className="bg-[#F2F0EA] p-8 rise">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="mono-face text-[11px] tracking-[0.2em] uppercase">Capa Medium</span>
              <span className="mono-face text-[10px] text-[#14150F]/40">1500 x 750</span>
            </div>
            <button
              onClick={() => download(mediumRef, "capa-medium.png")}
              className="mono-face text-[10px] tracking-[0.16em] uppercase border border-[#14150F]/30 px-3.5 py-2 hover:bg-[#14150F] hover:text-[#F2F0EA] transition-colors"
            >
              Baixar PNG
            </button>
          </div>
          <canvas ref={mediumRef} className="w-full h-auto block border border-[#14150F]/12" />
        </div>

        <div className="bg-[#F2F0EA] p-8 rise">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="mono-face text-[11px] tracking-[0.2em] uppercase">Capa LinkedIn</span>
              <span className="mono-face text-[10px] text-[#14150F]/40">1200 x 1200</span>
            </div>
            <button
              onClick={() => download(linkedinRef, "capa-linkedin.png")}
              className="mono-face text-[10px] tracking-[0.16em] uppercase border border-[#14150F]/30 px-3.5 py-2 hover:bg-[#14150F] hover:text-[#F2F0EA] transition-colors"
            >
              Baixar PNG
            </button>
          </div>
          <canvas
            ref={linkedinRef}
            className="w-full h-auto block border border-[#14150F]/12 max-w-[420px] mx-auto"
          />
        </div>
      </div>

      <p className="mono-face text-[10px] leading-relaxed text-[#14150F]/40 mt-4">
        Capas desenhadas localmente a partir da headline gerada. Sem custo de token e sem risco de a
        IA inventar um visual fora da marca.
      </p>
    </div>
  );
}

function Eyebrow({ children, tone = "dark" }) {
  const color = tone === "dark" ? "text-[#14150F]/45" : "text-[#EDEAE0]/40";
  const rule = tone === "dark" ? "bg-[#14150F]/30" : "bg-[#EDEAE0]/25";
  return (
    <div className={`flex items-center gap-3 ${color}`}>
      <span className={`h-px w-7 ${rule}`} />
      <span className="font-mono text-[10px] tracking-[0.22em] uppercase">{children}</span>
    </div>
  );
}

function StatusStrip() {
  return (
    <div className="bg-[#14150F] text-[#EDEAE0]">
      <div className="max-w-[1180px] mx-auto px-6 h-10 flex items-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#C4F04C]" />
        <span className="mono-face text-[10px] tracking-[0.16em] uppercase text-[#EDEAE0]/50">
          OpenRouter · Gemma 4 31B free · chave gerenciada no servidor
        </span>
      </div>
    </div>
  );
}

export default function ContentMachine() {
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [phase, setPhase] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [mediumData, setMediumData] = useState(null);
  const [linkedinData, setLinkedinData] = useState(null);
  const [copiedMedium, setCopiedMedium] = useState(false);
  const [copiedLinkedin, setCopiedLinkedin] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [lessons, setLessons] = useState([]);
  const [lessonsLoaded, setLessonsLoaded] = useState(false);
  const [score, setScore] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [savingLesson, setSavingLesson] = useState(false);
  const [lessonSaved, setLessonSaved] = useState(false);
  const [lessonError, setLessonError] = useState("");
  const [activeModel, setActiveModel] = useState(null);
  const [fallbackNotice, setFallbackNotice] = useState("");

  const { display: typedHeadline, done: headlineTyped } = useTypewriter(mediumData?.headline || "", {
    speed: 22,
    enabled: !!mediumData,
  });
  const linkedinHook = linkedinData ? splitHook(linkedinData.post).hook : "";
  const linkedinRest = linkedinData ? splitHook(linkedinData.post).rest : "";
  const { display: typedHook, done: hookTyped } = useTypewriter(linkedinHook, {
    speed: 22,
    enabled: !!linkedinData,
  });

  useEffect(() => {
    let alive = true;
    loadLessons().then((l) => {
      if (alive) {
        setLessons(l);
        setLessonsLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const stats = pillarStats(lessons);

  const busy = phase === "medium" || phase === "linkedin";
  const currentMessages = LOADING_MESSAGES[phase] || [];
  const currentMessage = currentMessages.length
    ? currentMessages[msgIndex % currentMessages.length]
    : "";

  useEffect(() => {
    if (!busy) return;
    setMsgIndex(0);
    setMsgVisible(true);
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIndex((i) => i + 1);
        setMsgVisible(true);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, [phase, busy]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  function trackModelAttempt(model) {
    setActiveModel(model);
    setFallbackNotice((prev) => {
      const idx = OPENROUTER_MODELS.indexOf(model);
      if (idx <= 0) return "";
      return `Modelo principal indisponível, usando ${model} (opção ${idx + 1} da lista).`;
    });
  }

  async function handleGenerate() {
    if (!topic.trim() || busy) return;
    setErrorMsg("");
    setMediumData(null);
    setLinkedinData(null);
    setElapsed(0);
    setScore(null);
    setEditNote("");
    setLessonSaved(false);
    setLessonError("");
    setFallbackNotice("");
    setActiveModel(null);
    setPhase("medium");
    try {
      const mediumUser = `Topic/headline seed: "${topic.trim()}"${
        context.trim() ? `\nAdditional angle or data point to weave in: ${context.trim()}` : ""
      }`;
      const medium = await callClaude(buildMediumSystem(lessons), mediumUser, parseMedium, trackModelAttempt);
      setMediumData(medium.data);
      setPhase("linkedin");

      const linkedinUser = `Medium headline: ${medium.data.headline}\nSubtitle: ${medium.data.subtitle}\nPillar: ${medium.data.pillar}\nOpening of the article (for context, do not copy verbatim):\n${medium.data.body.slice(0, 700)}`;
      const linkedin = await callClaude(LINKEDIN_SYSTEM, linkedinUser, parseLinkedin, trackModelAttempt);
      setLinkedinData(linkedin.data);
      setPhase("done");
    } catch (e) {
      console.error(e);
      let msg;
      if (e.message === "server_missing_api_key") {
        msg = "O servidor ainda não tem a OPENROUTER_API_KEY configurada. Defina a env var no projeto Vercel.";
      } else if (e.message === "rate_limit") {
        msg = `Limite de taxa atingido em todos os modelos de fallback (${OPENROUTER_MODELS.join(", ")}). Espera alguns segundos e roda de novo.`;
      } else if (e.message.startsWith("http_")) {
        msg = `A API respondeu com erro ${e.message.replace("http_", "")}`;
      } else if (e.message.includes("cortada duas vezes")) {
        msg = e.message;
      } else {
        msg = `Resposta malformada. ${e.message}`;
      }
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  async function handleExtractLesson() {
    if (score === null || savingLesson || !mediumData) return;
    setSavingLesson(true);
    setLessonError("");
    try {
      const userMsg = `Headline: ${mediumData.headline}\nPillar: ${mediumData.pillar}\nScore given by the editor: ${score}/10\nEditor's note about what they changed or disliked: ${
        editNote.trim() || "(none provided)"
      }`;
      const out = await callClaude(LESSON_SYSTEM, userMsg, parseLesson, trackModelAttempt);
      const entry = {
        id: `${Date.now()}`,
        lesson: out.data.lesson,
        scope: out.data.scope || "voice",
        pillar: mediumData.pillar,
        score,
        headline: mediumData.headline,
        date: new Date().toISOString().slice(0, 10),
      };
      const next = [entry, ...lessons].slice(0, 40);
      setLessons(next);
      const ok = await persistLessons(next);
      if (!ok) {
        setLessonError("A lição foi aplicada nesta sessão, mas não consegui gravá-la para as próximas.");
      }
      setLessonSaved(true);
    } catch (e) {
      console.error(e);
      setLessonError(
        e.message === "rate_limit"
          ? "Limite de taxa da API. Espera alguns segundos e tenta extrair a lição de novo."
          : `Não consegui extrair a lição. ${e.message}`
      );
    } finally {
      setSavingLesson(false);
    }
  }

  async function removeLesson(id) {
    const next = lessons.filter((l) => l.id !== id);
    setLessons(next);
    await persistLessons(next);
  }

  async function copy(text, setter) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch (e) {
      console.error("clipboard failed", e);
    }
  }

  const runLabel =
    phase === "idle"
      ? "EM ESPERA"
      : phase === "error"
      ? "INTERROMPIDO"
      : phase === "done"
      ? "CONCLUÍDO"
      : "RODANDO";

  const runLabelClass =
    phase === "error"
      ? "bg-[#E8B84B] text-[#14150F]"
      : phase === "done"
      ? "bg-[#C4F04C] text-[#14150F]"
      : busy
      ? "bg-[#D97757] text-[#F2F0EA]"
      : "bg-[#EDEAE0]/10 text-[#EDEAE0]/50";

  return (
    <div className="min-h-screen bg-[#F2F0EA] text-[#14150F] antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        .display-face { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .serif-face { font-family: 'Instrument Serif', Georgia, serif; }
        .mono-face { font-family: 'JetBrains Mono', ui-monospace, 'Courier New', monospace; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-text {
          background: linear-gradient(90deg, rgba(217,119,87,0.35) 20%, #E8916E 50%, rgba(217,119,87,0.35) 80%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 2s linear infinite;
        }
        @keyframes pulseNode {
          0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,87,0.6); }
          50% { box-shadow: 0 0 0 8px rgba(217,119,87,0); }
        }
        .node-active { animation: pulseNode 1.7s ease-out infinite; }
        .msg-transition { transition: opacity 300ms ease, transform 300ms ease; }
        .msg-hidden { opacity: 0; transform: translateY(5px); }
        .msg-visible { opacity: 1; transform: translateY(0); }
        .rise { animation: rise 500ms cubic-bezier(0.2,0.7,0.3,1) both; }
        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .typewriter-cursor {
          display: inline-block;
          color: #D97757;
          animation: blink 0.9s step-end infinite;
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .fade-in-rest { display: inline; animation: fadeIn 450ms ease both; }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .decrypt-char { color: currentColor; }
        .decrypt-char[data-state="scramble"] { opacity: 0.45; }
        .decrypt-char[data-state="lock"] { animation: decryptFlash 380ms cubic-bezier(.2,0,0,1); }
        @keyframes decryptFlash {
          0% { opacity: 1; text-shadow: 0 0 10px currentColor; }
          100% { opacity: 1; text-shadow: 0 0 0 transparent; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-text { animation: none; color: #E8916E; }
          .msg-transition, .rise, .node-active, .typewriter-cursor, .fade-in-rest, .decrypt-char { animation: none; transition: none; }
        }
      `}</style>

      <StatusStrip />

      <header className="border-b border-[#14150F]/12">
        <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#14150F] flex items-center justify-center">
              <span className="mono-face text-[#C4F04C] text-[13px] font-medium">C</span>
            </div>
            <span className="mono-face text-[12px] tracking-[0.24em] font-medium">
              CONTENT MACHINE
            </span>
          </div>
          <span className="mono-face text-[10px] tracking-[0.2em] text-[#14150F]/40 uppercase">
            Orange DNA / HITS v1.3
          </span>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-6 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-14 lg:gap-16 items-start">
          <div>
            <Eyebrow>Camada de produção editorial</Eyebrow>

            <h1 className="display-face mt-7 text-[clamp(2.9rem,6.2vw,4.6rem)] leading-[0.92] tracking-[-0.035em] font-bold">
              <DecryptText as="span" text="Um tópico entra." stagger={26} />
              <br />
              <DecryptText
                as="span"
                text="dois drafts saem."
                className="serif-face italic font-normal tracking-[-0.01em]"
                stagger={26}
                startDelay={420}
              />
            </h1>

            <p className="mt-7 text-[17px] leading-relaxed text-[#14150F]/70 max-w-[46ch]">
              Escreve o artigo no Medium sob o framework HITS, depois reescreve o mesmo insight no
              formato nativo do LinkedIn. Os dois saem prontos pra colar, com as ênfases já marcadas.
            </p>

            <div className="mt-12 space-y-6">
              <div>
                <label className="mono-face block text-[10px] tracking-[0.2em] uppercase text-[#14150F]/45 mb-3">
                  Tópico ou headline
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="por que times de Gen AI subestimam custo de token em produção"
                  className="w-full bg-transparent border-b border-[#14150F]/25 pb-3 text-[17px] placeholder-[#14150F]/28 focus:outline-none focus:border-[#14150F] transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
              </div>

              <div>
                <label className="mono-face block text-[10px] tracking-[0.2em] uppercase text-[#14150F]/45 mb-3">
                  Ângulo ou dado real <span className="normal-case tracking-normal">(opcional)</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="qualquer detalhe que a IA não deveria inventar sozinha"
                  rows={2}
                  className="w-full bg-transparent border-b border-[#14150F]/25 pb-3 text-[15px] placeholder-[#14150F]/28 focus:outline-none focus:border-[#14150F] transition-colors resize-none"
                />
              </div>
            </div>

            <div className="mt-10 flex items-center gap-7">
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || busy}
                className="group bg-[#14150F] text-[#F2F0EA] px-8 py-4 flex items-center gap-4 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#000] transition-colors"
              >
                <span className="text-[15px]">{busy ? "Rodando o playbook" : "Rodar o playbook"}</span>
                <span className={`mono-face text-[13px] ${busy ? "text-[#E8916E]" : "text-[#C4F04C]"}`}>
                  {busy ? "●" : "→"}
                </span>
              </button>

              {phase === "done" && (
                <button
                  onClick={() => {
                    setPhase("idle");
                    setMediumData(null);
                    setLinkedinData(null);
                    setTopic("");
                    setContext("");
                  }}
                  className="mono-face text-[11px] tracking-[0.16em] uppercase text-[#14150F]/50 border-b border-[#14150F]/25 pb-1 hover:text-[#14150F] hover:border-[#14150F] transition-colors"
                >
                  Novo tópico
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="flex justify-end mb-3">
              <Eyebrow>Execução observada</Eyebrow>
            </div>

            <div className="bg-[#1C1F18] text-[#EDEAE0] p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      busy ? "bg-[#D97757]" : phase === "error" ? "bg-[#E8B84B]" : "bg-[#EDEAE0]/30"
                    }`}
                  />
                  <span className="mono-face text-[11px] tracking-[0.2em] uppercase">
                    Playbook editorial
                  </span>
                </div>
                <span className="mono-face text-[10px] tracking-[0.16em] text-[#EDEAE0]/40">
                  {activeModel ? activeModel.replace("google/", "").toUpperCase() : "HITS-01 / V1.3"}
                </span>
              </div>

              <div className="h-px bg-[#EDEAE0]/12 my-7" />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mono-face text-[10px] tracking-[0.2em] uppercase text-[#EDEAE0]/40 mb-2.5">
                    Execução atual
                  </p>
                  <p className="text-[21px] leading-snug truncate-none break-words">
                    {topic.trim() ? topic.trim() : "Nenhum tópico carregado"}
                  </p>
                </div>
                <span
                  className={`mono-face shrink-0 text-[10px] tracking-[0.16em] px-2.5 py-1.5 ${runLabelClass}`}
                >
                  {runLabel}
                </span>
              </div>

              {fallbackNotice && (
                <div className="mt-4 border border-[#E8B84B]/35 bg-[#E8B84B]/[0.06] px-4 py-2.5">
                  <p className="mono-face text-[10px] leading-relaxed text-[#E8B84B]">
                    {fallbackNotice}
                  </p>
                </div>
              )}

              <div className="h-px bg-[#EDEAE0]/12 my-7" />

              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-2.5">
                  <span className="mono-face text-[26px] leading-none">
                    {pad2(Math.min(elapsed, 99))}
                  </span>
                  <span className="mono-face text-[10px] tracking-[0.14em] text-[#EDEAE0]/45">
                    seg decorridos
                  </span>
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="mono-face text-[26px] leading-none">
                    {mediumData ? pad2(Math.min(wordCount(mediumData.body), 999)) : "--"}
                  </span>
                  <span className="mono-face text-[10px] tracking-[0.14em] text-[#EDEAE0]/45">
                    palavras medium
                  </span>
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="mono-face text-[26px] leading-none">
                    {linkedinData ? pad2(Math.min(wordCount(linkedinData.post), 999)) : "--"}
                  </span>
                  <span className="mono-face text-[10px] tracking-[0.14em] text-[#EDEAE0]/45">
                    palavras linkedin
                  </span>
                </div>
              </div>

              <div className="mt-10 mb-2 relative">
                <div className="absolute top-[13px] left-[6%] right-[6%] h-px bg-[#EDEAE0]/15" />
                <div className="relative flex justify-between">
                  {STAGES.map((s) => {
                    const st = stageState(s.id, phase);
                    return (
                      <div key={s.id} className="flex flex-col items-center gap-3 w-[25%]">
                        <div
                          className={`w-[27px] h-[27px] rounded-full flex items-center justify-center mono-face text-[10px] transition-colors duration-500 ${
                            st === "done"
                              ? "bg-[#C4F04C] text-[#14150F]"
                              : st === "active"
                              ? "bg-[#D97757] text-[#F2F0EA] node-active"
                              : "border border-[#EDEAE0]/25 text-[#EDEAE0]/35"
                          }`}
                        >
                          {s.num}
                        </div>
                        <span
                          className={`mono-face text-[9px] tracking-[0.16em] uppercase ${
                            st === "active"
                              ? "text-[#E8916E]"
                              : st === "done"
                              ? "text-[#EDEAE0]/70"
                              : "text-[#EDEAE0]/30"
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 min-h-[68px]">
                {busy && (
                  <div className="border border-[#D97757]/35 bg-[#D97757]/[0.07] px-5 py-4">
                    <p className="mono-face text-[9px] tracking-[0.2em] uppercase text-[#E8916E]/70 mb-2">
                      Em processamento
                    </p>
                    <span
                      className={`shimmer-text msg-transition text-[15px] ${
                        msgVisible ? "msg-visible" : "msg-hidden"
                      }`}
                    >
                      {currentMessage}
                    </span>
                  </div>
                )}

                {phase === "error" && (
                  <div className="border border-[#E8B84B]/45 bg-[#E8B84B]/[0.07] px-5 py-4 flex gap-4">
                    <div className="w-6 h-6 bg-[#E8B84B] text-[#14150F] flex items-center justify-center mono-face text-[13px] shrink-0">
                      !
                    </div>
                    <div>
                      <p className="mono-face text-[9px] tracking-[0.2em] uppercase text-[#E8B84B] mb-1.5">
                        Atenção necessária
                      </p>
                      <p className="text-[14px] leading-relaxed text-[#EDEAE0]/85">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {phase === "done" && (
                  <div className="border border-[#C4F04C]/30 bg-[#C4F04C]/[0.06] px-5 py-4">
                    <p className="mono-face text-[9px] tracking-[0.2em] uppercase text-[#C4F04C] mb-1.5">
                      Pronto para publicar
                    </p>
                    <p className="text-[14px] text-[#EDEAE0]/85">
                      Dois drafts gerados. Revise antes de publicar, o julgamento final continua seu.
                    </p>
                  </div>
                )}

                {phase === "idle" && (
                  <div className="border border-[#EDEAE0]/12 px-5 py-4">
                    <p className="mono-face text-[9px] tracking-[0.2em] uppercase text-[#EDEAE0]/35 mb-1.5">
                      Em espera
                    </p>
                    <p className="text-[14px] text-[#EDEAE0]/50">
                      Carregue um tópico à esquerda para iniciar a execução.
                    </p>
                  </div>
                )}
              </div>

              <div className="h-px bg-[#EDEAE0]/12 my-7" />

              <div className="flex items-center justify-between">
                <span className="mono-face text-[10px] tracking-[0.14em] text-[#EDEAE0]/40">
                  Dono <span className="text-[#EDEAE0]/75">Julio Pessan</span>
                </span>
                <span className="mono-face text-[10px] tracking-[0.14em] text-[#EDEAE0]/40">
                  Memória{" "}
                  <span className={lessons.length ? "text-[#E8916E]" : "text-[#EDEAE0]/75"}>
                    {lessons.length
                      ? `${Math.min(lessons.length, MAX_INJECTED_LESSONS)} LIÇÕES`
                      : "VAZIA"}
                  </span>
                </span>
                <span className="mono-face text-[10px] tracking-[0.14em] text-[#EDEAE0]/40">
                  Pilar{" "}
                  <span className="text-[#EDEAE0]/75">
                    {mediumData ? mediumData.pillar.toUpperCase() : "A DEFINIR"}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex justify-start mt-3">
              <Eyebrow>Julgamento humano no fim da linha</Eyebrow>
            </div>
          </div>
        </div>

        {(mediumData || linkedinData) && (
          <div className="mt-24">
            <Eyebrow>Saída</Eyebrow>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#14150F]/12 border border-[#14150F]/12 mt-6">
              {mediumData && (
                <div className="bg-[#F2F0EA] p-8 rise flex flex-col">
                  <div className="flex items-center justify-between mb-7">
                    <div className="flex items-center gap-3">
                      <span className="mono-face text-[11px] tracking-[0.2em] uppercase">Medium</span>
                      <span className="mono-face text-[10px] text-[#14150F]/40">
                        {wordCount(mediumData.body)} palavras / ~
                        {Math.max(1, Math.round(wordCount(mediumData.body) / 200))} min
                      </span>
                    </div>
                    <button
                      onClick={() => copy(buildMediumCopyText(mediumData), setCopiedMedium)}
                      className="mono-face text-[10px] tracking-[0.16em] uppercase border border-[#14150F]/30 px-3.5 py-2 hover:bg-[#14150F] hover:text-[#F2F0EA] transition-colors"
                    >
                      {copiedMedium ? "Copiado" : "Copiar"}
                    </button>
                  </div>

                  <h2 className="display-face text-[27px] leading-[1.1] tracking-[-0.02em] font-bold min-h-[1.1em]">
                    {headlineTyped ? mediumData.headline : typedHeadline}
                    {!headlineTyped && <span className="typewriter-cursor">▏</span>}
                  </h2>
                  <div
                    className={`transition-opacity duration-500 ${headlineTyped ? "opacity-100" : "opacity-0"}`}
                  >
                    <p className="serif-face italic text-[19px] text-[#14150F]/55 mt-2.5 mb-7">
                      {mediumData.subtitle}
                    </p>

                    <div className="text-[16px] leading-[1.72] text-[#14150F]/88 space-y-4 overflow-y-auto max-h-[440px] pr-2">
                      {mediumData.body.split("\n\n").map((para, i) => (
                        <p key={i}>{renderInlineBold(para, `md-${i}`)}</p>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-7 pt-6 border-t border-[#14150F]/12">
                      {mediumData.tags?.map((t, i) => (
                        <span
                          key={i}
                          className="mono-face text-[10px] tracking-[0.1em] text-[#14150F]/55 border border-[#14150F]/20 px-2.5 py-1"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <p className="mono-face text-[10px] leading-relaxed text-[#14150F]/40 mt-4">
                      No Medium, selecione os trechos marcados e aplique negrito na mão. O editor não
                      converte markdown ao colar.
                    </p>
                  </div>
                </div>
              )}

              {linkedinData && (
                <div className="bg-[#F2F0EA] p-8 rise flex flex-col">
                  <div className="flex items-center justify-between mb-7">
                    <div className="flex items-center gap-3">
                      <span className="mono-face text-[11px] tracking-[0.2em] uppercase">LinkedIn</span>
                      <span className="mono-face text-[10px] text-[#14150F]/40">
                        {wordCount(linkedinData.post)} palavras
                      </span>
                    </div>
                    <button
                      onClick={() => copy(buildLinkedinCopyText(linkedinData), setCopiedLinkedin)}
                      className="mono-face text-[10px] tracking-[0.16em] uppercase border border-[#14150F]/30 px-3.5 py-2 hover:bg-[#14150F] hover:text-[#F2F0EA] transition-colors"
                    >
                      {copiedLinkedin ? "Copiado" : "Copiar"}
                    </button>
                  </div>

                  <div className="text-[16px] leading-[1.72] text-[#14150F]/88 whitespace-pre-wrap flex-1 min-h-[1.72em]">
                    {hookTyped ? formatLinkedinForDisplay(linkedinHook) : typedHook}
                    {!hookTyped && <span className="typewriter-cursor">▏</span>}
                    {hookTyped && linkedinRest && (
                      <span className="fade-in-rest">{"\n\n"}{formatLinkedinForDisplay(linkedinRest)}</span>
                    )}
                  </div>

                  {linkedinData.hashtags && linkedinData.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-7 pt-6 border-t border-[#14150F]/12">
                      {linkedinData.hashtags.map((t, i) => (
                        <span key={i} className="mono-face text-[11px] text-[#14150F]/60">
                          #{t.replace(/\s+/g, "")}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mono-face text-[10px] leading-relaxed text-[#14150F]/40 mt-4">
                    O negrito aqui já é Unicode real. Cola direto no LinkedIn, sem formatação manual.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === "done" && mediumData && (
          <div className="mt-24">
            <Eyebrow>Fechar o loop</Eyebrow>
            <div className="border border-[#14150F]/12 mt-6 p-8">
              {!lessonSaved ? (
                <>
                  <p className="text-[17px] leading-relaxed max-w-[62ch]">
                    Depois de editar o texto, registre o que precisou mudar. A lição extraída entra
                    no prompt das próximas gerações, então o mesmo erro não se repete.
                  </p>

                  <div className="mt-8">
                    <label className="mono-face block text-[10px] tracking-[0.2em] uppercase text-[#14150F]/45 mb-3">
                      Nota do rascunho
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setScore(n)}
                          className={`mono-face w-11 h-11 text-[13px] border transition-colors ${
                            score === n
                              ? "bg-[#14150F] text-[#F2F0EA] border-[#14150F]"
                              : "border-[#14150F]/25 text-[#14150F]/60 hover:border-[#14150F]"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {score !== null && (
                      <p className="mono-face text-[10px] tracking-[0.14em] uppercase text-[#14150F]/45 mt-3">
                        {score >= 9 ? "Passou no critério de qualidade" : "Abaixo do critério, vale revisar"}
                      </p>
                    )}
                  </div>

                  <div className="mt-7">
                    <label className="mono-face block text-[10px] tracking-[0.2em] uppercase text-[#14150F]/45 mb-3">
                      O que você mudou <span className="normal-case tracking-normal">(opcional)</span>
                    </label>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={2}
                      placeholder="ex.: o gancho abriu com tendência de mercado em vez do problema do leitor"
                      className="w-full bg-transparent border-b border-[#14150F]/25 pb-3 text-[15px] placeholder-[#14150F]/28 focus:outline-none focus:border-[#14150F] transition-colors resize-none"
                    />
                  </div>

                  <button
                    onClick={handleExtractLesson}
                    disabled={score === null || savingLesson}
                    className="mt-8 bg-[#14150F] text-[#F2F0EA] px-7 py-3.5 flex items-center gap-4 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black transition-colors"
                  >
                    <span className="text-[15px]">
                      {savingLesson ? "Extraindo a lição" : "Extrair lição e memorizar"}
                    </span>
                    <span className={`mono-face text-[13px] ${savingLesson ? "text-[#E8916E]" : "text-[#C4F04C]"}`}>
                      {savingLesson ? "●" : "→"}
                    </span>
                  </button>
                </>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-[#C4F04C] text-[#14150F] flex items-center justify-center mono-face text-[13px] shrink-0">
                    {"✓"}
                  </div>
                  <div>
                    <p className="mono-face text-[10px] tracking-[0.2em] uppercase text-[#14150F]/45 mb-1.5">
                      Loop fechado
                    </p>
                    <p className="text-[16px] leading-relaxed max-w-[62ch]">
                      {lessons[0]?.lesson}
                    </p>
                  </div>
                </div>
              )}

              {lessonError && (
                <p className="mono-face text-[11px] leading-relaxed text-[#14150F]/60 mt-5 border-l-2 border-[#E8B84B] pl-4">
                  {lessonError}
                </p>
              )}
            </div>
          </div>
        )}

        {lessonsLoaded && lessons.length > 0 && (
          <div className="mt-24">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <Eyebrow>Memória da máquina</Eyebrow>
              <span className="mono-face text-[10px] tracking-[0.16em] uppercase text-[#14150F]/45">
                {lessons.length} {lessons.length === 1 ? "lição" : "lições"} / {Math.min(lessons.length, MAX_INJECTED_LESSONS)} em uso
              </span>
            </div>

            {stats.length > 0 && (
              <div className="border border-[#14150F]/12 mt-6 p-8">
                <p className="mono-face text-[10px] tracking-[0.2em] uppercase text-[#14150F]/45 mb-5">
                  Desempenho por pilar
                </p>
                <div className="space-y-3.5">
                  {stats.map((s) => (
                    <div key={s.pillar} className="flex items-center gap-4">
                      <span className="text-[14px] w-[150px] shrink-0">{s.pillar}</span>
                      <div className="flex-1 h-[3px] bg-[#14150F]/10">
                        <div
                          className="h-full bg-[#D97757]"
                          style={{ width: `${Math.max(4, (s.avg / 10) * 100)}%` }}
                        />
                      </div>
                      <span className="mono-face text-[12px] w-[74px] text-right text-[#14150F]/60">
                        {s.avg.toFixed(1)} / {s.count}x
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mono-face text-[10px] leading-relaxed text-[#14150F]/40 mt-6">
                  Média das notas e número de execuções por pilar. É o sinal que diz onde seus
                  rascunhos saem mais fortes.
                </p>
              </div>
            )}

            <div className="border border-[#14150F]/12 border-t-0 divide-y divide-[#14150F]/10">
              {lessons.map((l, i) => (
                <div key={l.id} className="p-6 flex items-start gap-5">
                  <span className="mono-face text-[11px] text-[#14150F]/35 pt-0.5 w-7 shrink-0">
                    {pad2(i + 1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] leading-relaxed">{l.lesson}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
                      <span className="mono-face text-[10px] tracking-[0.14em] uppercase text-[#14150F]/45">
                        {l.scope}
                      </span>
                      <span className="mono-face text-[10px] tracking-[0.14em] uppercase text-[#14150F]/45">
                        {l.pillar}
                      </span>
                      <span className="mono-face text-[10px] tracking-[0.14em] text-[#14150F]/45">
                        nota {l.score}
                      </span>
                      <span className="mono-face text-[10px] tracking-[0.14em] text-[#14150F]/35">
                        {l.date}
                      </span>
                      {i < MAX_INJECTED_LESSONS && (
                        <span className="mono-face text-[10px] tracking-[0.14em] uppercase text-[#D97757]">
                          em uso
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeLesson(l.id)}
                    className="mono-face text-[10px] tracking-[0.16em] uppercase text-[#14150F]/40 border-b border-transparent hover:text-[#14150F] hover:border-[#14150F] transition-colors shrink-0"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <CoverStudio mediumData={mediumData} />
      </main>
    </div>
  );
}
