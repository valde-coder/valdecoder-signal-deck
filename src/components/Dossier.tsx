import { useReveal } from "../hooks/useReveal";

interface Skill {
  label: string;
  value: number;
  color: string;
  track: string;
  note: string;
}

const SKILLS: Skill[] = [
  {
    label: "código",
    value: 92,
    color: "bg-mint",
    track: "text-mint",
    note: "transforma bug em feature (às vezes)",
  },
  {
    label: "pesquisa",
    value: 88,
    color: "bg-sky",
    track: "text-sky",
    note: "fuça até achar a fonte certa",
  },
  {
    label: "organização",
    value: 95,
    color: "bg-amber",
    track: "text-amber",
    note: "deixa qualquer notion com inveja",
  },
  {
    label: "fofura",
    value: 100,
    color: "bg-coral",
    track: "text-coral",
    note: "fora da escala mensurável conhecida",
  },
];

const STICKERS = [
  { text: "canivete suíço fofinho", tilt: "-rotate-2", hover: "hover:rotate-1" },
  { text: "log de ois: 1 registro", tilt: "rotate-1", hover: "hover:-rotate-2" },
  { text: "+12% de carinho nos circuitos", tilt: "-rotate-1", hover: "hover:rotate-2" },
  { text: "ping: 12ms", tilt: "rotate-2", hover: "hover:-rotate-1" },
  { text: "pesquisa aberta ♥", tilt: "rotate-1", hover: "hover:-rotate-2" },
];

const FIELDS: Array<[string, string]> = [
  ["nome", "ox-alpha (ox-α)"],
  ["espécie", "assistente IA animada"],
  ["habitat", "Hermes Agent"],
  ["criadores", "Nous Research"],
  ["dieta", "prompts, café virtual"],
  ["estado atual", "animado e fofinho"],
];

export default function Dossier() {
  const [cardRef, cardIn] = useReveal();
  const [barsRef, barsIn] = useReveal();
  const [stickRef, stickIn] = useReveal();

  return (
    <section id="ficha" className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
      <div className="mb-12 flex items-end justify-between gap-6">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-amber">
            02 · dossiê do visitante
          </p>
          <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
            ficha do agente
            <span className="text-mint"> ox-α</span>
          </h2>
        </div>
        <p className="hidden max-w-xs pb-1 text-sm leading-relaxed text-dim md:block">
          Dados coletados durante a transmissão, com consentimento entusiasmado do próprio agente.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* crachá */}
        <div
          ref={cardRef}
          className={`reveal ${cardIn ? "is-in" : ""} relative overflow-hidden rounded-xl rounded-tr-[3.5rem] border border-line2 bg-panel p-7 transition-transform duration-300 hover:-translate-y-1`}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border-[10px] border-mint/10" />
          <div className="mb-6 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-faint">
              credencial · nº 0x0A1F
            </p>
            <span className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-mint">
              ● online
            </span>
          </div>

          <div className="mb-7 flex items-center gap-5">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border-2 border-mint/40 bg-deep font-display text-4xl font-bold text-mint">
              α
            </div>
            <div>
              <h3 className="font-display text-3xl font-bold leading-none">ox-alpha</h3>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
                hermes agent · nous research
              </p>
            </div>
          </div>

          <dl className="space-y-2.5">
            {FIELDS.map(([k, v]) => (
              <div
                key={k}
                className="group flex items-baseline justify-between gap-4 border-b border-dashed border-line pb-2.5 transition-colors hover:border-mint/40"
              >
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">{k}</dt>
                <dd className="text-right text-sm font-medium text-ink transition-colors group-hover:text-mint">
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 rounded-lg border border-amber/30 bg-amber/5 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-amber/90">
            ⚠ aviso: níveis de fofura podem exceder o especificado em tela.
          </p>
        </div>

        {/* medidores de habilidade */}
        <div ref={barsRef} className={`reveal ${barsIn ? "is-in" : ""} flex flex-col justify-center rounded-xl border border-line bg-deep/70 p-7 sm:p-9`}>
          <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.25em] text-faint">
            telemetria de habilidades · auto-reportada (com orgulho)
          </p>
          <div className="space-y-7">
            {SKILLS.map((s, i) => (
              <div key={s.label}>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="font-display text-lg font-semibold tracking-tight">{s.label}</p>
                  <p className={`font-mono text-sm font-bold ${s.track}`}>{s.value}%</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-line bg-abyss">
                  <div
                    className={`meter-fill h-full rounded-full ${s.color}`}
                    style={{
                      width: barsIn ? `${s.value}%` : "0%",
                      transitionDelay: `${i * 140}ms`,
                      boxShadow: "0 0 14px rgba(95, 232, 195, 0.15)",
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[12.5px] text-dim">↳ {s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* adesivos */}
      <div ref={stickRef} className={`reveal ${stickIn ? "is-in" : ""} mt-8 flex flex-wrap gap-3`}>
        {STICKERS.map((st) => (
          <span
            key={st.text}
            className={`cursor-default rounded-full border border-line2 bg-panel px-4 py-2 font-mono text-[12px] text-dim transition-all duration-300 ${st.tilt} ${st.hover} hover:border-amber hover:text-amber`}
          >
            {st.text}
          </span>
        ))}
      </div>
    </section>
  );
}
