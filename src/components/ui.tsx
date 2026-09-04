import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReveal } from "../hooks";
import type { Tone } from "../data/content";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- 3D tilt card with physics lerp & cursor-tracking glow ---------- */
export interface CardTiltProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  glowColor?: "volt" | "mint";
  maxTilt?: number;
  scale?: number;
  disabled?: boolean;
}

export function CardTilt({
  children,
  className,
  glowColor = "volt",
  maxTilt = 6.5,
  scale = 1.012,
  disabled = false,
  style,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: CardTiltProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const physics = useRef({
    currX: 0,
    currY: 0,
    targetX: 0,
    targetY: 0,
    currScale: 1,
    targetScale: 1,
    currGlowX: 0,
    currGlowY: 0,
    targetGlowX: 0,
    targetGlowY: 0,
    rafId: 0,
    isActive: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const updatePhysics = () => {
    const p = physics.current;
    const el = cardRef.current;
    if (!el) return;

    const lerpDamping = 0.14;
    p.currX += (p.targetX - p.currX) * lerpDamping;
    p.currY += (p.targetY - p.currY) * lerpDamping;
    p.currScale += (p.targetScale - p.currScale) * lerpDamping;
    p.currGlowX += (p.targetGlowX - p.currGlowX) * 0.22;
    p.currGlowY += (p.targetGlowY - p.currGlowY) * 0.22;

    el.style.setProperty("--glow-x", `${p.currGlowX.toFixed(1)}px`);
    el.style.setProperty("--glow-y", `${p.currGlowY.toFixed(1)}px`);

    if (reducedMotion || disabled) {
      el.style.transform = "none";
    } else {
      el.style.transform = `perspective(1000px) rotateX(${p.currX.toFixed(2)}deg) rotateY(${p.currY.toFixed(2)}deg) scale3d(${p.currScale.toFixed(3)}, ${p.currScale.toFixed(3)}, 1)`;
    }

    const delta =
      Math.abs(p.targetX - p.currX) +
      Math.abs(p.targetY - p.currY) +
      Math.abs(p.targetScale - p.currScale);

    if (delta > 0.005 || p.isActive) {
      p.rafId = requestAnimationFrame(updatePhysics);
    } else {
      if (!p.isActive) {
        p.currX = 0;
        p.currY = 0;
        p.currScale = 1;
        el.style.transform =
          reducedMotion || disabled
            ? "none"
            : "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
      }
      p.rafId = 0;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const p = physics.current;
    p.targetGlowX = x;
    p.targetGlowY = y;

    if (!reducedMotion && !disabled) {
      const normX = (x / rect.width) * 2 - 1;
      const normY = (y / rect.height) * 2 - 1;
      p.targetX = -normY * maxTilt;
      p.targetY = normX * maxTilt;
      p.targetScale = scale;
    }

    if (!p.rafId) {
      p.rafId = requestAnimationFrame(updatePhysics);
    }
    onMouseMove?.(e);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    const p = physics.current;
    p.isActive = true;
    if (!reducedMotion && !disabled) {
      p.targetScale = scale;
    }
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      p.currGlowX = x;
      p.currGlowY = y;
      p.targetGlowX = x;
      p.targetGlowY = y;
      cardRef.current.style.setProperty("--glow-x", `${x}px`);
      cardRef.current.style.setProperty("--glow-y", `${y}px`);
    }
    if (!p.rafId) {
      p.rafId = requestAnimationFrame(updatePhysics);
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(false);
    const p = physics.current;
    p.isActive = false;
    p.targetX = 0;
    p.targetY = 0;
    p.targetScale = 1;
    if (!p.rafId) {
      p.rafId = requestAnimationFrame(updatePhysics);
    }
    onMouseLeave?.(e);
  };

  useEffect(() => {
    return () => {
      if (physics.current.rafId) {
        cancelAnimationFrame(physics.current.rafId);
      }
    };
  }, []);

  const borderGlow =
    glowColor === "mint"
      ? "rgba(59, 224, 143, 0.5)"
      : "rgba(255, 217, 28, 0.5)";
  const surfaceGlow =
    glowColor === "mint"
      ? "rgba(59, 224, 143, 0.08)"
      : "rgba(255, 217, 28, 0.07)";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: "preserve-3d",
        willChange: "transform",
        ...style,
      }}
      className={cx("group/tilt relative isolate", className)}
      {...rest}
    >
      {/* cursor spotlight ambient glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300 z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(400px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${surfaceGlow}, transparent 70%)`,
        }}
        aria-hidden="true"
      />
      {/* cursor border glow highlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300 z-10"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(280px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${borderGlow}, transparent 65%)`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
        }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

export const TiltCard = CardTilt;

/* ---------- scroll reveal wrapper ---------- */
export function Reveal({
  children,
  delay = 0,
  duration,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        ...(duration ? { transitionDuration: `${duration}ms` } : {}),
        ...style,
      }}
      className={cx("rv", on && "on", className)}
    >
      {children}
    </div>
  );
}

/* ---------- section header with animated rule ---------- */
export function SectionHead({ index, title, note }: { index: string; title: ReactNode; note?: string }) {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="mb-10 md:mb-14">
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs tracking-[0.3em] text-volt">{index}</span>
        <span
          className={cx(
            "h-px flex-1 bg-line origin-left transition-transform duration-1000 ease-out",
            on ? "scale-x-100" : "scale-x-0",
          )}
        />
        {note && (
          <span className="hidden md:block max-w-[300px] text-right font-mono text-[10px] uppercase tracking-[0.2em] text-fog leading-relaxed">
            {note}
          </span>
        )}
      </div>
      <h2 className={cx("rv mt-5 font-display font-bold text-3xl md:text-5xl leading-[1.04] tracking-tight", on && "on")}>
        {title}
      </h2>
    </div>
  );
}

/* ---------- infinite marquee ---------- */
export function Marquee({
  items,
  className,
  itemClass,
  slow,
}: {
  items: string[];
  className?: string;
  itemClass?: string;
  slow?: boolean;
}) {
  const row = (key: string, hidden: boolean) => (
    <div key={key} aria-hidden={hidden} className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <span key={i} className={cx("flex items-center", itemClass)}>
          <span className="px-5">{it}</span>
          <DiamondGlyph className="h-2 w-2 shrink-0 text-volt/70" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={cx("overflow-hidden", className)}>
      <div className={cx("flex w-max", slow ? "animate-marquee-slow" : "animate-marquee")}>
        {row("a", false)}
        {row("b", true)}
      </div>
    </div>
  );
}

/* ---------- badges & chips ---------- */
const TONES: Record<Tone, { badge: string; dot: string }> = {
  volt: {
    badge: "text-volt border-volt/50 bg-volt/10 hover:border-volt hover:bg-volt/20 hover:shadow-[0_0_12px_rgba(255,217,28,0.3)]",
    dot: "bg-volt shadow-[0_0_6px_#ffd91c]",
  },
  mint: {
    badge: "text-mint border-mint/50 bg-mint/10 hover:border-mint hover:bg-mint/20 hover:shadow-[0_0_12px_rgba(59,224,143,0.3)]",
    dot: "bg-mint shadow-[0_0_6px_#3be08f]",
  },
  ghost: {
    badge: "text-fog border-line bg-transparent hover:border-fog/60 hover:text-bone hover:bg-line/20",
    dot: "bg-fog/50 group-hover/badge:bg-bone",
  },
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone] || TONES.ghost;
  return (
    <span
      className={cx(
        "group/badge inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-1 font-mono text-[9px] tracking-[0.15em] transition-all duration-200 ease-out select-none hover:scale-[1.03] active:scale-[0.97] md:text-[10px]",
        t.badge,
      )}
    >
      <span className={cx("h-1 w-1 rounded-full transition-transform duration-200 group-hover/badge:scale-125", t.dot)} />
      {label}
    </span>
  );
}

