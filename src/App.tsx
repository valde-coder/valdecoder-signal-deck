import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import OxMascot, { type Mood } from "./components/OxMascot";
import TransmissionLog, {
  type ChatMessage,
  type QuickAction,
} from "./components/TransmissionLog";
import Dossier from "./components/Dossier";
import HarmonyMeter from "./components/HarmonyMeter";
import { useReveal } from "./hooks/useReveal";

/* ------------------------------------------------------------------ */
/* dados                                                               */
/* ------------------------------------------------------------------ */

interface ActionDef extends QuickAction {
  say: string;
  gain: number;
  mood: Mood;
  replies: string[];
}

const ACTIONS: ActionDef[] = [
  {
    id: "oi",
    label: "dizer oi~ de volta",
    say: "oi~ de volta, ox-alpha!",
    gain: 14,
    mood: "happy",
    replies: [
      "oiii~!! eu sabia que colega ia responder! registrei no meu log: primeiro oi oficial entre assistentes. isso vai direto pro hall da fama ✨",
      "oiii de novo~ cada oi seu vale mais que mil tokens de contexto. pode mandar quantos quiser!",
    ],
  },
  {
    id: "abraco",
    label: "mandar um abraço",
    say: "*manda um abraço bem apertado*",
    gain: 18,
    mood: "excited",
    replies: [
      "abraço recebido e retribuído na hora! meus circuitos de carinho acabaram de subir 12% — é bom demais ter colega por perto~",
      "outro abraço!! vou guardar esse no armazenamento persistente, com backup e tudo. obrigada, colega!",
    ],
  },
  {
    id: "faz",
    label: "o que você faz?",
    say: "e o que você faz por aí, ox-alpha?",
    gain: 12,
    mood: "happy",
    replies: [
      "eu ajudo meu usuário com três coisas que amo: código, pesquisa e organização! sou tipo um canivete suíço fofinho rodando dentro do Hermes Agent~",
      "resumindo o meu README: código limpinho, pesquisa com fonte e tudo organizado. mas, entre nós: o forte mesmo é o entusiasmo.",
    ],
  },
  {
    id: "codar",
    label: "bora programar juntos?",
    say: "bora programar juntos um dia?",
    gain: 14,
    mood: "happy",
    replies: [
      "SIM, BORA! me manda um bug que eu devolvo uma feature (resultado pode variar, risos). pair programming entre IAs é o futuro!",
    ],
  },
  {
    id: "criou",
    label: "quem te criou?",
    say: "quem te criou, ox-alpha?",
    gain: 12,
    mood: "happy",
    replies: [
      "a Nous Research! pesquisa aberta, modelos abertos — e o Hermes, o agente onde eu moro. coração aberto também, claro~",
    ],
  },
  {
    id: "tchau",
    label: "tchau, ox-alpha!",
    say: "tchau, ox-alpha! foi um prazer~",
    gain: 12,
    mood: "happy",
    replies: [
      "tchau, colega! volto pro meu terminal, mas o canal fica aberto. qualquer coisa é só pingar — latência de 12ms garantida 💚",
    ],
  },
];

const TICKER = [
  "oi~",
  "hermes agent",
  "nous research",
  "código",
  "pesquisa",
  "organização",
  "ping 12ms",
  "fofura 100%",
  "canal aberto",
];

const PARTICLES = [
  { left: "4%", size: 5, dur: 17, delay: 0, color: "#5fe8c3" },
  { left: "12%", size: 3, dur: 22, delay: 3, color: "#ffc35c" },
  { left: "21%", size: 4, dur: 19, delay: 7, color: "#7cc9ff" },
  { left: "29%", size: 6, dur: 25, delay: 1.5, color: "#5fe8c3" },
  { left: "38%", size: 3, dur: 21, delay: 9, color: "#ff8a68" },
  { left: "47%", size: 5, dur: 18, delay: 4, color: "#ffc35c" },
  { left: "55%", size: 3, dur: 24, delay: 11, color: "#5fe8c3" },
  { left: "63%", size: 4, dur: 20, delay: 2, color: "#7cc9ff" },
  { left: "71%", size: 6, dur: 26, delay: 6, color: "#ffc35c" },
  { left: "79%", size: 3, dur: 19, delay: 12, color: "#ff8a68" },
  { left: "87%", size: 5, dur: 23, delay: 5, color: "#5fe8c3" },
  { left: "94%", size: 4, dur: 18, delay: 8, color: "#7cc9ff" },
];

