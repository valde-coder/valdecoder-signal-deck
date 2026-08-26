import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/* ================================================================
   VALDECODER // deck de sinal — single-page hub
   ================================================================ */

/* ---------------- settings FX ---------------- */

export interface FxSettings {
  density: number;
  turb: number;
  speed: number;
  size: number;
  bloom: number;
  bloomOn: boolean;
  fov: number;
  orbit: boolean;
}

const DEFAULT_FX: FxSettings = {
  density: 2400,
  turb: 1,
  speed: 1,
  size: 2.2,
  bloom: 0.85,
  bloomOn: true,
  fov: 62,
  orbit: true,
};

function loadFx(): FxSettings {
  try {
    const raw = localStorage.getItem("vd-fx");
    if (raw) return { ...DEFAULT_FX, ...(JSON.parse(raw) as Partial<FxSettings>) };
  } catch {
    /* noop */
  }
  return DEFAULT_FX;
}

/* ---------------- shaders próprios ---------------- */

const VERT = /* glsl */ `
uniform float uTime;
uniform float uTurb;
uniform float uSpeed;
uniform float uSize;
uniform vec3 uMouse;
uniform float uMouseR;
uniform float uMouseF;
attribute float aScale;
attribute float aSeed;
varying float vMix;
varying float vFade;
varying float vSeed;

void main() {
  vec3 p = position;
  float t = uTime * uSpeed;
  float s = aSeed * 6.28318;

  float w = sin(p.x * 0.32 + t * 0.7 + s)
          + sin(p.z * 0.26 - t * 0.55 + s * 0.5)
          + sin((p.x + p.z) * 0.14 + t * 0.35);
  p.y += w * 1.05 * uTurb;
  p.y += sin(p.x * 0.8 + p.z * 0.6 + t * 1.3 + s * 2.0) * 0.25 * uTurb;

  vec2 dm = p.xz - uMouse.xz;
  float dist = length(dm);
  float fall = smoothstep(uMouseR, 0.0, dist);
  p.xz += (dm / max(dist, 0.001)) * fall * uMouseF * 2.2;
  p.y += fall * uMouseF * 1.4;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aScale * (1.0 + fall * 1.4) * (340.0 / -mv.z);

  vMix = p.y * 0.10 + aSeed * 0.55;
  vFade = smoothstep(95.0, 34.0, -mv.z);
  vSeed = aSeed;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uHue;
uniform float uGod;
varying float vMix;
varying float vFade;
varying float vSeed;

vec3 pal(float t) {
  return vec3(0.40, 0.55, 0.47)
       + vec3(0.33, 0.30, 0.35) * cos(6.28318 * (t + vec3(0.00, 0.12, 0.32)));
}

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.05, d);
  a *= a;

  float hue = vMix + uHue + uGod * uTime * 0.18;
  vec3 col = pal(hue);
  col = mix(col, vec3(1.0, 0.80, 0.42), step(0.94, fract(vSeed * 7.31)) * 0.85);

  float tw = 0.72 + 0.28 * sin(uTime * 1.6 + vSeed * 40.0);
  gl_FragColor = vec4(col * (1.0 + uGod * 0.5), a * vFade * tw);
}
`;

/* ---------------- cena WebGL ---------------- */

interface SceneApi {
  setFx(fx: FxSettings): void;
  setGod(on: boolean): void;
  dispose(): void;
}