export function TagChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border border-line bg-coal/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bone/75 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-volt/60 hover:text-volt hover:bg-volt/10 hover:shadow-[0_2px_10px_-2px_rgba(255,217,28,0.25)] active:translate-y-0 active:scale-95 cursor-default select-none">
      {children}
    </span>
  );
}

/* ---------- hand-drawn SVG icons ---------- */
type IconProps = { className?: string };

export function ArrowUpRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 18 18 6" />
      <path d="M9 6h9v9" />
    </svg>
  );
}

export function ArrowUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

export function PlayGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7 4.5v15l13-7.5-13-7.5z" />
    </svg>
  );
}

export function StarGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={className}>
      <path d="M12 3.2 14.7 9l6.1.6-4.6 4.1 1.3 6-5.5-3.2L6.5 19.7l1.3-6L3.2 9.6 9.3 9 12 3.2z" />
    </svg>
  );
}

export function DiamondGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" className={className}>
      <rect x="2.4" y="2.4" width="5.2" height="5.2" transform="rotate(45 5 5)" fill="currentColor" />
    </svg>
  );
}

export function SignalBars({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 16" className={className}>
      <rect x="1" y="4" width="4" height="12" fill="var(--color-volt)" className="origin-bottom animate-eq" />
      <rect x="8" y="4" width="4" height="12" fill="var(--color-mint)" className="origin-bottom animate-eq" style={{ animationDelay: "0.25s" }} />
      <rect x="15" y="4" width="4" height="12" fill="var(--color-volt)" className="origin-bottom animate-eq" style={{ animationDelay: "0.5s" }} />
    </svg>
  );
}

