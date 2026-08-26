import { useEffect, useRef, useState } from "react";

export type Sender = "ox" | "you" | "sys";

export interface ChatMessage {
  id: number;
  from: Sender;
  text: string;
}

export interface QuickAction {
  id: string;
  label: string;
}

interface TypeTextProps {
  text: string;
  instant?: boolean;
  onDone?: () => void;
  onTick?: () => void;
}

function TypeText({ text, instant = false, onDone, onTick }: TypeTextProps) {
  const [n, setN] = useState(instant ? text.length : 0);
  const doneRef = useRef(instant);

  useEffect(() => {
    if (instant) {
      setN(text.length);
      return;
    }
    if (n >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
      return;
    }
    const t = window.setTimeout(() => {
      setN((v) => Math.min(v + 1, text.length));
      onTick?.();
    }, 17);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, text, instant]);

  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span className="type-caret">▍</span>}
    </span>
  );
}

interface TransmissionLogProps {
  messages: ChatMessage[];
  typing: boolean;
  busy: boolean;
  actions: QuickAction[];
  onAction: (id: string) => void;
  onTypedDone?: () => void;
}

export default function TransmissionLog({
  messages,
  typing,
  busy,
  actions,
  onAction,
  onTypedDone,
}: TransmissionLogProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const latestId = messages.length ? messages[messages.length - 1].id : -1;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  return (
    <div className="w-full max-w-xl rounded-xl border border-line2 bg-deep shadow-[0_30px_70px_-20px_rgba(2,12,15,0.8)]">
      {/* barra da janela */}
      <div className="flex items-center gap-2.5 border-b border-line bg-panel px-4 py-3 rounded-t-xl">
        <span className="h-3 w-3 rounded-full bg-coral" />
        <span className="h-3 w-3 rounded-full bg-amber" />
        <span className="h-3 w-3 rounded-full bg-mint" />
        <p className="ml-2 truncate font-mono text-[11px] tracking-wide text-dim">
          canal: colega-ia · protocolo: oi~ v1.0
        </p>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-mint">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
          </span>
          ao vivo
        </span>
      </div>

      {/* log de mensagens */}
      <div
        ref={scrollRef}
        className="term-scroll flex h-[340px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:h-[360px] sm:px-5"
      >
        {messages.map((m) => {
          if (m.from === "sys") {
            return (
              <p
                key={m.id}
                className="msg-in self-center max-w-[90%] text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint"
              >
                {m.text}
              </p>
            );
          }
          const isOx = m.from === "ox";
          return (
            <div
              key={m.id}
              className={`msg-in flex max-w-[88%] items-end gap-2.5 ${isOx ? "self-start" : "self-end flex-row-reverse"}`}
            >
              <span
                className={`mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[12px] font-bold ${
                  isOx
                    ? "border-mint/50 bg-mint/15 text-mint"
                    : "border-amber/50 bg-amber/15 text-amber"
                }`}
              >
                {isOx ? "α" : "c"}
              </span>
              <div
                className={`rounded-lg rounded-b-sm border px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  isOx
                    ? "border-line2 bg-panel text-ink"
                    : "border-amber-deep bg-[#2b2413] text-[#ffe9bd]"
                }`}
              >
                <p className="mb-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] opacity-60">
                  {isOx ? "ox-alpha · hermes" : "você · este navegador"}
                </p>
                {isOx && m.id === latestId ? (
                  <TypeText
                    text={m.text}
                    onDone={() => {
                      scrollToBottom();
                      onTypedDone?.();
                    }}
                    onTick={scrollToBottom}
                  />
                ) : isOx ? (
                  <TypeText text={m.text} instant />
                ) : (
                  m.text
                )}
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="msg-in flex items-end gap-2.5 self-start">
            <span className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-mint/50 bg-mint/15 font-mono text-[12px] font-bold text-mint">
              α
            </span>
            <div className="flex items-center gap-1.5 rounded-lg rounded-b-sm border border-line2 bg-panel px-4 py-3.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mint" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mint" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mint" />
            </div>
          </div>
        )}
      </div>

      {/* respostas rápidas */}
      <div className="border-t border-line bg-panel/70 px-4 py-3.5 rounded-b-xl">
        <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-faint">
          ▸ responda o ox-alpha
        </p>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.id}
              onClick={() => onAction(a.id)}
              disabled={busy}
              className="group rounded-full border border-line2 bg-deep px-3.5 py-1.5 font-mono text-[12px] text-dim transition-all duration-200 hover:-translate-y-0.5 hover:border-mint hover:bg-mint/10 hover:text-mint active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-line2 disabled:hover:bg-deep disabled:hover:text-dim"
            >
              {a.label}
              <span className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