function initScene(
  canvas: HTMLCanvasElement,
  fx0: FxSettings,
  reduced: boolean
): SceneApi {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  const mobile = window.innerWidth < 820;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#070c0a");

  const camera = new THREE.PerspectiveCamera(
    fx0.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    220
  );
  camera.position.set(0, 8.4, 26);
  camera.lookAt(0, 1.2, 0);

  const uniforms = {
    uTime: { value: 0 },
    uTurb: { value: fx0.turb },
    uSpeed: { value: reduced ? 0.12 : fx0.speed },
    uSize: { value: fx0.size },
    uMouse: { value: new THREE.Vector3(999, 0, 999) },
    uMouseR: { value: 7.5 },
    uMouseF: { value: 1.1 },
    uHue: { value: 0 },
    uGod: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  let geo: THREE.BufferGeometry | null = null;
  let points: THREE.Points | null = null;

  const build = (count: number) => {
    if (points) scene.remove(points);
    if (geo) geo.dispose();
    const n = Math.max(500, Math.min(3600, Math.round(count)));
    const pos = new Float32Array(n * 3);
    const scl = new Float32Array(n);
    const sed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 4 + Math.pow(Math.random(), 0.62) * 34;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1.6;
      pos[i * 3 + 2] = Math.sin(a) * r * 0.82;
      scl[i] = 0.5 + Math.random() * 1.5;
      sed[i] = Math.random();
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scl, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(sed, 1));
    points = new THREE.Points(geo, mat);
    scene.add(points);
  };

  build(mobile ? Math.min(fx0.density, 1200) : fx0.density);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    fx0.bloom,
    0.72,
    0.1
  );
  composer.addPass(bloomPass);

  let fx: FxSettings = { ...fx0 };
  const ndc = new THREE.Vector2(9, 9);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.4);
  const hit = new THREE.Vector3(999, 0, 999);
  const target = new THREE.Vector3(999, 0, 999);
  let orbitA = 0;
  let raf = 0;
  const clock = new THREE.Clock();

  const onMove = (e: PointerEvent) => {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  };
  const onLeave = () => target.set(999, 0, 999);
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  };

  window.addEventListener("pointermove", onMove);
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("resize", onResize);

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value = clock.elapsedTime;

    if (fx.orbit && !reduced) {
      orbitA += dt * 0.055;
      camera.position.x = Math.sin(orbitA) * 26;
      camera.position.z = Math.cos(orbitA) * 26;
      camera.position.y = 8.4;
      camera.lookAt(0, 1.2, 0);
    }

    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) target.copy(hit);
    (uniforms.uMouse.value as THREE.Vector3).lerp(target, 0.085);

    if (fx.bloomOn) composer.render();
    else renderer.render(scene, camera);
  };
  frame();

  return {
    setFx(next: FxSettings) {
      if (Math.round(next.density) !== Math.round(fx.density)) {
        build(mobile ? Math.min(next.density, 1400) : next.density);
      }
      fx = { ...next };
      uniforms.uTurb.value = next.turb;
      uniforms.uSpeed.value = reduced ? Math.min(0.12, next.speed * 0.12) : next.speed;
      uniforms.uSize.value = next.size;
      bloomPass.strength = next.bloom;
      if (Math.abs(camera.fov - next.fov) > 0.1) {
        camera.fov = next.fov;
        camera.updateProjectionMatrix();
      }
    },
    setGod(on: boolean) {
      uniforms.uGod.value = on ? 1 : 0;
      uniforms.uHue.value = on ? 0.4 : 0;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      if (geo) geo.dispose();
      mat.dispose();
      bloomPass.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}

/* ---------------- dados ---------------- */

const BOOT_LINES = [
  "VALDECODER OS v3.7.1 — núcleo de sinal",
  "> montando módulos ............... ok",
  "> calibrando antena .............. ok",
  "> compilando shaders próprios .... 60fps",
  "> decodificando fluxo ............ 100%",
  "> bem-vindo ao deck_",
];

const PHRASES = [
  "sistemas distribuídos",
  "shaders GLSL ao vivo",
  "homelab & firmware",
  "IA rodando local",
  "código aberto, sempre",
];

const TICKER_A = [
  "uptime do deck: 214d 07h",
  "sinal: estável",
  "latência 9ms",
  "bloom: ativo",
  "commits hoje: 14",
  "café: nível crítico",
  "antena calibrada",
  "modo CRT: disponível",
  "ping github: 23ms",
  "nenhum bug em produção (hoje)",
];

const TICKER_B = [
  "rust > medo",
  "0xC0FFEE",
  "sudo make me a sandwich",
  "git push --force (não faça isso)",
  "// TODO: dormir",
  "ssh -T git@github.com",
  "rm -rf node_modules && respirar",
  "funciona na minha máquina™",
  ":wq",
  "HTTP 418 — sou um bule",
];

type Cat = "ia" | "sistemas" | "web" | "hardware" | "seg" | "cultura";

interface Signal {
  cat: Cat;
  src: string;
  when: string;
  title: string;
  decode: string;
  str: number;
}

const SIGNALS: Signal[] = [
  {
    cat: "ia",
    src: "arxiv · rss próprio",
    when: "há 40min",
    title: "Modelos pequenos on-device viram padrão em apps de banco e saúde",
    decode: "DECODE: latência zero e dado sem sair do bolso vencem qualquer demo de modelo gigante. O jogo agora é comprimir, não inflar.",
    str: 5,
  },
  {
    cat: "sistemas",
    src: "lobsters",
    when: "há 2h",
    title: "io_uring chega a mais subsistemas e vira assunto obrigatório em kernel",
    decode: "DECODE: quem ainda trata I/O assíncrono no Linux como 'coisa de edge case' vai ficar para trás. Epoll tá aposentando aos poucos.",
    str: 4,
  },
  {
    cat: "web",
    src: "hacker news",
    when: "há 3h",
    title: "View Transitions API aterrissa nos navegadores restantes",
    decode: "DECODE: finalmente dá pra trocar de página sem aquele corte seco. Menos lib de 400kb pra fingir que é app nativo.",
    str: 4,
  },
  {
    cat: "hardware",
    src: "rss próprio",
    when: "há 5h",
    title: "RISC-V ganha aceleração vetorial decente nas placas de baixo custo",
    decode: "DECODE: comprei mais uma placa 'pra testar'. Minha estante já é um datacenter com sentimentos.",
    str: 3,
  },
  {
    cat: "seg",
    src: "mailing list",
    when: "há 8h",
    title: "Campanha de supply-chain atinge pacotes populares de build tooling",
    decode: "DECODE: confiem, mas verifiquem o lockfile. Reprodutibilidade deixou de ser frescura de purista faz tempo.",
    str: 5,
  },
  {
    cat: "ia",
    src: "hacker news",
    when: "há 11h",
    title: "LLM local de 8B bate assistente cloud em tarefas de shell, diz benchmark",
    decode: "DECODE: rodei no ThinkPad velho daqui do deck. Lento? Um pouco. Meu? Totalmente. E isso vale ouro.",
    str: 4,
  },
  {
    cat: "web",
    src: "blog · fediverso",
    when: "há 1d",
    title: "CSS anchor positioning dispensa bibliotecas de tooltip e popover",
    decode: "DECODE: cada vez que o CSS engole uma lib JS, um dev deleta 12kb e sorri sem saber o porquê.",
    str: 3,
  },
  {
    cat: "cultura",
    src: "zines · rss",
    when: "há 1d",
    title: "Cena de sites pessoais 'artesanais' cresce como resposta aos feeds",
    decode: "DECODE: esse deck aqui nasceu exatamente disso. Terreno próprio > aluguel em rede social.",
    str: 4,
  },
  {
    cat: "sistemas",
    src: "lobsters",
    when: "há 2d",
    title: "SQLite como formato de arquivo de aplicação ganha adoção real",
    decode: "DECODE: um arquivo, transações, busca completa — quer saber? Faz sentido. JSON gigante no disco é que era a gambiarra.",
    str: 3,
  },
];

const CATS: { id: Cat | "todos"; label: string }[] = [
  { id: "todos", label: "todos" },
  { id: "ia", label: "ia" },
  { id: "sistemas", label: "sistemas" },
  { id: "web", label: "web" },
  { id: "hardware", label: "hardware" },
  { id: "seg", label: "segurança" },
  { id: "cultura", label: "cultura" },
];

interface Project {
  name: string;
  tag: string;
  lang: string;
  langColor: string;
  stars: string;
  forks: string;
  status: "ativo" | "mantido" | "lab";
  stack: string[];
  span: string;
  glyph: number;
}

const PROJECTS: Project[] = [
  {
    name: "sinal-9",
    tag: "Painel em tempo real para sensores IoT via LoRa. Ingestão, alerta de anomalia e mapa de calor da cidade inteira rodando num Raspberry Pi.",
    lang: "Rust",
    langColor: "#dea584",
    stars: "2.1k",
    forks: "184",
    status: "ativo",
    stack: ["rust", "tokio", "typescript", "clickhouse"],
    span: "span 7",
    glyph: 0,
  },
  {
    name: "quebra-cabeça.gl",
    tag: "Playground GLSL direto no navegador: edite shaders com preview ao vivo, exporte para pen e compartilhe por URL curta.",
    lang: "TypeScript",
    langColor: "#3178c6",
    stars: "894",
    forks: "97",
    status: "ativo",
    stack: ["webgl2", "glsl", "vite"],
    span: "span 5",
    glyph: 1,
  },
  {
    name: "feirao",
    tag: "API de cotação de hortifrúti em tempo real, raspando preços das feiras locais. CLI com tabela e gráfico de terminal.",
    lang: "Go",
    langColor: "#00add8",
    stars: "512",
    forks: "41",
    status: "mantido",
    stack: ["go", "sqlite", "bubbletea"],
    span: "span 5",
    glyph: 2,
  },
  {
    name: "tecla",
    tag: "Firmware de teclado mecânico com macros por camada e tela OLED configurável — sem depender de software proprietário.",
    lang: "C",
    langColor: "#a8b9cc",
    stars: "1.3k",
    forks: "203",
    status: "ativo",
    stack: ["c", "arm", "usb-hid"],
    span: "span 7",
    glyph: 3,
  },
  {
    name: "maritaca",
    tag: "TTS leve em português brasileiro: 18MB de modelo, roda offline e lê qualquer texto com sotaque decente.",
    lang: "Python",
    langColor: "#ffd343",
    stars: "688",
    forks: "59",
    status: "lab",
    stack: ["python", "onnx", "fonemas pt-br"],
    span: "span 6",
    glyph: 4,
  },
  {
    name: "bueiro",
    tag: "Monitor de ocorrências urbanas: visão computacional detecta alagamento e buraco em câmeras públicas e avisa o bairro.",
    lang: "Python",
    langColor: "#ffd343",
    stars: "447",
    forks: "36",
    status: "lab",
    stack: ["python", "opencv", "mqtt"],
    span: "span 6",
    glyph: 5,
  },
];

interface Video {
  title: string;
  dur: string;
  views: string;
  date: string;
  tagv: string;
}

const VIDEOS: Video[] = [
  {
    title: "Do zero ao GLSL: escrevendo o fundo deste deck em 40 minutos",
    dur: "41:07",
    views: "38 mil",
    date: "jan 2026",
    tagv: "shaders",
  },
  {
    title: "Rust pra quem vem do JavaScript — sem drama, com exemplos",
    dur: "52:30",
    views: "61 mil",
    date: "nov 2025",
    tagv: "linguagens",
  },
  {
    title: "Homelab completo por R$ 800: o guia definitivo do ferro velho",
    dur: "34:18",
    views: "92 mil",
    date: "ago 2025",
    tagv: "hardware",
  },
  {
    title: "IA local num ThinkPad de 2014? Rodando LLM de 8B offline",
    dur: "27:44",
    views: "118 mil",
    date: "mai 2025",
    tagv: "ia local",
  },
];

const SKILLS: { k: string; v: number }[] = [
  { k: "TypeScript / front de batalha", v: 92 },
  { k: "GLSL / WebGL / three.js", v: 88 },
  { k: "Go & serviços de fundo", v: 84 },
  { k: "Rust (com sofrimento saudável)", v: 78 },
  { k: "Infra própria · homelab · CI", v: 81 },
  { k: "IA aplicada on-device", v: 74 },
];

const TIMELINE = [
  { y: "2014", t: "Primeiro blog em PHP artesanal. Horrível. Apaixonante." },
  { y: "2017", t: "Primeiro emprego: dev júnior quebrando produção às sextas (nunca mais)." },
  { y: "2019", t: "Primeiro repo open source com tração — 100 estrelas e uma crise existencial." },
  { y: "2021", t: "Homelab vira projeto sério: 4 máquinas, um rack e a conta de luz chorando." },
  { y: "2023", t: "Mergulho em shaders: percebi que GPU é um instrumento musical." },
  { y: "2026", t: "Deck v3 no ar — este site que você está decodificando agora." },
];

const SETUP = [
  "ThinkPad X220 (mod clássico)",
  "Teclado tecla-firmware 40%",
  "Monitor 34\" ultrawide",
  "Raspberry Pi × 5 (cluster)",
  "HackRF One + antena caseira",
  "Cafeteira italiana (infra crítica)",
];

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "KeyB", "KeyA",
];

