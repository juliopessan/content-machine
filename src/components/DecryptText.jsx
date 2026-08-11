import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/*
 * Efeito de "decrypt": cada caractere nasce embaralhado e trava no lugar
 * certo em uma varredura da esquerda pra direita. Adaptado do padrão
 * DecryptText da Motiq (motiq.dev/components/decrypt-text, MIT), reduzido
 * ao essencial e sem tokens de cor/fonte próprios: os spans herdam
 * `currentColor` e a tipografia do elemento pai, então o efeito nunca muda
 * a aparência do texto, só a forma como ele chega na tela.
 */

const POOL = "#%&@$?!*+=/{}[]<>~^";

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function DecryptText({
  text,
  as: Tag = "span",
  className = "",
  speed = 42,
  stagger = 30,
  startDelay = 0,
  jitter = 90,
  seed = 1,
  ...rest
}) {
  const charRefs = useRef([]);
  const rafRef = useRef(null);
  const reduced = useReducedMotion();
  const chars = useMemo(() => Array.from(text), [text]);

  const play = useCallback(() => {
    const rng = makeRng(seed);
    const cells = charRefs.current;
    if (!cells.length) return;
    const lockAt = cells.map((_, idx) => startDelay + idx * stagger + (rng() * 2 - 1) * jitter);
    const nextAt = new Array(cells.length).fill(0);
    const locked = new Array(cells.length).fill(false);

    cells.forEach((el, idx) => {
      if (!el) return;
      if (chars[idx] === " ") {
        locked[idx] = true;
        return;
      }
      el.dataset.state = "scramble";
      el.textContent = POOL.charAt((rng() * POOL.length) | 0);
    });

    let remaining = cells.filter((_, idx) => !locked[idx]).length;
    const t0 = performance.now();

    const frame = () => {
      const now = performance.now() - t0;
      cells.forEach((el, idx) => {
        if (!el || locked[idx]) return;
        if (now >= lockAt[idx]) {
          el.textContent = chars[idx];
          el.dataset.state = "lock";
          locked[idx] = true;
          remaining -= 1;
        } else if (now >= nextAt[idx]) {
          el.textContent = POOL.charAt((rng() * POOL.length) | 0);
          nextAt[idx] = now + speed + rng() * 35;
        }
      });
      if (remaining <= 0) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [chars, jitter, seed, speed, stagger, startDelay]);

  useLayoutEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (reduced) {
      charRefs.current.forEach((el, idx) => {
        if (!el) return;
        el.textContent = chars[idx];
        el.dataset.state = "plain";
      });
      return;
    }
    play();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduced]);

  return (
    <Tag className={className} {...rest}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {chars.map((ch, i) => (
          <span
            key={i}
            data-state="plain"
            className="decrypt-char"
            ref={(el) => {
              charRefs.current[i] = el;
            }}
          >
            {ch}
          </span>
        ))}
      </span>
    </Tag>
  );
}
