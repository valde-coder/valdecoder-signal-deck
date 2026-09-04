/**
 * PREMIUM TECHNICAL MOTION TOKENS
 * -------------------------------------------------------------
 * Easing principal: power3.out
 * Duração rápida: 120ms (0.12s)
 * Duração padrão: 260ms (0.26s)
 * Duração lenta: 520ms (0.52s)
 * Distância normal de entrada: 12-24px
 * Stagger: 40-70ms (0.04-0.07s)
 * Orçamento máximo de stagger: 400ms (0.4s)
 * Overshoot: zero na navegação e nos elementos editoriais
 * back/elastic: restrito a interações expressivas do mascote
 */

export const MOTION = {
  ease: {
    primary: "power3.out",
    exit: "power3.in",
    inOut: "power3.inOut",
    subtle: "power2.out",
    linear: "none",
    mascotExpressive: "back.out(1.6)",
  },
  duration: {
    fast: 0.12,      // 120ms - micro feedbacks, toggles
    normal: 0.26,    // 260ms - cards, buttons, reveals
    slow: 0.52,      // 520ms - hero entrance, major transitions
    modalEnter: 0.32,// 320ms - modal entrance
    modalExit: 0.20, // 200ms - modal exit (30-40% faster than enter)
  },
  distance: {
    sm: 12,
    normal: 18,
    lg: 24,
  },
  stagger: {
    quick: 0.04,     // 40ms
    normal: 0.05,    // 50ms
    slow: 0.07,      // 70ms
    maxBudget: 0.40, // 400ms max total stagger window
  },
  magnet: {
    maxOffset: 5,    // Clamped strictly to 4-6px
  },
} as const;
