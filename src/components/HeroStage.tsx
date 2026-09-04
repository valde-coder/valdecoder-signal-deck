import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useMemo, useRef } from "react";
import { MOTION } from "../lib/motionTokens";

gsap.registerPlugin(useGSAP);

export interface HeroStageProps {
  onSelectCategory?: (cat: string) => void;
  onOpenCommandPalette?: () => void;
  onPlayFeaturedVideo?: () => void;
  onSignalPulse?: () => void;
}

export default function HeroStage({
  onPlayFeaturedVideo,
  onSignalPulse,
}: HeroStageProps) {
  const root = useRef<HTMLElement>(null);
  const titleBoxRef = useRef<HTMLHeadingElement>(null);
  const contentBoxRef = useRef<HTMLDivElement>(null);

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // GSAP Entrance timeline - Premium Technical (setup -> title -> proposition -> action)
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        ({ conditions }) => {
          if (conditions?.reduceMotion) {
            gsap.set(
              ".hero-animate, .hero-kicker-row, .hero-word-valde, .hero-word-coder, .hero-copy, .hero-actions > *, .hero-render-hud",
              {
                autoAlpha: 1,
                x: 0,
                y: 0,
                scale: 1,
              },
            );
            return;
          }

          // Single coordinated GSAP timeline: setup -> title -> proposition -> action
          // Total entrance duration: ~850ms (within 700-1100ms budget)
          const master = gsap.timeline({
            defaults: { ease: MOTION.ease.primary },
          });

          master
            // 1. Setup: Kicker (0.0s)
            .fromTo(
              ".hero-kicker-row",
              { autoAlpha: 0, y: MOTION.distance.sm },
              { autoAlpha: 1, y: 0, duration: MOTION.duration.normal },
              0.0,
            )
            // 2. Title: VALDE CODER (0.15s)
            .fromTo(
              [".hero-word-valde", ".hero-word-coder"],
              { autoAlpha: 0, y: MOTION.distance.lg },
              {
                autoAlpha: 1,
                y: 0,
                duration: MOTION.duration.slow,
                stagger: MOTION.stagger.quick,
              },
              0.15,
            )
            // 3. Proposition: Manifesto copy (0.35s)
            .fromTo(
              ".hero-copy",
              { autoAlpha: 0, y: MOTION.distance.normal },
              { autoAlpha: 1, y: 0, duration: MOTION.duration.normal },
              0.35,
            )
            // 4. Action: CTAs (0.48s) - ready for interaction immediately
            .fromTo(
              ".hero-actions > *",
              { autoAlpha: 0, y: MOTION.distance.sm },
              {
                autoAlpha: 1,
                y: 0,
                duration: MOTION.duration.normal,
                stagger: MOTION.stagger.normal,
              },
              0.48,
            )
            // 5. Telemetry HUD (enters seamlessly with actions)
            .fromTo(
              ".hero-render-hud",
              { autoAlpha: 0, x: MOTION.distance.sm },
              { autoAlpha: 1, x: 0, duration: MOTION.duration.normal },
              0.40,
            );
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  // Magnetic interaction clamped strictly to 4-6px with zero overshoot
  const handleMagnetic = (e: React.MouseEvent<HTMLElement>) => {
    if (reduced || window.innerWidth < 900) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const rawX = (e.clientX - (rect.left + rect.width / 2)) * 0.12;
    const rawY = (e.clientY - (rect.top + rect.height / 2)) * 0.12;
    const max = MOTION.magnet.maxOffset;
    const clampedX = Math.max(-max, Math.min(max, rawX));
    const clampedY = Math.max(-max, Math.min(max, rawY));

    gsap.to(el, {
      x: clampedX,
      y: clampedY,
      duration: MOTION.duration.fast,
      ease: MOTION.ease.subtle,
      overwrite: "auto",
    });
  };

  const handleMagneticReset = (e: React.MouseEvent<HTMLElement>) => {
    if (reduced) return;
    gsap.to(e.currentTarget, {
      x: 0,
      y: 0,
      duration: MOTION.duration.normal,
      ease: MOTION.ease.subtle,
      overwrite: "auto",
    });
  };

  const handlePulse = () => {
    onSignalPulse?.();
    if (root.current) {
      gsap.fromTo(
        root.current,
        { autoAlpha: 0.94 },
        { autoAlpha: 1, duration: MOTION.duration.normal, ease: MOTION.ease.subtle }
      );
    }
  };

  return (
    <section className="hero hero-v4" id="topo" ref={root}>
      {/* Telemetria HUD flutuante calma */}
      <div className="hero-render-hud hero-animate" aria-label="telemetria e estado da renderização">
        <button
          type="button"
          className="hero-render-status"
          onClick={handlePulse}
          title="Clique para enviar pulso de sinal ao deck"
        >
          <i className="led" />
          <span>DECK_OS: <strong>SINAL V4</strong></span>
          <span className="hero-hud-badge">ONLINE</span>
        </button>

        {/* Indicador calmo de sinal (3 barras sem animação infinita agressiva) */}
        <div className="hero-hud-eq" aria-hidden="true">
          <span className="hero-eq-bar active" style={{ height: "40%" }} />
          <span className="hero-eq-bar active" style={{ height: "80%" }} />
          <span className="hero-eq-bar active" style={{ height: "60%" }} />
        </div>
      </div>

      {/* Conteúdo principal do Hero */}
      <div className="hero-content-v4" ref={contentBoxRef}>
        <div className="hero-kicker-row hero-animate">
          <p className="hero-kicker">
            <i /> personal tech hub — v4.2.0
          </p>
        </div>

        {/* Título Monumental */}
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

        {/* Botões de Ação Principais */}
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
          </button>
        </div>
      </div>
    </section>
  );
}
