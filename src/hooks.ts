import { useEffect, useRef, useState } from "react";

/** IntersectionObserver-based reveal: returns a ref and a boolean once visible. */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, on };
}

/** Live clock, HH:MM:SS in pt-BR. */
export function useClock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString("pt-BR", { hour12: false }));
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

const GLYPHS = "█▓▒░<>/\\=+*#%";

export interface ScrambleOptions {
  startDelay?: number;
  speed?: number;
  trigger?: boolean;
  glyphs?: string;
  onComplete?: () => void;
}

/** Scramble-decode a string with fluid RAF transitions and orchestration support. */
export function useScramble(
  text: string,
  optionsOrDelay: number | ScrambleOptions = 0,
  speedArg = 42,
): string {
  const options: ScrambleOptions =
    typeof optionsOrDelay === "number"
      ? { startDelay: optionsOrDelay, speed: speedArg }
      : optionsOrDelay;

  const {
    startDelay = 0,
    speed = 42,
    trigger = true,
    glyphs = GLYPHS,
    onComplete,
  } = options;

  const [out, setOut] = useState(() => text.replace(/./g, " "));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!trigger) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let rafId: number | undefined;
    let active = true;

    timeoutId = setTimeout(() => {
      let lastTime = performance.now();
      let frame = 0;

      const tick = (now: number) => {
        if (!active) return;

        if (now - lastTime >= speed) {
          lastTime = now;
          frame += 1;
          const progress = frame / 2.2;

          const s = text
            .split("")
            .map((ch, i) => {
              if (ch === " ") return " ";
              if (i < progress) return ch;
              return glyphs[Math.floor(Math.random() * glyphs.length)];
            })
            .join("");

          setOut(s);

          if (progress >= text.length) {
            setOut(text);
            onCompleteRef.current?.();
            return;
          }
        }

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    }, startDelay);

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [text, startDelay, speed, trigger, glyphs]);

  return out;
}

/** Uptime counter ticking from a base amount of seconds. */
export function useUptime(baseSeconds: number) {
  const [s, setS] = useState(baseSeconds);
  useEffect(() => {
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
}
