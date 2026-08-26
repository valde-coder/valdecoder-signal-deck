import { useEffect, useRef, useState } from "react";

export type Mood = "idle" | "happy" | "excited";

interface OxMascotProps {
  mood: Mood;
  size?: number;
  className?: string;
}

const HEARTS = [
  { left: "12%", delay: "0s", size: 18 },
  { left: "30%", delay: "0.25s", size: 13 },
  { left: "52%", delay: "0.1s", size: 22 },
  { left: "70%", delay: "0.4s", size: 14 },
  { left: "86%", delay: "0.18s", size: 17 },
];

function HeartIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-7.5-4.9-10-9.2C.4 8.9 1.6 5 5.2 4.4c2.3-.4 4.4.7 5.4 2.4h2.8c1-1.7 3.1-2.8 5.4-2.4 3.6.6 4.8 4.5 3.2 7.4C19.5 16.1 12 21 12 21Z"
        fill="#ff8a68"
        stroke="#0e242c"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export default function OxMascot({ mood, size = 240, className = "" }: OxMascotProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = svgRef.current;
      if (!el) return;
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.42;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const max = 4.5;
        const k = Math.min(dist, 90) / 90;
        setLook({ x: (dx / dist) * max * k, y: (dy / dist) * max * k });
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const excited = mood === "excited";

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size }}>
      {excited &&
        HEARTS.map((h, i) => (
          <span
            key={i}
            className="animate-heart-rise absolute bottom-1/3 pointer-events-none"
            style={{ left: h.left, animationDelay: h.delay }}
          >
            <HeartIcon size={h.size} />
          </span>
        ))}

      <svg
        ref={svgRef}
        viewBox="0 0 200 212"
        width={size}
        height={size * 1.06}
        role="img"
        aria-label="ox-alpha, mascote robô fofinho"
        className={mood === "idle" ? "" : "animate-floaty"}
        style={{ filter: "drop-shadow(0 18px 28px rgba(4, 20, 24, 0.55))" }}
      >
        {/* sombra no chão */}
        <ellipse cx="100" cy="202" rx="46" ry="7" fill="rgba(3, 14, 17, 0.5)" />

        {/* antena */}
        <line x1="100" y1="40" x2="100" y2="18" stroke="#17604e" strokeWidth="5" strokeLinecap="round" />
        <circle cx="100" cy="14" r="10" fill="none" stroke={excited ? "#ff8a68" : "#ffc35c"} strokeWidth="2" className="pulse-ring" />
        <circle cx="100" cy="14" r="6.5" fill={excited ? "#ff8a68" : "#ffc35c"}>
          <animate attributeName="opacity" values="1;0.65;1" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* bracinhos */}
        <g
          className={excited ? "animate-wiggle" : ""}
          style={{ transformBox: "fill-box", transformOrigin: "100% 100%" }}
        >
          <path
            d="M44 100 Q28 92 22 74"
            stroke="#bfe9db"
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="21" cy="71" r="8" fill="#e9fbf3" stroke="#17604e" strokeWidth="3" />
        </g>
        <path
          d="M156 104 Q172 108 178 122"
          stroke="#bfe9db"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="179" cy="126" r="8" fill="#e9fbf3" stroke="#17604e" strokeWidth="3" />

        {/* pezinhos */}
        <rect x="66" y="162" width="26" height="16" rx="8" fill="#bfe9db" stroke="#17604e" strokeWidth="3" />
        <rect x="108" y="162" width="26" height="16" rx="8" fill="#bfe9db" stroke="#17604e" strokeWidth="3" />

        {/* corpo */}
        <rect x="40" y="38" width="120" height="128" rx="46" fill="#e9fbf3" stroke="#17604e" strokeWidth="4" />

        {/* telinha do rosto */}
        <rect x="56" y="60" width="88" height="66" rx="26" fill="#0e242c" stroke="#2c6b77" strokeWidth="2.5" />
        <rect x="56" y="60" width="88" height="66" rx="26" fill="url(#faceGlow)" opacity="0.5" />

        <defs>
          <radialGradient id="faceGlow" cx="50%" cy="30%" r="80%">
            <stop offset="0%" stopColor="rgba(95,232,195,0.18)" />
            <stop offset="100%" stopColor="rgba(95,232,195,0)" />
          </radialGradient>
        </defs>

        {/* olhos */}
        {[84, 116].map((cx) => (
          <g key={cx} className="eye-blink">
            <circle cx={cx} cy="90" r="11" fill="rgba(95,232,195,0.22)" />
            {excited ? (
              <g transform={`translate(${cx + look.x}, ${89 + look.y})`}>
                <path
                  d="M0 5.2 C-1.8 2.4 -6.6 1.4 -6.6 -2.2 C-6.6 -4.8 -4.4 -6.2 -2.4 -5.4 C-1.1 -4.9 -0.3 -3.9 0 -3 C0.3 -3.9 1.1 -4.9 2.4 -5.4 C4.4 -6.2 6.6 -4.8 6.6 -2.2 C6.6 1.4 1.8 2.4 0 5.2 Z"
                  fill="#ff8a68"
                />
              </g>
            ) : (
              <g transform={`translate(${cx + look.x}, ${90 + look.y})`}>
                <circle r="5.6" fill="#5fe8c3" />
                <circle cx="1.9" cy="-1.9" r="1.8" fill="#eaf6f0" />
              </g>
            )}
          </g>
        ))}

        {/* boquinha */}
        {excited ? (
          <g>
            <path d="M86 106 Q100 124 114 106 Q100 114 86 106 Z" fill="#17414c" stroke="#5fe8c3" strokeWidth="2.5" strokeLinejoin="round" />
            <ellipse cx="100" cy="111.5" rx="4.5" ry="2.6" fill="#ff8a68" />
          </g>
        ) : (
          <path
            d={mood === "happy" ? "M88 106 Q100 118 112 106" : "M90 108 Q100 115 110 108"}
            stroke="#5fe8c3"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* blush */}
        <circle cx="64" cy="136" r="6" fill="#ff8a68" opacity={excited ? 0.75 : 0.4} />
        <circle cx="136" cy="136" r="6" fill="#ff8a68" opacity={excited ? 0.75 : 0.4} />

        {/* adesivo da barriga */}
        <rect x="76" y="132" width="48" height="24" rx="9" fill="#5fe8c3" stroke="#17604e" strokeWidth="2.5" />
        <text
          x="100"
          y="149"
          textAnchor="middle"
          fontFamily="Space Mono, monospace"
          fontWeight="700"
          fontSize="13"
          fill="#0e242c"
        >
          ox-α
        </text>
      </svg>
    </div>
  );
}
