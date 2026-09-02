import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";

gsap.registerPlugin(useGSAP);

const GLYPHS = "▓▒░<>/\\[]{}#*+=~^01";

function scrambleText(el: HTMLElement, text: string, reduced: boolean): () => void {
  if (reduced) {
    el.textContent = text;
    return () => undefined;
  }
  let frame = 0;
  const iv = window.setInterval(() => {
    frame++;
    const prog = frame * 0.85;
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === " ") {
        out += " ";
        continue;
      }
      out += i < prog ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    el.textContent = out;
    if (prog >= text.length) {
      window.clearInterval(iv);
      el.textContent = text;
    }
  }, 24);
  return () => window.clearInterval(iv);
}


export interface HeroStageProps {
  onSelectCategory?: (cat: string) => void;
  onOpenCommandPalette?: () => void;
  onPlayFeaturedVideo?: () => void;
  onSignalPulse?: () => void;
}

export default function HeroStage({
  onSelectCategory,
  onOpenCommandPalette,
  onPlayFeaturedVideo,
  onSignalPulse,
}: HeroStageProps) {
  const root = useRef<HTMLElement>(null);
  const titleBoxRef = useRef<HTMLHeadingElement>(null);
  const [pulseCount, setPulseCount] = useState(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Interactive subtle 3D tilt on hero content
  useEffect(() => {
    if (reduced || (typeof window !== "undefined" && window.innerWidth < 900)) return;
    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      setTilt({ rx: -dy * 3.5, ry: dx * 3.5 });
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [reduced]);

  // GSAP Entrance timeline com Coreografia Cinematográfica Awwwards
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        ({ conditions }) => {
          if (conditions?.reduceMotion) {
            gsap.set(".hero-animate, .hero-kicker-row, .hero-word-valde, .hero-word-coder, .hero-decode-bar, .hero-copy, .hero-pill-btn, .hero-actions > *, .hero-render-hud", {
              autoAlpha: 1,
              x: 0,
              y: 0,
              scale: 1,
              clipPath: "inset(0% 0% 0% 0%)",
            });
            return;
          }

          // Timeline principal orquestrada
          const master = gsap.timeline({
            defaults: { ease: "expo.out" },
          });

          master
            // 1. Kicker e badge ao vivo (0.0s)
            .fromTo(
              ".hero-kicker-row",
              { autoAlpha: 0, x: -30, filter: "blur(4px)" },
              { autoAlpha: 1, x: 0, filter: "blur(0px)", duration: 0.65 },
            )
            // 2. Palavra VALDE - Reveal cinemático com corte vertical
            .fromTo(
              ".hero-word-valde",
              { autoAlpha: 0, y: 64, clipPath: "inset(0% 0% 100% 0%)" },
              {
                autoAlpha: 1,
                y: 0,
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 0.95,
                ease: "power4.out",
              },
              "-=0.4",
            )
            // 3. Palavra CODER - Reveal cinemático com corte superior
            .fromTo(
              ".hero-word-coder",
              { autoAlpha: 0, y: 50, clipPath: "inset(100% 0% 0% 0%)" },
              {
                autoAlpha: 1,
                y: 0,
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 0.95,
                ease: "power4.out",
              },
              "-=0.65",
            )
            // 4. Barra de decodificação viva com efeito de varredura
            .fromTo(
              ".hero-decode-bar",
              { autoAlpha: 0, scaleX: 0.85, transformOrigin: "left center", x: -20 },
              { autoAlpha: 1, scaleX: 1, x: 0, duration: 0.6, ease: "power3.out" },
              "-=0.5",
            )
            // 5. Parágrafo descritivo
            .fromTo(
              ".hero-copy",
              { autoAlpha: 0, y: 24, filter: "blur(3px)" },
              { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.65 },
              "-=0.4",
            )
            // 6. Pílulas de tópicos do Radar
            .fromTo(
              ".hero-pill-btn",
              { autoAlpha: 0, y: 16, scale: 0.92 },
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.5,
                stagger: 0.05,
                ease: "back.out(1.5)",
              },
              "-=0.35",
            )
            // 7. Botões de Ação
            .fromTo(
              ".hero-actions > *",
              { autoAlpha: 0, y: 22, scale: 0.96 },
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.6,
                stagger: 0.08,
                ease: "power3.out",
              },
              "-=0.3",
            )
            // 8. HUD de Telemetria lateral
            .fromTo(
              ".hero-render-hud",
              { autoAlpha: 0, x: 35, filter: "blur(4px)" },
              { autoAlpha: 1, x: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" },
              "-=0.7",
            );
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  // Efeito Magnético suave nos Botões e Pílulas
  const handleMagnetic = (e: React.MouseEvent<HTMLElement>) => {
    if (reduced || window.innerWidth < 900) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(el, {
      x: x * 0.28,
      y: y * 0.28,
      duration: 0.3,
      ease: "power2.out",
    });
  };

  const handleMagneticReset = (e: React.MouseEvent<HTMLElement>) => {
    if (reduced) return;
    gsap.to(e.currentTarget, {
      x: 0,
      y: 0,
      duration: 0.45,
      ease: "elastic.out(1.1, 0.4)",
    });
  };

  const handlePulse = () => {
    setPulseCount((c) => c + 1);
    onSignalPulse?.();
    if (root.current) {
      gsap.fromTo(
        root.current,
        { filter: "brightness(1.3) contrast(1.1)" },
        { filter: "brightness(1) contrast(1)", duration: 0.45, ease: "power2.out" }
      );
    }
  };

  return (
    <section className="hero hero-v4" id="topo" ref={root}>
      {/* Telemetria HUD flutuante */}
      <div className="hero-render-hud hero-animate" aria-label="telemetria e estado da renderização">
        <div className="hero-render-status" onClick={handlePulse} role="button" tabIndex={0} title="Clique para enviar pulso de sinal ao deck">
          <i className="led" />
          <span>FX_RENDER: <strong>SINAL V4</strong></span>
          <span className="hero-hud-badge">ONLINE</span>
        </div>
        

        {/* Mini equalizador de sinal */}
        <div className="hero-hud-eq" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="hero-eq-bar"
              style={{
                animationDelay: `${(i % 5) * 0.14}s`,
                animationDuration: `${0.65 + (i % 4) * 0.18}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Conteúdo principal do Hero */}
      <div
        className="hero-content-v4"
        style={{
          transform: `translateY(-50%) perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: "transform 0.18s ease-out",
        }}
      >
        <div className="hero-kicker-row hero-animate">
          <p className="hero-kicker">
            <i /> personal tech hub — v4.2.0
          </p>
        </div>

        {/* Título Monumental com micro-interações */}
        <h1
          className="hero-title-v4"
          aria-label="ValdeCoder"
          ref={titleBoxRef}
        >
          <span className="hero-word-valde hero-animate" data-text="VALDE">
            VALDE
          </span>
          <span className="hero-word-coder hero-animate" data-text="CODER">
            CODER
          </span>
        </h1>

        {/* Texto descritivo / Manifesto */}
        <p className="hero-copy hero-animate">
          Meu espaço na internet: um <strong>radar</strong> de tecnologia que vira{" "}
          <strong>experimento</strong>, que vira <strong>projeto</strong>, que vira{" "}
          <strong>artigo</strong> — e <strong>vídeo</strong> no canal.
        </p>

        {/* Botões de Ação Principais com magnetismo */}
        <div className="hero-actions hero-animate">
          <a
            className="hero-primary"
            href="#radar"
            onMouseMove={handleMagnetic}
            onMouseLeave={handleMagneticReset}
          >
            <span>Entrar no radar</span>
            <span className="hero-arrow" aria-hidden="true">↗</span>
          </a>

          <button
            type="button"
            className="hero-secondary"
            onMouseMove={handleMagnetic}
            onMouseLeave={handleMagneticReset}
            onClick={() => {
              if (onPlayFeaturedVideo) {
                onPlayFeaturedVideo();
              } else {
                const vidSec = document.getElementById("transmissoes");
                vidSec?.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            <span className="hero-play-icon" aria-hidden="true">▶</span>
            <span>Assistir EP 042: Shaders GLSL</span>
            <span className="hero-dur-tag">41min</span>
          </button>
        </div>
      </div>
    </section>
  );
}
