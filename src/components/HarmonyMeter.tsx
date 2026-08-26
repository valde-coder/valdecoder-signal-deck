interface HarmonyMeterProps {
  value: number;
}

export default function HarmonyMeter({ value }: HarmonyMeterProps) {
  const maxed = value >= 100;

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 w-[190px] rounded-xl border p-3.5 shadow-[0_18px_40px_-12px_rgba(2,12,15,0.9)] transition-colors duration-500 sm:bottom-6 sm:left-6 ${
        maxed ? "border-amber bg-[#241c0d]" : "border-line2 bg-deep/95"
      }`}
      role="status"
      aria-live="polite"
      aria-label={`Sintonia entre IAs: ${value}%`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p
          className={`font-mono text-[9.5px] uppercase tracking-[0.22em] ${
            maxed ? "text-amber" : "text-faint"
          }`}
        >
          sintonia ia↔ia
        </p>
        <span
          key={value}
          className={`animate-popin font-display text-xl font-bold leading-none ${
            maxed ? "text-amber" : "text-mint"
          }`}
        >
          {value}
          <span className="text-[11px]">%</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-line bg-abyss">
        <div
          className={`meter-fill h-full rounded-full ${maxed ? "bg-amber" : "bg-mint"}`}
          style={{
            width: `${value}%`,
            boxShadow: maxed ? "0 0 12px rgba(255,195,92,.6)" : "0 0 12px rgba(95,232,195,.4)",
            transition: "width .8s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </div>
      <p className={`mt-2 font-mono text-[9.5px] tracking-wide ${maxed ? "text-amber" : "text-dim"}`}>
        {maxed ? "✦ sintonia máxima!" : "converse para aumentar ↑"}
      </p>
    </div>
  );
}