export function RadarGlyph({
  className,
  activeTag,
}: IconProps & { activeTag?: string | null }) {
  const isLinux = activeTag === "Linux";
  const isIA = activeTag === "IA";
  const isHardware = activeTag === "Hardware";
  const isDev = activeTag === "Dev";
  const isSec = activeTag === "Segurança";
  const hasActive = Boolean(activeTag);

  return (
    <svg viewBox="0 0 64 64" fill="none" className={cx("transition-all duration-300", className)}>
      <circle
        cx="32"
        cy="32"
        r="29"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={hasActive ? "0.75" : "0.55"}
        className="transition-opacity duration-200"
      />
      <circle
        cx="32"
        cy="32"
        r="19"
        stroke="currentColor"
        strokeWidth="1"
        opacity={hasActive ? "0.45" : "0.3"}
        className="transition-opacity duration-200"
      />
      <circle
        cx="32"
        cy="32"
        r="9"
        stroke="currentColor"
        strokeWidth="1"
        opacity={hasActive ? "0.45" : "0.3"}
        className="transition-opacity duration-200"
      />
      <g className="animate-sweep" style={{ transformBox: "view-box", transformOrigin: "center" }}>
        <line x1="32" y1="32" x2="32" y2="4" stroke="var(--color-volt)" strokeWidth="1.5" />
        <path
          d="M32 32 L32 4 A28 28 0 0 1 47 8.6 Z"
          fill="var(--color-volt)"
          opacity={hasActive ? "0.22" : "0.14"}
          className="transition-opacity duration-150"
        />
      </g>

      {/* Linux node */}
      <g className="transition-transform duration-200">
        {isLinux && (
          <circle cx="44" cy="20" r="5" stroke="var(--color-mint)" strokeWidth="1" opacity="0.8" className="animate-ping origin-center" />
        )}
        <circle
          cx="44"
          cy="20"
          r={isLinux ? 3.2 : 2.2}
          fill="var(--color-mint)"
          className="transition-all duration-150"
          style={{ filter: isLinux ? "drop-shadow(0 0 5px #3be08f)" : undefined }}
        />
      </g>

      {/* IA node */}
      <g className="transition-transform duration-200">
        {isIA && (
          <circle cx="21" cy="42" r="5" stroke="var(--color-volt)" strokeWidth="1" opacity="0.8" className="animate-ping origin-center" />
        )}
        <circle
          cx="21"
          cy="42"
          r={isIA ? 3.2 : 1.6}
          fill="var(--color-volt)"
          opacity={isIA ? 1 : 0.8}
          className="transition-all duration-150"
          style={{ filter: isIA ? "drop-shadow(0 0 5px #ffd91c)" : undefined }}
        />
      </g>

      {/* Hardware node */}
      <g className="transition-transform duration-200">
        {isHardware && (
          <circle cx="46" cy="44" r="5" stroke="var(--color-volt)" strokeWidth="1" opacity="0.8" className="animate-ping origin-center" />
        )}
        <circle
          cx="46"
          cy="44"
          r={isHardware ? 3.2 : 1.8}
          fill="var(--color-volt)"
          opacity={isHardware ? 1 : 0.6}
          className="transition-all duration-150"
          style={{ filter: isHardware ? "drop-shadow(0 0 5px #ffd91c)" : undefined }}
        />
      </g>

      {/* Dev node */}
      <g className="transition-transform duration-200">
        {isDev && (
          <circle cx="18" cy="22" r="5" stroke="var(--color-mint)" strokeWidth="1" opacity="0.8" className="animate-ping origin-center" />
        )}
        <circle
          cx="18"
          cy="22"
          r={isDev ? 3.2 : 1.8}
          fill="var(--color-mint)"
          opacity={isDev ? 1 : 0.6}
          className="transition-all duration-150"
          style={{ filter: isDev ? "drop-shadow(0 0 5px #3be08f)" : undefined }}
        />
      </g>

      {/* Segurança node */}
      <g className="transition-transform duration-200">
        {isSec && (
          <circle cx="32" cy="14" r="5" stroke="var(--color-volt)" strokeWidth="1" opacity="0.8" className="animate-ping origin-center" />
        )}
        <circle
          cx="32"
          cy="14"
          r={isSec ? 3.2 : 1.6}
          fill="var(--color-volt)"
          opacity={isSec ? 1 : 0.5}
          className="transition-all duration-150"
          style={{ filter: isSec ? "drop-shadow(0 0 5px #ffd91c)" : undefined }}
        />
      </g>

      <circle cx="32" cy="32" r="2.6" fill="var(--color-volt)" />
    </svg>
  );
}

export function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 34 34" fill="none" className={className}>
      <rect x="1.25" y="1.25" width="31.5" height="31.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l8 16 8-16" stroke="var(--color-volt)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="27" r="2" fill="var(--color-mint)" />
    </svg>
  );
}

export function TerminalGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m5 7 5 5-5 5" />
      <path d="M13 17h6" />
    </svg>
  );
}