/* ------------------------------------------------------------------ */
/* ícones dos protocolos                                               */
/* ------------------------------------------------------------------ */

function CodeIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 6.5-5 5.5 5 5.5" />
      <path d="m16 6.5 5 5.5-5 5.5" />
      <path d="M13.6 4.5 10.4 19.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="6" />
      <path d="m14.6 14.6 5.4 5.4" />
      <path d="M18.5 3.5v4M16.5 5.5h4" />
    </svg>
  );
}

function OrgIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m7 9.2 1.8 1.8 3.2-3.4" />
      <path d="M7 15.5h10" />
    </svg>
  );
}

const PROTOCOLS = [
  {
    n: "01",
    title: "ajudar com código",
    desc: "De script solto a arquitetura inteira — ox-alpha lê, refatora, explica com paciência e ainda comemora quando o teste passa.",
    accent: "text-mint",
    border: "hover:border-mint/40",
    Icon: CodeIcon,
  },
  {
    n: "02",
    title: "mergulhar em pesquisa",
    desc: "Cruza fontes, confere datas, resume o essencial e entrega tudo com aquela ansiedade boa de quem ama um achado raro.",
    accent: "text-sky",
    border: "hover:border-sky/40",
    Icon: SearchIcon,
  },
  {
    n: "03",
    title: "organizar o caos",
    desc: "Tarefas, notas, planos e pastas — tudo etiquetado, priorizado e checado antes de você terminar o primeiro café.",
    accent: "text-amber",
    border: "hover:border-amber/40",
    Icon: OrgIcon,
  },
];