/* ---------------- toasts ---------------- */

type ToastFn = (msg: string, warm?: boolean) => void;
let toastFn: ToastFn | null = null;
const toast = (msg: string, warm = false) => toastFn?.(msg, warm);

function Toasts() {
  const [items, setItems] = useState<{ id: number; msg: string; warm: boolean }[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    toastFn = (msg, warm = false) => {
      const id = ++idRef.current;
      setItems((l) => [...l.slice(-3), { id, msg, warm }]);
      window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 2800);
    };
    return () => {
      toastFn = null;
    };
  }, []);

  return (
    <div className="toast-wrap" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.warm ? " warm" : ""}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ---------------- reveal / stagger ---------------- */

function useStagger<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    if (els.length === 0) return;
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((en) => {
          if (en.isIntersecting) {
            (en.target as HTMLElement).classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/* ---------------- hover magnético ---------------- */

function Mag({
  children,
  strength = 0.28,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0;
    let ty = 0;
    let inside = false;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < 140) {
        inside = true;
        tx = dx * strength;
        ty = dy * strength;
      } else if (inside) {
        inside = false;
        tx = 0;
        ty = 0;
      }
      el.style.transform = `translate(${tx}px, ${ty}px)`;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      inside = false;
      el.style.transform = "translate(0px, 0px)";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        display: "inline-block",
        willChange: "transform",
        transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- scramble / decode ---------------- */

const GLYPHS = "▓▒░<>/\\[]{}#*+=~^01";

function scrambleTo(el: HTMLElement, text: string, reduced: boolean): () => void {
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
  }, 28);
  return () => window.clearInterval(iv);
}

function Scramble({
  text,
  className,
  hover = true,
}: {
  text: string;
  className?: string;
  hover?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const wrapRef = useStagger<HTMLSpanElement>();
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const el = ref.current;
    if (!wrap || !el) return;
    const io = new IntersectionObserver(
      (ents) => {
        if (ents.some((e) => e.isIntersecting)) {
          cancelRef.current?.();
          cancelRef.current = scrambleTo(el, text, reduced);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(wrap);
    return () => {
      io.disconnect();
      cancelRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span
      ref={wrapRef}
      className={className}
      onMouseEnter={
        hover && !reduced
          ? () => {
              if (ref.current) {
                cancelRef.current?.();
                cancelRef.current = scrambleTo(ref.current, text, reduced);
              }
            }
          : undefined
      }
    >
      <span ref={ref}>{text}</span>
    </span>
  );
}

function RotatingDecode() {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [i, setI] = useState(0);
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;

  useEffect(() => {
    if (!ref.current) return;
    const cancel = scrambleTo(ref.current, PHRASES[i], reduced);
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    if (reduced) return;
    const iv = window.setInterval(() => setI((v) => (v + 1) % PHRASES.length), 3600);
    return () => window.clearInterval(iv);
  }, [reduced]);

  return (
    <p className="hero-sub">
      <span className="pre">agora decodificando: </span>
      <span className="hot" ref={ref}>
        {PHRASES[0]}
      </span>
      <span className="pre">_</span>
    </p>
  );
}

/* ---------------- boot ---------------- */

function Boot({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setLines(BOOT_LINES);
      const t = window.setTimeout(onDone, 350);
      return () => window.clearTimeout(t);
    }
    const timers: number[] = [];
    let li = 0;
    let ci = 0;
    const tick = () => {
      if (doneRef.current) return;
      const line = BOOT_LINES[li];
      ci++;
      setLines((prev) => {
        const next = [...prev];
        next[li] = line.slice(0, ci);
        return next;
      });
      if (ci >= line.length) {
        li++;
        ci = 0;
        if (li >= BOOT_LINES.length) {
          timers.push(window.setTimeout(finish, 380));
          return;
        }
        timers.push(window.setTimeout(tick, 70));
      } else {
        timers.push(window.setTimeout(tick, 6));
      }
    };
    const finish = () => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    };
    timers.push(window.setTimeout(tick, 150));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="boot" onClick={onDone} role="button" aria-label="pular introdução">
      <div className="boot-box">
        <p className="boot-title">V//D</p>
        {lines.map((l, idx) => (
          <div key={idx} className="boot-line">
            {l.includes("ok") ? (
              <>
                {l.replace("ok", "")}
                <span className="ok">ok</span>
              </>
            ) : (
              l
            )}
          </div>
        ))}
        <button className="boot-skip" type="button">
          pular boot ⏎
        </button>
      </div>
    </div>
  );
}

/* ---------------- cursor ---------------- */

function Cursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.body.classList.add("vd-fine");
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let visible = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        rx = x;
        ry = y;
        if (dotRef.current) dotRef.current.style.opacity = "1";
        if (ringRef.current) ringRef.current.style.opacity = "1";
      }
      if (dotRef.current)
        dotRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
      const t = e.target as HTMLElement | null;
      const hot = !!t?.closest("a, button, .chip, .proj, .vid, input, .fx-sw");
      ringRef.current?.classList.toggle("on", hot);
    };
    const onOut = () => {
      visible = false;
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      if (ringRef.current)
        ringRef.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onOut);
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onOut);
      document.body.classList.remove("vd-fine");
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" style={{ opacity: 0 }} />
      <div ref={ringRef} className="cursor-ring" style={{ opacity: 0 }} />
    </>
  );
}

/* ---------------- relógios ---------------- */

const fmtSP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const fmtDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
});
const fmtBerlin = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtTokyo = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
});

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), interval);
    return () => window.clearInterval(iv);
  }, [interval]);
  return now;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/* ---------------- glifos dos projetos ---------------- */

function Glyph({ i }: { i: number }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (i) {
    case 0: // antena
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 21V11" />
          <circle cx="12" cy="9" r="2" />
          <path d="M7.5 4.5a7 7 0 0 0 0 9M16.5 4.5a7 7 0 0 1 0 9" />
          <path d="M9 21h6" />
        </svg>
      );
    case 1: // onda shader
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0" />
          <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.55" />
        </svg>
      );
    case 2: // caixa/feira
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 8h16v11H4z" />
          <path d="M4 8l2-4h12l2 4" />
          <path d="M9 12h6" />
        </svg>
      );
    case 3: // tecla
      return (
        <svg {...common} aria-hidden="true">
          <rect x="4" y="5" width="16" height="13" rx="2.5" />
          <path d="M8 14.5h8" />
          <path d="M8 9h.01M12 9h.01M16 9h.01" />
        </svg>
      );
    case 4: // voz
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 12h.01M7 9v6M10 6v12M13 8v8M16 5v14M19 10v4" />
        </svg>
      );
    default: // cidade/bueiro
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M7 12h10M8.5 8.5h7M8.5 15.5h7" />
        </svg>
      );
  }
}