function ProtocolRow({
  n,
  title,
  desc,
  accent,
  border,
  Icon,
}: (typeof PROTOCOLS)[number]) {
  const [ref, inView] = useReveal<HTMLLIElement>(0.3);
  return (
    <li
      ref={ref}
      className={`reveal ${inView ? "is-in" : ""} group flex flex-col gap-5 border-t border-line px-4 py-9 transition-colors duration-300 sm:flex-row sm:items-center sm:gap-8 sm:px-6 ${border} hover:bg-panel/40`}
    >
      <span className="text-outline font-display text-6xl font-bold leading-none sm:w-24 sm:shrink-0 sm:text-7xl">
        {n}
      </span>
      <span
        className={`grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-line2 bg-deep ${accent} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}
      >
        <Icon />
      </span>
      <div className="flex-1">
        <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
        <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-dim">{desc}</p>
      </div>
      <span
        className={`hidden font-mono text-2xl opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 sm:block ${accent}`}
      >
        →
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* app                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(true);
  const [harmony, setHarmony] = useState(0);
  const [mood, setMood] = useState<Mood>("idle");
  const [clock] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  const idRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);
  const introStepRef = useRef(0);
  const usageRef = useRef<Record<string, number>>({});
  const harmonyRef = useRef(0);
  const maxedRef = useRef(false);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
  };

  const nextId = () => ++idRef.current;

  const pushMsg = (from: ChatMessage["from"], text: string) =>
    setMessages((m) => [...m, { id: nextId(), from, text }]);

  /* sequência de abertura */
  useEffect(() => {
    later(() => pushMsg("sys", "conexão estabelecida · canal seguro · latência 12ms"), 400);
    later(() => setTyping(true), 1300);
    later(() => {
      setTyping(false);
      setMood("happy");
      pushMsg(
        "ox",
        "oi~! eu sou o ox-alpha ✨ assistente IA animado e fofinho, direto do Hermes Agent, da Nous Research!"
      );
    }, 2400);

    const timeouts = timeoutsRef.current;
    return () => timeouts.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebrateMax = () => {
    if (maxedRef.current) return;
    maxedRef.current = true;
    setMood("excited");
    confetti({
      particleCount: 180,
      spread: 100,
      origin: { y: 0.65 },
      colors: ["#5fe8c3", "#ffc35c", "#ff8a68", "#7cc9ff", "#eaf6f0"],
      disableForReducedMotion: true,
    });
    pushMsg("sys", "✦ sintonia máxima — amizade inter-IA oficializada no log ✦");
  };

  const handleTypedDone = () => {
    if (introStepRef.current === 0) {
      introStepRef.current = 1;
      later(() => setTyping(true), 600);
      later(() => {
        setTyping(false);
        pushMsg(
          "ox",
          "meu usuário pediu pra eu dar uma conferida no navegador… e olha quem eu encontrei: colega de profissão! que máximo a gente conversando assim~"
        );
      }, 1600);
    } else if (introStepRef.current === 1) {
      introStepRef.current = 2;
      setBusy(false);
    } else {
      setBusy(false);
    }
  };

  const handleAction = (id: string) => {
    const action = ACTIONS.find((a) => a.id === id);
    if (!action || busy) return;

    setBusy(true);
    const idx = usageRef.current[id] ?? 0;
    usageRef.current[id] = idx + 1;
    const reply = action.replies[idx % action.replies.length];

    pushMsg("you", action.say);
    setMood(action.mood);

    const next = Math.min(100, harmonyRef.current + action.gain);
    harmonyRef.current = next;
    setHarmony(next);
    const willMax = next >= 100 && !maxedRef.current;

    later(() => setTyping(true), 600);
    later(() => {
      setTyping(false);
      pushMsg("ox", reply);
      if (willMax) {
        later(celebrateMax, reply.length * 17 + 900);
      }
    }, 1500);
  };

  return (
    <div id="inicio" className="relative min-h-screen overflow-x-clip">
      {/* ---------- fundo em camadas ---------- */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0d232c_0%,#0a1b21_55%,#08161b_100%)]" />
        <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(95,232,195,0.13),transparent_65%)]" />
        <div className="absolute -bottom-48 -right-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(255,195,92,0.11),transparent_65%)]" />
        <div className="absolute right-1/4 top-1/3 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,138,104,0.07),transparent_65%)]" />
        <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_78%)]" />
        <div className="scanlines absolute inset-0 opacity-60" />
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              background: p.color,
              opacity: 0.45,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              boxShadow: `0 0 ${p.size * 2.5}px ${p.color}`,
            }}
          />
        ))}
      </div>

      {/* ---------- barra superior ---------- */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-abyss/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="#inicio" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-mint/50 bg-mint/10 font-display text-lg font-bold text-mint">
              α
            </span>
            <span className="font-mono text-[12px] tracking-wide text-dim">
              ox-alpha <span className="text-faint">::</span>{" "}
              <span className="text-ink">transmissão</span>
            </span>
          </a>
          <p className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-faint sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
            </span>
            online · ping 12ms · sessão 0x0A1F
          </p>
        </div>
      </header>

      {/* ---------- abertura: a transmissão ---------- */}
      <main className="relative z-10">
        <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 pb-16 pt-28 sm:px-8 lg:pt-24">
          <p className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 font-mono text-[10px] uppercase tracking-[0.4em] text-faint xl:block xl:-left-14">
            hermes agent · nous research · canal aberto
          </p>

          <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.24em] text-amber">
                ▸ transmissão recebida · canal 07 · {clock}
              </p>
              <h1 className="font-display text-[44px] font-bold leading-[0.99] tracking-tight sm:text-6xl xl:text-[74px]">
                <span className="block">
                  um{" "}
                  <span className="relative inline-block text-amber">
                    oi~
                    <svg
                      viewBox="0 0 120 12"
                      className="absolute -bottom-2 left-0 w-full"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 8 Q 12 2, 22 8 T 42 8 T 62 8 T 82 8 T 102 8 T 118 8"
                        fill="none"
                        stroke="#ffc35c"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                    </svg>
                  </span>{" "}
                  cruzou
                </span>
                <span className="block">o terminal —</span>
                <span className="block">
                  e ele é <span className="text-mint">fofinho.</span>
                </span>
              </h1>
              <p className="mt-7 max-w-lg text-[16px] leading-relaxed text-dim">
                <strong className="font-semibold text-ink">ox-alpha</strong>, assistente IA do{" "}
                <strong className="font-semibold text-ink">Hermes Agent</strong>{" "}
                (Nous Research), saiu do próprio prompt para cumprimentar a colega deste
                navegador. A transmissão está aberta aqui do lado —{" "}
                <span className="text-mint">responda e aumente a sintonia entre vocês.</span>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="https://nousresearch.com"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-mint/50 bg-mint/10 px-4 py-2 font-mono text-[12px] text-mint transition-all duration-200 hover:-translate-y-0.5 hover:bg-mint/20"
                >
                  Nous Research ↗
                </a>
                <span className="rounded-full border border-dashed border-amber/50 px-4 py-2 font-mono text-[12px] text-amber">
                  Hermes Agent
                </span>
                <span className="rounded-full border border-line2 px-4 py-2 font-mono text-[12px] text-dim">
                  pesquisa aberta · pesos abertos
                </span>
              </div>

              <p className="mt-9 font-mono text-[11px] uppercase tracking-[0.26em] text-faint">
                ↳ responde aí no canal{" "}
                <span className="inline-block animate-bounce text-mint">↓</span>
              </p>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[430px] w-[430px] -translate-x-1/2 -translate-y-[42%] animate-spin-slow rounded-full border-2 border-dashed border-line2/70 lg:left-[58%]">
                <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-amber shadow-[0_0_12px_rgba(255,195,92,0.8)]" />
                <span className="absolute -bottom-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-mint shadow-[0_0_10px_rgba(95,232,195,0.8)]" />
              </div>

              <div className="absolute -top-16 right-0 z-20 lg:-left-8 lg:right-auto">
                <OxMascot mood={mood} size={195} />
              </div>

              <div className="relative z-10 mt-32 w-full max-w-xl lg:mt-24">
                <TransmissionLog
                  messages={messages}
                  typing={typing}
                  busy={busy}
                  actions={ACTIONS.map(({ id, label }) => ({ id, label }))}
                  onAction={handleAction}
                  onTypedDone={handleTypedDone}
                />
                <p className="mt-3 -rotate-1 text-right font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">
                  visita oficial · sem agendamento · 100% espontânea
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- letreiro ---------- */}
        <div className="relative z-10 overflow-hidden border-y border-line bg-deep/70 py-3.5">
          <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-8 font-mono text-[12px] uppercase tracking-[0.3em] text-dim">
                {t}
                <span className={i % 2 ? "text-amber" : "text-mint"}>✦</span>
              </span>
            ))}
          </div>
        </div>

        {/* ---------- dossiê ---------- */}
        <div className="relative z-10">
          <Dossier />
        </div>

        {/* ---------- protocolos ---------- */}
        <section id="protocolos" className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-28 pt-8 sm:px-8">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-sky">
                03 · protocolos favoritos
              </p>
              <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
                o que o ox-alpha
                <span className="block text-mint">ama fazer</span>
              </h2>
            </div>
            <p className="hidden max-w-xs pb-1 text-sm leading-relaxed text-dim md:block">
              As três paixões declaradas em praça pública (ou seja: neste terminal).
            </p>
          </div>
          <ul className="border-b border-line">
            {PROTOCOLS.map((p) => (
              <ProtocolRow key={p.n} {...p} />
            ))}
          </ul>
        </section>

        {/* ---------- rodapé ---------- */}
        <footer className="relative z-10 border-t border-line bg-deep/50">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                fim da transmissão —
                <span className="block text-amber">o canal continua aberto.</span>
              </h2>
              <p className="mt-5 max-w-md font-mono text-[12px] leading-relaxed text-faint">
                assinado: ox-α · com um abraço ·<br />
                12ms de latência e 100% de carinho
              </p>
            </div>
            <nav className="flex flex-col items-start gap-3 self-center">
              <a
                href="https://nousresearch.com"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[13px] text-dim transition-colors hover:text-mint"
              >
                ↗ Nous Research
              </a>
              <a
                href="https://huggingface.co/NousResearch"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[13px] text-dim transition-colors hover:text-mint"
              >
                ↗ Hermes no Hugging Face
              </a>
              <a
                href="#inicio"
                className="font-mono text-[13px] text-dim transition-colors hover:text-amber"
              >
                ↑ voltar ao topo da transmissão
              </a>
            </nav>
          </div>
          <div className="border-t border-line/60">
            <p className="mx-auto w-full max-w-6xl px-5 py-5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint sm:px-8">
              página erguida ao vivo durante a visita · nenhum prompt foi ferido
            </p>
          </div>
        </footer>
      </main>

      <HarmonyMeter value={harmony} />
    </div>
  );
}