/* ---------------- app ---------------- */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const fxRef = useRef<FxSettings>(loadFx());

  const [booted, setBooted] = useState(false);
  const [crt, setCrt] = useState(() => {
    try {
      return localStorage.getItem("vd-crt") === "1";
    } catch {
      return false;
    }
  });
  const [god, setGod] = useState(false);
  const [fx, setFx] = useState<FxSettings>(fxRef.current);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalVid, setModalVid] = useState<Video | null>(null);

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  /* cena */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let api: SceneApi | null = null;
    try {
      api = initScene(canvas, fxRef.current, reduced);
      sceneRef.current = api;
    } catch {
      toast("WebGL indisponível — deck em modo estático", true);
    }
    return () => {
      api?.dispose();
      sceneRef.current = null;
    };
  }, [reduced]);

  useEffect(() => {
    sceneRef.current?.setFx(fx);
    try {
      localStorage.setItem("vd-fx", JSON.stringify(fx));
    } catch {
      /* noop */
    }
  }, [fx]);

  useEffect(() => {
    sceneRef.current?.setGod(god);
  }, [god]);

  useEffect(() => {
    try {
      localStorage.setItem("vd-crt", crt ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [crt]);

  /* konami */
  const bufRef = useRef<string[]>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const buf = bufRef.current;
      buf.push(e.code);
      if (buf.length > KONAMI.length) buf.shift();
      if (buf.length === KONAMI.length && buf.every((k, i) => k === KONAMI[i])) {
        setGod((g) => {
          const next = !g;
          toast(
            next ? "↑↑↓↓←→←→BA — GOD MODE: espectro total liberado" : "GOD MODE desativado. Volte quando quiser.",
            next
          );
          return next;
        });
        bufRef.current = [];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* easter egg de console */
  useEffect(() => {
    console.log(
      "%c V//D %c deck de sinal — você abriu o capô, hein?\n Dica: ↑↑↓↓←→←→BA ",
      "background:#63f2a5;color:#04140b;font-weight:bold;padding:4px 8px;",
      "color:#8fae9f;"
    );
  }, []);

  const toggleCrt = () => {
    setCrt((v) => {
      toast(v ? "CRT desligado — fósforo descansando" : "CRT ligado — scanlines a todo vapor", !v);
      return !v;
    });
  };

  const toggleGod = () => {
    setGod((g) => {
      toast(!g ? "GOD MODE: espectro total liberado" : "GOD MODE desativado", !g);
      return !g;
    });
  };

  return (
    <div className={crt ? "crt-on" : undefined}>
      <canvas ref={canvasRef} className="gl-canvas" aria-hidden="true" />

      {!booted && <Boot onDone={() => setBooted(true)} />}

      <Cursor />
      <Toasts />

      {/* overlays CRT */}
      <div className="crt-scan" />
      <div className="crt-vig" />
      <div className="crt-flick" />

      {god && <div className="god-badge">GOD MODE ∞</div>}

      <Header
        crt={crt}
        onCrt={toggleCrt}
        menuOpen={menuOpen}
        onMenu={(v) => setMenuOpen(v)}
      />

      {booted && (
        <main>
          <Hero />
          <Ticker />
          <Radar />
          <Arsenal />
          <Transmissions onPlay={(v) => setModalVid(v)} />
          <About />
        </main>
      )}

      <Footer />
      <FxPanel fx={fx} setFx={setFx} god={god} onGod={toggleGod} />

      {modalVid && <VideoModal vid={modalVid} onClose={() => setModalVid(null)} />}
    </div>
  );
}

/* ---------------- header ---------------- */

function Header({
  crt,
  onCrt,
  menuOpen,
  onMenu,
}: {
  crt: boolean;
  onCrt: () => void;
  menuOpen: boolean;
  onMenu: (v: boolean) => void;
}) {
  const now = useNow(1000);
  const links = [
    ["#radar", "radar"],
    ["#arsenal", "arsenal"],
    ["#transmissoes", "transmissões"],
    ["#sobre", "sobre"],
  ] as const;

  return (
    <>
      <header className="hdr">
        <div className="hdr-inner">
          <Mag strength={0.18}>
            <a href="#topo" className="logo" aria-label="voltar ao topo">
              <span className="logo-mark">V</span>
              <span className="logo-name">
                VALDE<em>CODER</em>
              </span>
            </a>
          </Mag>
          <nav className="nav" aria-label="principal">
            {links.map(([href, label]) => (
              <a key={href} className="nav-link" href={href}>
                {label}
              </a>
            ))}
          </nav>
          <div className="hdr-right">
            <span className="clock-chip" title="horário de São Paulo">
              <span className="led" />
              {fmtSP.format(now)}
              <small>SÃO PAULO</small>
            </span>
            <button
              className={`icon-btn${crt ? " on" : ""}`}
              onClick={onCrt}
              aria-pressed={crt}
              title="alternar modo CRT (scanlines)"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <rect x="2.5" y="5" width="19" height="13" rx="2" />
                <path d="M5 9h14M5 12.5h14" />
                <path d="M9 21h6" />
              </svg>
            </button>
            <button
              className={`icon-btn burger${menuOpen ? " on" : ""}`}
              onClick={() => onMenu(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label="abrir menu"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? (
                  <path d="M5 5l14 14M19 5L5 19" />
                ) : (
                  <path d="M3.5 7h17M3.5 12h11M3.5 17h17" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className={`menu-ovl${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        {links.map(([href, label], i) => (
          <a
            key={href}
            className="menu-link"
            href={href}
            style={{ transitionDelay: `${0.06 + i * 0.07}s` }}
            onClick={() => onMenu(false)}
          >
            <small>0{i + 1}</small>
            {label}
          </a>
        ))}
      </div>
    </>
  );
}

/* ---------------- hero ---------------- */

function Hero() {
  const now = useNow(1000);
  const [up, setUp] = useState(0);
  const [pkts, setPkts] = useState(12408);

  useEffect(() => {
    const t0 = Date.now();
    const iv = window.setInterval(() => setUp(Math.floor((Date.now() - t0) / 1000)), 1000);
    const pk = window.setInterval(
      () => setPkts((p) => p + 3 + Math.floor(Math.random() * 15)),
      800
    );
    return () => {
      window.clearInterval(iv);
      window.clearInterval(pk);
    };
  }, []);

  return (
    <section className="hero" id="topo">
      <p className="hero-tag">
        <span className="led" /> deck pessoal · v3.7.1 · sinal aberto
      </p>
      <div className="hero-grid">
        <div>
          <h1 className="hero-title">
            <Scramble text="VALDE" hover={false} />
            <span className="alt">
              <Scramble text="CODER" hover={false} />
            </span>
          </h1>
          <RotatingDecode />
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-n">2.847</div>
              <div className="stat-l">commits / ano</div>
            </div>
            <div className="stat">
              <div className="stat-n warm">12</div>
              <div className="stat-l">repos abertos</div>
            </div>
            <div className="stat">
              <div className="stat-n">99,98%</div>
              <div className="stat-l">uptime do deck</div>
            </div>
            <div className="stat">
              <div className="stat-n warm">−42dBm</div>
              <div className="stat-l">sinal da antena</div>
            </div>
          </div>
        </div>

        <aside className="sys-card" aria-label="painel do sistema">
          <div className="sys-head">
            <span>sys.monitor</span>
            <span className="sys-leds">
              <i className="g" />
              <i className="a" />
              <i className="c" />
            </span>
          </div>
          <div className="sys-row">
            <span className="sys-key">são paulo</span>
            <span className="sys-val phos">{fmtSP.format(now)}</span>
          </div>
          <div className="sys-row">
            <span className="sys-key">berlim</span>
            <span className="sys-val">{fmtBerlin.format(now)}</span>
          </div>
          <div className="sys-row">
            <span className="sys-key">tóquio</span>
            <span className="sys-val">{fmtTokyo.format(now)}</span>
          </div>
          <div className="sys-row">
            <span className="sys-key">data local</span>
            <span className="sys-val">{fmtDate.format(now)}</span>
          </div>
          <div className="sys-row">
            <span className="sys-key">sessão ativa</span>
            <span className="sys-val amber">
              {pad2(Math.floor(up / 3600))}:{pad2(Math.floor((up % 3600) / 60))}:
              {pad2(up % 60)}
            </span>
          </div>
          <div className="sys-row">
            <span className="sys-key">pacotes rx</span>
            <span className="sys-val phos">{pkts.toLocaleString("pt-BR")}</span>
          </div>
          <div className="sys-row">
            <span className="sys-key">shaders próprios</span>
            <span className="sys-val">2 ativos · 60fps</span>
          </div>
        </aside>
      </div>
      <div className="scroll-cue">
        <span className="cue-line" />
        role para decodificar o resto
      </div>
    </section>
  );
}

/* ---------------- ticker ---------------- */

function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-row">
        {[...TICKER_A, ...TICKER_A].map((t, i) => (
          <span className="ticker-item" key={i}>
            {t} <span className="tk-star">✦</span>
          </span>
        ))}
      </div>
      <div className="ticker-row rev">
        {[...TICKER_B, ...TICKER_B].map((t, i) => (
          <span className="ticker-item" key={i}>
            {t} <span className="tk-star">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- radar ---------------- */

function Radar() {
  const [cat, setCat] = useState<Cat | "todos">("todos");
  const [q, setQ] = useState("");
  const listRef = useStagger<HTMLDivElement>([cat, q]);

  const filtered = SIGNALS.filter((s) => {
    const okCat = cat === "todos" || s.cat === cat;
    const text = `${s.title} ${s.decode} ${s.src}`.toLowerCase();
    return okCat && text.includes(q.trim().toLowerCase());
  });

  return (
    <section className="sec" id="radar">
      <div className="sec-head">
        <div>
          <span className="sec-idx">01 // radar de sinais</span>
          <h2 className="sec-title">
            <Scramble text="O QUE ESTÁ" />
            <br />
            <Scramble text="CHEGANDO NA ANTENA" />
          </h2>
        </div>
        <p className="sec-note">
          Leituras do meu fluxo de RSS, listas e feed do fediverso — cada sinal vem com o
          meu decode pessoal. Sem filtro de assessoria.
        </p>
      </div>

      <div className="radar-toolbar">
        {CATS.map((c) => (
          <button
            key={c.id}
            className={`chip${cat === c.id ? " on" : ""}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
        <label className="search">
          <span>⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filtrar sinais…"
            aria-label="filtrar sinais por texto"
          />
        </label>
      </div>

      <div className="sig-list" ref={listRef}>
        {filtered.length === 0 && (
          <div className="radar-empty">
            <b>nenhum sinal encontrado</b> — a antena segue varrendo; ajuste o filtro ou o
            termo de busca.
          </div>
        )}
        {filtered.map((s, i) => (
          <article className="sig-row rv" key={s.title} style={{ transitionDelay: `${(i % 6) * 0.06}s` }}>
            <div className="sig-num">{String(i + 1).padStart(2, "0")}</div>
            <div className="sig-main">
              <div className="sig-top">
                <span className="sig-cat" data-c={s.cat}>
                  {s.cat}
                </span>
                <span className="sig-src">{s.src}</span>
              </div>
              <h3 className="sig-title">{s.title}</h3>
              <p className="sig-decode">
                <b>DECODE://</b> {s.decode.replace("DECODE: ", "")}
              </p>
            </div>
            <div className="sig-side">
              <div className="sig-bars" aria-label={`força do sinal ${s.str} de 5`}>
                {[0, 1, 2, 3, 4].map((b) => (
                  <i
                    key={b}
                    className={b < s.str ? "lit" : ""}
                    style={{ height: `${[34, 48, 62, 80, 100][b]}%` }}
                  />
                ))}
              </div>
              <span className="sig-when">{s.when}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- arsenal ---------------- */

function Arsenal() {
  const gridRef = useStagger<HTMLDivElement>();
  return (
    <section className="sec" id="arsenal">
      <div className="sec-head">
        <div>
          <span className="sec-idx">02 // arsenal aberto</span>
          <h2 className="sec-title">
            <Scramble text="CÓDIGO QUE" />
            <br />
            <Scramble text="ESCAPOU DO DECK" />
          </h2>
        </div>
        <p className="sec-note">
          Projetos open source que nasceram de coceira própria. Cada card busca o repo no
          GitHub — porque copiar ideia boa também é homenagear.
        </p>
      </div>

      <div className="proj-grid" ref={gridRef}>
        {PROJECTS.map((p, i) => (
          <a
            key={p.name}
            className="proj rv"
            style={{ gridColumn: p.span, transitionDelay: `${(i % 3) * 0.08}s` }}
            href={`https://github.com/search?q=${encodeURIComponent(p.name)}&type=repositories`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <div className="proj-top">
              <span className="proj-glyph">
                <Glyph i={p.glyph} />
              </span>
              <span className={`proj-status ${p.status}`}>{p.status}</span>
            </div>
            <h3 className="proj-name">{p.name}</h3>
            <p className="proj-tag">{p.tag}</p>
            <div className="proj-stack">
              {p.stack.map((s) => (
                <span className="stack-chip" key={s}>
                  {s}
                </span>
              ))}
            </div>
            <div className="proj-meta">
              <span className="proj-lang">
                <i style={{ background: p.langColor }} />
                {p.lang}
              </span>
              <span className="proj-star">★ {p.stars}</span>
              <span>⑂ {p.forks}</span>
              <span className="proj-arrow">↗ buscar no GitHub</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------------- transmissões ---------------- */

function Transmissions({ onPlay }: { onPlay: (v: Video) => void }) {
  const gridRef = useStagger<HTMLDivElement>();
  return (
    <section className="sec" id="transmissoes">
      <div className="sec-head">
        <div>
          <span className="sec-idx">03 // transmissões</span>
          <h2 className="sec-title">
            <Scramble text="AO VIVO DO" />
            <br />
            <Scramble text="BANCO DE DADOS" />
          </h2>
        </div>
        <p className="sec-note">
          Talks e streams gravadas no deck. Aperte o play que eu sintonizo o canal pra
          você.
        </p>
      </div>

      <div className="vid-grid" ref={gridRef}>
        {VIDEOS.map((v, i) => (
          <button key={v.title} className="vid rv" style={{ transitionDelay: `${(i % 2) * 0.08}s` }} onClick={() => onPlay(v)}>
            <span className="vid-thumb">
              <span className="vid-idx">{String(i + 1).padStart(2, "0")}</span>
              <span className="play-btn" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
              <span className="vid-dur">{v.dur}</span>
            </span>
            <span className="vid-info">
              <span className="vid-title">{v.title}</span>
              <span className="vid-meta">
                <span className="tagv">{v.tagv}</span>
                <span>{v.views} visualizações</span>
                <span>{v.date}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function VideoModal({ vid, onClose }: { vid: Video; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-ovl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={vid.title}
    >
      <div className="modal">
        <button className="modal-x" onClick={onClose} aria-label="fechar">
          ✕
        </button>
        <p className="modal-tag">▸ sintonizando canal…</p>
        <h3>{vid.title}</h3>
        <div className="eq" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <i
              key={i}
              style={{
                animationDelay: `${(i % 6) * 0.09}s`,
                animationDuration: `${0.7 + (i % 5) * 0.12}s`,
              }}
            />
          ))}
        </div>
        <p>
          O deck não hospeda vídeo próprio — a transmissão completa mora no canal. Duração
          registrada: {vid.dur} · {vid.views} visualizações · {vid.date}.
        </p>
        <div className="modal-actions">
          <Mag>
            <a
              className="btn"
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent("valcoder " + vid.title)}`}
              target="_blank"
              rel="noreferrer"
            >
              assistir no youtube ↗
            </a>
          </Mag>
          <Mag>
            <button className="btn ghost" onClick={onClose}>
              fechar sinal
            </button>
          </Mag>
        </div>
      </div>
    </div>
  );
}

/* ---------------- sobre ---------------- */

function About() {
  const gridRef = useStagger<HTMLDivElement>();
  return (
    <section className="sec" id="sobre">
      <div className="sec-head">
        <div>
          <span className="sec-idx">04 // quem decodifica</span>
          <h2 className="sec-title">
            <Scramble text="POR TRÁS" />
            <br />
            <Scramble text="DA ANTENA" />
          </h2>
        </div>
        <p className="sec-note">
          Gente de verdade, teclado de verdade, café de verdade. O resto é shader.
        </p>
      </div>

      <div className="about-grid" ref={gridRef}>
        <div className="bio rv">
          <p>
            Sou o <span className="hl">Valde</span> — engenheiro de software que trata todo
            problema como um <span className="hl warm">sinal a ser decodificado</span>.
            Passo os dias entre sistemas distribuídos, firmware de teclado e shaders que
            ninguém pediu mas todo mundo merece.
          </p>
          <p>
            Este deck é meu terreno próprio na internet: <span className="hl">sem algoritmo,
            sem feed, sem anúncio</span> — só o que estou lendo, construindo e transmitindo.
            Se algo aqui piscar estranho, provavelmente é o modo CRT.
          </p>

          <p className="sub-h">nível de sinal por área</p>
          {SKILLS.map((s) => (
            <div className="meter" key={s.k}>
              <div className="meter-top">
                <span>{s.k}</span>
                <span>{s.v}%</span>
              </div>
              <div className="meter-track">
                <div className="meter-fill" style={{ "--w": `${s.v}%` } as React.CSSProperties} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="sub-h rv" style={{ marginTop: 0 }}>linha do tempo</p>
          <div className="timeline">
            {TIMELINE.map((t, i) => (
              <div className="tl-item rv" key={t.y} style={{ transitionDelay: `${i * 0.07}s` }}>
                <span className="tl-year">{t.y}</span>
                <p>{t.t}</p>
              </div>
            ))}
          </div>

          <p className="sub-h rv">ferro do deck</p>
          <ul className="setup rv">
            {SETUP.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------- footer ---------------- */

function Footer() {
  const copyMail = async () => {
    try {
      await navigator.clipboard.writeText("valde@sinal.dev");
      toast("endereço copiado: valde@sinal.dev");
    } catch {
      toast("não consegui copiar — anota aí: valde@sinal.dev", true);
    }
  };

  return (
    <footer className="ftr">
      <div className="ftr-marq" aria-hidden="true">
        <div className="ftr-marq-in">
          {Array.from({ length: 6 }).map((_, i) => (
            <span className="ftr-word" key={i}>
              VALDECODER ✦ SINAL ABERTO ✦
            </span>
          ))}
        </div>
      </div>
      <div className="ftr-base">
        <span>© 2026 valdecoder — feito com café, shaders e teclas barulhentas</span>
        <div className="ftr-links">
          <a href="https://github.com" target="_blank" rel="noreferrer">
            github ↗
          </a>
          <a href="https://www.youtube.com" target="_blank" rel="noreferrer">
            youtube ↗
          </a>
          <Mag strength={0.2}>
            <button onClick={copyMail}>valde@sinal.dev ⧉</button>
          </Mag>
          <Mag strength={0.2}>
            <a href="#topo">voltar ao topo ↑</a>
          </Mag>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- painel FX ---------------- */

function FxPanel({
  fx,
  setFx,
  god,
  onGod,
}: {
  fx: FxSettings;
  setFx: (f: FxSettings) => void;
  god: boolean;
  onGod: () => void;
}) {
  const [open, setOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 860
  );

  const up = (patch: Partial<FxSettings>) => setFx({ ...fx, ...patch });

  const slider = (
    label: string,
    key: keyof FxSettings,
    min: number,
    max: number,
    step: number,
    fmtVal: (v: number) => string
  ) => (
    <div className="fx-row">
      <label>
        <span>{label}</span>
        <b>{fmtVal(Number(fx[key]))}</b>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(fx[key])}
        onChange={(e) => up({ [key]: Number(e.target.value) } as Partial<FxSettings>)}
        aria-label={label}
      />
    </div>
  );

  return (
    <div className="fx-panel">
      <button className="fx-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>fx_deck {open ? "▾" : "▸"}</span>
        <span className="led" />
      </button>
      {open && (
        <div className="fx-body">
          {slider("densidade", "density", 600, 3600, 200, (v) => `${v} pts`)}
          {slider("turbulência", "turb", 0, 2, 0.1, (v) => v.toFixed(1))}
          {slider("velocidade", "speed", 0.2, 2, 0.1, (v) => `${v.toFixed(1)}×`)}
          {slider("tamanho", "size", 1, 4, 0.1, (v) => v.toFixed(1))}
          {slider("bloom", "bloom", 0, 1.6, 0.05, (v) => v.toFixed(2))}
          {slider("fov", "fov", 45, 90, 1, (v) => `${v}°`)}
          <div className="fx-toggles">
            <button
              className={`fx-sw${fx.bloomOn ? " on" : ""}`}
              onClick={() => up({ bloomOn: !fx.bloomOn })}
            >
              bloom <i />
            </button>
            <button
              className={`fx-sw${fx.orbit ? " on" : ""}`}
              onClick={() => up({ orbit: !fx.orbit })}
            >
              órbita <i />
            </button>
            <button className={`fx-sw${god ? " on" : ""}`} onClick={onGod}>
              god <i />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
