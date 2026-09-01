import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HeroStage from "./components/HeroStage";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

gsap.registerPlugin(ScrollTrigger);

/* ================================================================
   VALDECODER // deck de sinal — single-page tech hub v4.2
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
  size: 1,
  bloom: 0.85,
  bloomOn: false,
  fov: 62,
  orbit: true,
};

const FX_PRESETS: Record<string, { label: string; icon: string; fx: Partial<FxSettings> }> = {
  default: {
    label: "Padrão Deck",
    icon: "🟢",
    fx: { density: 2400, turb: 1, speed: 1, size: 1, bloom: 0.85, bloomOn: false, fov: 62, orbit: true },
  },
  hyperdrive: {
    label: "Hiperdrive",
    icon: "⚡",
    fx: { density: 3400, turb: 1.8, speed: 1.8, size: 1.5, bloom: 1.3, bloomOn: true, fov: 72, orbit: true },
  },
  nebula: {
    label: "Nebulosa",
    icon: "🌌",
    fx: { density: 3000, turb: 1.6, speed: 0.5, size: 2.2, bloom: 1.1, bloomOn: true, fov: 55, orbit: false },
  },
  retro: {
    label: "Matrix Retro",
    icon: "📟",
    fx: { density: 1600, turb: 0.4, speed: 0.8, size: 1.2, bloom: 0, bloomOn: false, fov: 60, orbit: false },
  },
  turbo60: {
    label: "Turbo 60fps",
    icon: "🎯",
    fx: { density: 1000, turb: 0.8, speed: 1.1, size: 0.9, bloom: 0, bloomOn: false, fov: 62, orbit: true },
  },
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

/* ---------------- shaders de alta fidelidade do deck ---------------- */

const VERT = /* glsl */ `
uniform float uTime;
uniform float uTurb;
uniform float uSpeed;
uniform float uSize;
uniform vec3 uMouse;
uniform float uMouseR;
uniform float uMouseF;
uniform float uPulse;
attribute float aScale;
attribute float aSeed;
varying float vMix;
varying float vFade;
varying float vSeed;

void main() {
  vec3 p = position;
  float t = uTime * uSpeed;
  float s = aSeed * 6.28318;

  // Ondulação harmônica espacial contínua
  float w = sin(p.x * 0.32 + t * 0.7 + s)
          + sin(p.z * 0.26 - t * 0.55 + s * 0.5)
          + sin((p.x + p.z) * 0.14 + t * 0.35);
  p.y += w * 1.15 * uTurb;
  p.y += sin(p.x * 0.8 + p.z * 0.6 + t * 1.3 + s * 2.0) * 0.3 * uTurb;

  // Pulso de onda de choque
  float distToCenter = length(p.xz);
  p.y += sin(distToCenter * 0.45 - uTime * 4.0) * uPulse * 2.2;

  // Interação magnética com o cursor
  vec2 dm = p.xz - uMouse.xz;
  float dist = length(dm);
  float fall = smoothstep(uMouseR, 0.0, dist);
  p.xz += (dm / max(dist, 0.001)) * fall * uMouseF * 2.4;
  p.y += fall * uMouseF * 1.5;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aScale * (1.0 + fall * 1.4 + uPulse * 0.8) * (360.0 / -mv.z);

  vMix = p.y * 0.10 + aSeed * 0.55;
  vFade = smoothstep(110.0, 32.0, -mv.z);
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
  return vec3(0.39, 0.56, 0.48)
       + vec3(0.34, 0.30, 0.36) * cos(6.28318 * (t + vec3(0.00, 0.12, 0.32)));
}

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.04, d);
  a *= a;

  float hue = vMix + uHue + uGod * uTime * 0.2;
  vec3 col = pal(hue);
  col = mix(col, vec3(1.0, 0.85, 0.42), step(0.93, fract(vSeed * 7.31)) * 0.9);

  float tw = 0.74 + 0.26 * sin(uTime * 1.7 + vSeed * 40.0);
  gl_FragColor = vec4(col * (1.0 + uGod * 0.5), a * vFade * tw);
}
`;

/* ---------------- cena WebGL contínua de alta performance ---------------- */

interface SceneApi {
  setFx(fx: FxSettings): void;
  setGod(on: boolean): void;
  pulse(): void;
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
  scene.background = new THREE.Color("#090b0c");

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
    uMouseR: { value: 7.8 },
    uMouseF: { value: 1.15 },
    uHue: { value: 0 },
    uGod: { value: 0 },
    uPulse: { value: 0 },
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
    const n = Math.max(500, Math.min(3800, Math.round(count)));
    const pos = new Float32Array(n * 3);
    const scl = new Float32Array(n);
    const sed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 3.8 + Math.pow(Math.random(), 0.6) * 36;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1.8;
      pos[i * 3 + 2] = Math.sin(a) * r * 0.84;
      scl[i] = 0.5 + Math.random() * 1.6;
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
  let pulseDecay = 0;
  const timer = new THREE.Timer();
  timer.connect(document);

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

  const frame = (timestamp: number) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.05);
    uniforms.uTime.value = timer.getElapsed();

    if (pulseDecay > 0) {
      pulseDecay = Math.max(0, pulseDecay - dt * 2.0);
      uniforms.uPulse.value = pulseDecay;
    }

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
  raf = requestAnimationFrame(frame);

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
    pulse() {
      pulseDecay = 1.0;
      uniforms.uPulse.value = 1.0;
    },
    dispose() {
      cancelAnimationFrame(raf);
      timer.dispose();
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

export type Cat = "ia" | "sistemas" | "web" | "hardware" | "seg" | "cultura";

export interface Signal {
  cat: Cat;
  src: string;
  when: string;
  title: string;
  decode: string;
  str: number;
  fullNote?: string;
  actionUrl?: string;
}

export const SIGNALS: Signal[] = [
  {
    cat: "ia",
    src: "arxiv · rss próprio",
    when: "há 40min",
    title: "Modelos pequenos on-device viram padrão em apps de banco e saúde",
    decode: "DECODE: latência zero e dado sem sair do bolso vencem qualquer demo de modelo gigante. O jogo agora é comprimir, não inflar.",
    fullNote: "A proliferação de SLMs (Small Language Models) quantizados em 4-bit para NPU local remove a dependência de APIs remotas, zera custos recorrentes de inferência e elimina vetores de vazamento de dados em conformidade com LGPD/HIPAA.",
    actionUrl: "https://arxiv.org/abs/search/advanced?terms-0-term=small+language+models",
    str: 5,
  },
  {
    cat: "sistemas",
    src: "lobsters",
    when: "há 2h",
    title: "io_uring chega a mais subsistemas e vira assunto obrigatório em kernel",
    decode: "DECODE: quem ainda trata I/O assíncrono no Linux como 'coisa de edge case' vai ficar para trás. Epoll tá aposentando aos poucos.",
    fullNote: "A capacidade de submeter lotes de operações de rede, disco e sockets em anéis compartilhados sem overhead de context-switch entre user-space e kernel-space estabelece um novo patamar de throughput para servidores em Rust/C.",
    actionUrl: "https://lobste.rs/search?q=io_uring",
    str: 4,
  },
  {
    cat: "web",
    src: "hacker news",
    when: "há 3h",
    title: "View Transitions API aterrissa nos navegadores restantes",
    decode: "DECODE: finalmente dá pra trocar de página sem aquele corte seco. Menos lib de 400kb pra fingir que é app nativo.",
    fullNote: "Navegação multi-page suave (MPA) diretamente gerenciada pelo motor do navegador com suporte a transições interpoladas por CSS sem necessidade de SPAs pesadas e frameworks de roteamento complexos.",
    actionUrl: "https://news.ycombinator.com/item?id=38900000",
    str: 4,
  },
  {
    cat: "hardware",
    src: "rss próprio",
    when: "há 5h",
    title: "RISC-V ganha aceleração vetorial decente nas placas de baixo custo",
    decode: "DECODE: comprei mais uma placa 'pra testar'. Minha estante já é um datacenter com sentimentos.",
    fullNote: "A extensão RVV (RISC-V Vector) finalmente chega em SoCs acessíveis de R$ 150, permitindo DSP, processamento de sinal e visão computacional em hardware livre sem pagar royalties de ISA.",
    actionUrl: "https://riscv.org",
    str: 3,
  },
  {
    cat: "seg",
    src: "mailing list",
    when: "há 8h",
    title: "Campanha de supply-chain atinge pacotes populares de build tooling",
    decode: "DECODE: confiem, mas verifiquem o lockfile. Reprodutibilidade deixou de ser frescura de purista faz tempo.",
    fullNote: "Injeção de código malicioso através de scripts pós-instalação em dependências transitivas destaca a urgência de compilações herméticas e verificação criptográfica de artefatos de build.",
    actionUrl: "https://github.com/advisories",
    str: 5,
  },
  {
    cat: "ia",
    src: "hacker news",
    when: "há 11h",
    title: "LLM local de 8B bate assistente cloud em tarefas de shell, diz benchmark",
    decode: "DECODE: rodei no ThinkPad velho daqui do deck. Lento? Um pouco. Meu? Totalmente. E isso vale ouro.",
    fullNote: "Modelos treinados especificamente em sintaxe POSIX, diagnósticos de kernel e pipelines de bash superam modelos genéricos de centenas de bilhões de parâmetros em assertividade prática de terminal.",
    actionUrl: "https://ollama.com",
    str: 4,
  },
  {
    cat: "web",
    src: "blog · fediverso",
    when: "há 1d",
    title: "CSS anchor positioning dispensa bibliotecas de tooltip e popover",
    decode: "DECODE: cada vez que o CSS engole uma lib JS, um dev deleta 12kb e sorri sem saber o porquê.",
    fullNote: "Posicionamento declarativo de elementos flutuantes ancorados a nós do DOM sem listener de scroll, resize ou dependência de pacotes como Floating UI.",
    actionUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning",
    str: 3,
  },
  {
    cat: "cultura",
    src: "zines · rss",
    when: "há 1d",
    title: "Cena de sites pessoais 'artesanais' cresce como resposta aos feeds",
    decode: "DECODE: esse deck aqui nasceu exatamente disso. Terreno próprio > aluguel em rede social.",
    fullNote: "O renascimento da web independente (IndieWeb, SmolWeb) onde pessoas constroem páginas autorais com personalidade, shaders, feeds RSS e identidade própria fora dos silos corporativos.",
    actionUrl: "https://indieweb.org",
    str: 4,
  },
  {
    cat: "sistemas",
    src: "lobsters",
    when: "há 2d",
    title: "SQLite como formato de arquivo de aplicação ganha adoção real",
    decode: "DECODE: um arquivo, transações, busca completa — quer saber? Faz sentido. JSON gigante no disco é que era a gambiarra.",
    fullNote: "A utilização do SQLite como contêiner de armazenamento local para documentos complexos garante atomicidade ACID, índices B-Tree e compatibilidade multiplataforma sem necessidade de parser customizado.",
    actionUrl: "https://www.sqlite.org/appfileformat.html",
    str: 3,
  },
];

export const CATS: { id: Cat | "todos"; label: string }[] = [
  { id: "todos", label: "todos" },
  { id: "ia", label: "ia" },
  { id: "sistemas", label: "sistemas" },
  { id: "web", label: "web" },
  { id: "hardware", label: "hardware" },
  { id: "seg", label: "segurança" },
  { id: "cultura", label: "cultura" },
];

export const RADAR_PIPELINE = [
  { label: "RADAR", count: "14 sinais/mês", desc: "notícia filtrada" },
  { label: "EXPERIMENTO", count: "3 ativos", desc: "teste de bancada" },
  { label: "PROJETO", count: "2 em produção", desc: "código aberto" },
  { label: "VÍDEO", count: "1 por semana", desc: "processo gravado" },
  { label: "ARTIGO", count: "2 por mês", desc: "conclusão escrita" },
] as const;

export interface Project {
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
  installCmd: string;
  highlights: string[];
}

export const PROJECTS: Project[] = [
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
    installCmd: "cargo install sinal-9-cli",
    highlights: [
      "Processamento de 50.000 msgs/seg em ARM de 1GB RAM",
      "Drivers LoRaWAN nativos em Rust assíncrono",
      "Exportador Prometheus e Grafana integrado",
    ],
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
    installCmd: "npx create-gl-puzzle my-shader",
    highlights: [
      "Hot-reload de fragment shaders sem piscar canvas",
      "Gravação WebM direta do buffer WebGL",
      "Compressão de código para URI base64",
    ],
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
    installCmd: "go install github.com/valdecoder/feirao@latest",
    highlights: [
      "TUI interativa com Bubbletea e lipgloss",
      "Cache SQLite embutido com sync incremental",
      "Exportação CSV e JSON via CLI",
    ],
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
    installCmd: "make flash TARGET=tecla_v2",
    highlights: [
      "Debounce dinâmico em 0.8ms",
      "Suporte a encoder rotativo duplo",
      "Configuração de camadas salva na EEPROM em tempo real",
    ],
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
    installCmd: "pip install maritaca-tts",
    highlights: [
      "Inferência CPU em tempo real no ThinkPad x240",
      "Mapeamento fonético regional brasileiro",
      "Pipeline de áudio 24kHz com ONNX Runtime",
    ],
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
    installCmd: "docker run -d valdecoder/bueiro-stream",
    highlights: [
      "Detecção de lâmina d'água via reflexo óptico",
      "Publicação de eventos MQTT em baixa largura de banda",
      "Integração com Telegram Bot do bairro",
    ],
  },
];

export interface Video {
  title: string;
  dur: string;
  views: string;
  date: string;
  tagv: string;
  chapters?: string[];
  takeaway?: string;
}

export const VIDEOS: Video[] = [
  {
    title: "Do zero ao GLSL: escrevendo o fundo deste deck em 40 minutos",
    dur: "41:07",
    views: "38 mil",
    date: "jan 2026",
    tagv: "shaders",
    chapters: ["00:00 Setup do Vite e Three.js", "09:20 Escrevendo o Vertex Shader", "22:15 Ruído Perlin e Paletas de Cor", "34:00 Otimização de Uniforms a 60fps"],
    takeaway: "Shaders não são mágica negra; são apenas funções matemáticas executando em paralelo em cada pixel da sua GPU.",
  },
  {
    title: "Rust pra quem vem do JavaScript — sem drama, com exemplos",
    dur: "52:30",
    views: "61 mil",
    date: "nov 2025",
    tagv: "linguagens",
    chapters: ["00:00 O choque do Borrow Checker", "14:20 Structs vs Protótipos", "29:10 Async Tokio descomplicado", "44:00 Criando uma CLI com Clap"],
    takeaway: "O compilador do Rust é o seu melhor code reviewer: se compilar, 90% das chances é que roda em produção sem pânico.",
  },
  {
    title: "Homelab completo por R$ 800: o guia definitivo do ferro velho",
    dur: "34:18",
    views: "92 mil",
    date: "ago 2025",
    tagv: "hardware",
    chapters: ["00:00 Garimpando Mini PCs usados", "08:15 Instalando Proxmox e ZFS", "18:40 Docker, Tailscale e Traefik", "29:00 Monitoramento com Grafana"],
    takeaway: "Você não precisa de um rack Xeon de 10 mil reais para rodar sua nuvem soberana em casa.",
  },
  {
    title: "IA local num ThinkPad de 2014? Rodando LLM de 8B offline",
    dur: "27:44",
    views: "118 mil",
    date: "mai 2025",
    tagv: "ia local",
    chapters: ["00:00 Hardware antigo vs GGUF", "06:30 Ollama e Llama.cpp no Linux", "15:20 Testes de latência e tokens/seg", "23:00 Integrando com o Neovim"],
    takeaway: "Soberania de dados e zero dependência de cartão de crédito em dólar para usar inteligência artificial no dia a dia.",
  },
];

export const ABOUT_FACTS = [
  ["BASE", "Curitiba, BR — remoto"],
  ["FOCO", "infra · devtools · linux"],
  ["EDITOR", "Neovim, obviamente"],
  ["DISTRO", "Arch (btw)"],
  ["CANAL DESDE", "2020 · 42 episódios"],
  ["CAFÉ/DIA", "4 doses, sem açúcar"],
] as const;

export const ABOUT_TIMELINE = [
  { y: "2016", t: "Primeiro hello world em C, num Pentium 4 do tio", desc: "Descoberta da programação de baixo nível e a paixão por entender a máquina por dentro." },
  { y: "2018", t: "Blog técnico — escrevendo pra aprender de verdade", desc: "Publicação de guias de Linux, redes e algoritmos para fixar o aprendizado." },
  { y: "2020", t: "Canal no YouTube: EP 001 no ar, 47 views", desc: "Gravação dos primeiros vídeos de bancada e terminal sem frescura de edição." },
  { y: "2022", t: "Homelab v1 + canal passa de 100 mil views", desc: "Montagem do servidor doméstico e consolidação da comunidade de código aberto." },
  { y: "2024", t: "Radar ValdeCoder: o método vira sistema", desc: "Criação do fluxo formal: notícia filtrada → experimento → projeto → conteúdo." },
  { y: "2026", t: "Você está aqui — hub v4.2 no ar", desc: "Deck de sinal totalmente renovado com shaders WebGL, telemetria e código aberto." },
];

export const ABOUT_STACK = [
  "TypeScript", "Rust", "Go", "Linux", "Docker", "PostgreSQL", "Three.js", "Neovim", "Grafana", "Ansible",
];

export interface Article {
  num: string;
  title: string;
  excerpt: string;
  tag: string;
  date: string;
  read: string;
}

export const ARTICLES: Article[] = [
  {
    num: "01",
    title: "Como migrei do X11 pro Hyprland e sobrevivi na NVIDIA",
    excerpt: "Depois de 3 anos de 'quase lá', o explicit sync no driver 555+ resolveu o tearing de vez. Documentei cada passo da migração — do kernel ao compositor Wayland.",
    tag: "Linux",
    date: "há 2 semanas",
    read: "8 min",
  },
  {
    num: "02",
    title: "Benchmark de I/O: Raspberry Pi 5 com HAT NVMe vs USB",
    excerpt: "Fim do gargalo USB. Com o HAT PCIe oficial, medimos IOPS sequenciais e randômicos rodando Postgres real em produção.",
    tag: "Hardware",
    date: "há 1 mês",
    read: "12 min",
  },
  {
    num: "03",
    title: "O que aprendi implementando shaders GLSL do zero no browser",
    excerpt: "Matemática de vetores, ruído simplex procedural, uniformes e pós-processamento bloom sem comprometer os 60 FPS.",
    tag: "Web/GLSL",
    date: "há 1 mês",
    read: "6 min",
  },
  {
    num: "04",
    title: "Por que escolhi Proxmox no meu homelab de mini PCs",
    excerpt: "ZFS, VLANs com Tailscale e backup automatizado para a nuvem: como montar uma infraestrutura soberana por menos de R$ 1.000.",
    tag: "Infra",
    date: "há 2 meses",
    read: "10 min",
  },
  {
    num: "05",
    title: "Explorando io_uring em Rust para servidores de baixa latência",
    excerpt: "Evitando trocas de contexto com syscalls assíncronas do Linux moderno em aplicações de alta taxa de transferência.",
    tag: "Rust",
    date: "há 3 meses",
    read: "14 min",
  },
];

export interface SkillProgress {
  name: string;
  pct: number;
  note: string;
}

export const SKILLS: SkillProgress[] = [
  { name: "Linux Kernel & eBPF", pct: 68, note: "compilando 6.12 com rustc e tracing kprobes" },
  { name: "Shaders WebGL / GLSL", pct: 91, note: "fragment shaders e math procedural no three.js" },
  { name: "Sistemas Distribuídos & Raft", pct: 82, note: "consenso, replicação e logs em go" },
  { name: "Rust & Concorrência", pct: 74, note: "io_uring, lock-free queues e tokio" },
];

export const COMMIT_WEEK = [
  { day: "SEG", n: 4 },
  { day: "TER", n: 8 },
  { day: "QUA", n: 14 },
  { day: "QUI", n: 11 },
  { day: "SEX", n: 16 },
  { day: "SAB", n: 7 },
  { day: "DOM", n: 5 },
];

export const LAB_TARGETS = [
  "Certificação CKA (Kubernetes Administrator)",
  "Um compositor Wayland de brinquedo em C/Zig",
  "Zig: do zero ao primeiro binário otimizado",
];

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "KeyB", "KeyA",
];

/* ---------------- toasts ---------------- */

type ToastFn = (msg: string, warm?: boolean) => void;
let toastFn: ToastFn | null = null;
export const toast = (msg: string, warm = false) => toastFn?.(msg, warm);

function Toasts() {
  const [items, setItems] = useState<{ id: number; msg: string; warm: boolean }[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    toastFn = (msg, warm = false) => {
      const id = ++idRef.current;
      setItems((l) => [...l.slice(-3), { id, msg, warm }]);
      window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3000);
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

/* ---------------- reveal / stagger fluido ---------------- */

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
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
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
  }, [text, reduced]);

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
      const hot = !!t?.closest("a, button, .chip, .proj, .vid, input, .fx-sw, .radar-card, .hero-pill-btn, .hero-render-status");
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

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), interval);
    return () => window.clearInterval(iv);
  }, [interval]);
  return now;
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
    case 0:
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 21V11" />
          <circle cx="12" cy="9" r="2" />
          <path d="M7.5 4.5a7 7 0 0 0 0 9M16.5 4.5a7 7 0 0 1 0 9" />
          <path d="M9 21h6" />
        </svg>
      );
    case 1:
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0" />
          <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.55" />
        </svg>
      );
    case 2:
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 8h16v11H4z" />
          <path d="M4 8l2-4h12l2 4" />
          <path d="M9 12h6" />
        </svg>
      );
    case 3:
      return (
        <svg {...common} aria-hidden="true">
          <rect x="4" y="5" width="16" height="13" rx="2.5" />
          <path d="M8 14.5h8" />
          <path d="M8 9h.01M12 9h.01M16 9h.01" />
        </svg>
      );
    case 4:
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 12h.01M7 9v6M10 6v12M13 8v8M16 5v14M19 10v4" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M7 12h10M8.5 8.5h7M8.5 15.5h7" />
        </svg>
      );
  }
}

function RadarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <circle cx="32" cy="32" r="19" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <circle cx="32" cy="32" r="9" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <g className="radar-sweep-spin">
        <line x1="32" y1="32" x2="32" y2="4" stroke="var(--volt)" strokeWidth="1.5" />
        <path d="M32 32 L32 4 A28 28 0 0 1 47 8.6 Z" fill="var(--volt)" opacity="0.18" />
      </g>
      <circle cx="44" cy="20" r="2.4" fill="var(--phos)" />
      <circle cx="21" cy="42" r="1.8" fill="var(--volt)" opacity="0.85" />
      <circle cx="32" cy="32" r="2.8" fill="var(--volt)" />
    </svg>
  );
}

function TerminalGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 7 5 5-5 5" />
      <path d="M13 17h6" />
    </svg>
  );
}

/* ---------------- app principal ---------------- */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const fxRef = useRef<FxSettings>(loadFx());
  const heroFoldRef = useRef<HTMLDivElement | null>(null);

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
  const [particlesActive, setParticlesActive] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Modais e gavetas
  const [modalVid, setModalVid] = useState<Video | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  
  // Filtros compartilhados
  const [radarFilterCat, setRadarFilterCat] = useState<Cat | "todos">("todos");

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  /* cena 3D WebGL contínua */
  useEffect(() => {
    if (!particlesActive) return;
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
  }, [particlesActive, reduced]);

  useEffect(() => {
    fxRef.current = fx;
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

  /* atalhos de teclado: Konami e Ctrl+K */
  const bufRef = useRef<string[]>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      // Konami
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

  /* easter egg console */
  useEffect(() => {
    console.log(
      "%c V//D %c deck de sinal — você abriu o capô, hein?\n Dica 1: Pressione Ctrl+K para o terminal\n Dica 2: ↑↑↓↓←→←→BA ",
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

  const handlePulse = () => {
    sceneRef.current?.pulse();
    toast("✦ Pulso de sinal propagado na malha de partículas!");
  };

  const handleApplyPreset = (presetKey: string) => {
    const p = FX_PRESETS[presetKey];
    if (p) {
      setFx((prev) => ({ ...prev, ...p.fx }));
      toast(`Preset aplicado: ${p.label} ${p.icon}`);
    }
  };

  return (
    <div className={crt ? "crt-on" : undefined}>
      {particlesActive && <canvas ref={canvasRef} className="gl-canvas" aria-hidden="true" />}

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
        onOpenCmd={() => setCmdOpen(true)}
      />

      {booted && (
        <main>
          <div className="hero-fold" ref={heroFoldRef}>
            <HeroStage
              onSelectCategory={(c) => setRadarFilterCat(c as Cat)}
              onOpenCommandPalette={() => setCmdOpen(true)}
              onPlayFeaturedVideo={() => setModalVid(VIDEOS[0])}
              onSignalPulse={handlePulse}
            />
            <Ticker />
          </div>
          <Radar
            activeCat={radarFilterCat}
            onSelectCat={(c) => setRadarFilterCat(c)}
            onSelectSignal={(s) => setSelectedSignal(s)}
          />
          <Arsenal onSelectProject={(p) => setSelectedProject(p)} />
          <Transmissions onPlay={(v) => setModalVid(v)} />
          <Writing />
          <Lab />
          <About />
        </main>
      )}

      <Footer />

      {/* Painel de Controle de FX com Presets rápidos */}
      <FxPanel
        fx={fx}
        setFx={setFx}
        god={god}
        onGod={toggleGod}
        foldRef={heroFoldRef}
        foldReady={booted}
        onPreset={handleApplyPreset}
      />

      {/* Modais do Sistema */}
      {modalVid && <VideoModal vid={modalVid} onClose={() => setModalVid(null)} />}
      
      {selectedSignal && (
        <SignalDetailModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
        />
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {cmdOpen && (
        <CommandPaletteModal
          onClose={() => setCmdOpen(false)}
          onNavigate={(targetId) => {
            setCmdOpen(false);
            const el = document.getElementById(targetId);
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          onToggleCrt={toggleCrt}
          onToggleGod={toggleGod}
          onPreset={handleApplyPreset}
          onSelectSignal={(s) => {
            setCmdOpen(false);
            setSelectedSignal(s);
          }}
          onSelectProject={(p) => {
            setCmdOpen(false);
            setSelectedProject(p);
          }}
          onSelectVideo={(v) => {
            setCmdOpen(false);
            setModalVid(v);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- header ---------------- */

function Header({
  crt,
  onCrt,
  menuOpen,
  onMenu,
  onOpenCmd,
}: {
  crt: boolean;
  onCrt: () => void;
  menuOpen: boolean;
  onMenu: (v: boolean) => void;
  onOpenCmd: () => void;
}) {
  const [activeSec, setActiveSec] = useState("topo");
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const links = [
    ["#radar", "radar", "radar"],
    ["#arsenal", "arsenal", "arsenal"],
    ["#transmissoes", "transmissões", "transmissoes"],
    ["#textos", "textos", "textos"],
    ["#lab", "lab", "lab"],
    ["#sobre", "sobre", "sobre"],
  ] as const;

  // Scroll dynamics: progress bar, header backdrop, and ScrollSpy
  useEffect(() => {
    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);

        // Progress hairline bar
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? (window.scrollY / max) * 100 : 0;
        if (progressRef.current) {
          progressRef.current.style.width = `${p}%`;
        }

        // ScrollSpy
        const secIds = ["sobre", "lab", "textos", "transmissoes", "arsenal", "radar", "topo"];
        for (const id of secIds) {
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 200) {
              setActiveSec(id);
              break;
            }
          }
        }
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={progressRef} className="hdr-progress-bar" />
      <header className={`hdr ${scrolled ? "scrolled" : ""}`}>
        <div className="hdr-inner">
          <Mag strength={0.18}>
            <a href="#topo" className="logo" aria-label="voltar ao topo">
              <svg className="logo-mark" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                <rect x="1.25" y="1.25" width="31.5" height="31.5" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M9 9l8 16 8-16"
                  stroke="#ffd91c"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="28" cy="27" r="2" fill="#3be08f" />
              </svg>
              <span className="logo-name">
                VALDE<em>CODER</em>
              </span>
            </a>
          </Mag>

          <nav className="nav" aria-label="principal">
            {links.map(([href, label, id]) => (
              <a
                key={href}
                className={`nav-link ${activeSec === id ? "active" : ""}`}
                href={href}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="hdr-right">
            {/* Indicador de status online com ponto de pulso */}
            <span className="hdr-online">
              <span className="hdr-online-dot" />
              online
            </span>

            {/* Botão do YouTube substituindo o relógio de SP */}
            <a
              href="https://www.youtube.com/@valdecoder"
              target="_blank"
              rel="noreferrer"
              className="hdr-yt-btn"
              title="Canal ValdeCoder no YouTube"
            >
              YouTube ↗
            </a>

            {/* Botão de busca rápida Command Palette */}
            <button
              className="hdr-cmd-trigger"
              onClick={onOpenCmd}
              title="Buscar no Deck (Ctrl + K)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>buscar...</span>
              <kbd>Ctrl+K</kbd>
            </button>

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
        <button
          className="menu-cmd-btn"
          onClick={() => {
            onMenu(false);
            onOpenCmd();
          }}
        >
          <span>Terminal de Comandos (Ctrl + K)</span>
          <kbd>Ctrl+K</kbd>
        </button>
      </div>
    </>
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

interface RadarProps {
  activeCat: Cat | "todos";
  onSelectCat: (cat: Cat | "todos") => void;
  onSelectSignal: (sig: Signal) => void;
}

function Radar({ activeCat, onSelectCat, onSelectSignal }: RadarProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "strength">("recent");
  const radarRef = useStagger<HTMLElement>([activeCat, search, sortBy]);

  const filtered = useMemo(() => {
    let list = activeCat === "todos" ? SIGNALS : SIGNALS.filter((s) => s.cat === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.decode.toLowerCase().includes(q) ||
          s.src.toLowerCase().includes(q)
      );
    }
    if (sortBy === "strength") {
      return [...list].sort((a, b) => b.str - a.str);
    }
    return list;
  }, [activeCat, search, sortBy]);

  const countFor = (id: Cat | "todos") =>
    id === "todos" ? SIGNALS.length : SIGNALS.filter((signal) => signal.cat === id).length;

  const toneFor = (signal: Signal) => {
    if (signal.cat === "ia" || signal.cat === "hardware") return "volt";
    if (signal.cat === "sistemas" || signal.cat === "web") return "mint";
    return "ghost";
  };

  const statusFor = (signal: Signal) => {
    if (signal.str >= 5) return "TESTANDO";
    if (signal.str >= 4) return "NA FILA";
    return "MONITORANDO";
  };

  return (
    <section className="sec radar-backup" id="radar" ref={radarRef}>
      <div className="radar-section-head rv">
        <div className="radar-head-rule">
          <span>01 /</span>
          <i />
          <small>a notícia é só o ponto de partida — testes e código são o conteúdo</small>
        </div>
        <h2>
          Radar <em>ValdeCoder</em>
        </h2>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="radar-toolbar-row rv">
        <div className="radar-filters">
          {CATS.map((item) => (
            <button
              key={item.id}
              className={activeCat === item.id ? "on" : undefined}
              onClick={() => onSelectCat(item.id)}
            >
              {item.label} <span>{countFor(item.id)}</span>
            </button>
          ))}
        </div>

        <div className="radar-controls">
          {/* Radar Glyph animado com varredura contínua */}
          <div className="radar-glyph-wrap" title="Varredura de radar contínua ativa">
            <RadarGlyph className="radar-glyph-svg" />
            <span className="font-mono text-[9.5px] uppercase leading-tight tracking-[0.2em] hidden sm:inline-block">
              varredura
              <br />
              contínua
            </span>
          </div>

          {/* Campo de Busca */}
          <div className="radar-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="filtrar sinais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar sinais no radar"
            />
            {search && (
              <button className="radar-search-clear" onClick={() => setSearch("")} aria-label="Limpar busca">
                ✕
              </button>
            )}
          </div>

          {/* Ordenação */}
          <select
            className="radar-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "strength")}
            aria-label="Ordenar sinais"
          >
            <option value="recent">Mais Recentes</option>
            <option value="strength">Maior Força (5★)</option>
          </select>
        </div>
      </div>

      {/* Grid de Cards de Sinais */}
      <div className="radar-card-grid">
        {filtered.map((s, i) => (
          <article
            className="radar-card rv"
            data-tone={toneFor(s)}
            key={s.title}
            style={{ transitionDelay: `${(i % 6) * 0.07}s` }}
            onClick={() => onSelectSignal(s)}
            role="button"
            tabIndex={0}
            title="Clique para abrir detalhes e análise completa deste sinal"
          >
            <div className="radar-card-top">
              <div>
                <span className="radar-card-tag">{CATS.find((item) => item.id === s.cat)?.label}</span>
                <span className="radar-card-source">
                  SIG_{String(91 - SIGNALS.indexOf(s)).padStart(3, "0")} · {s.src}
                </span>
              </div>
              <span className="radar-card-status">{statusFor(s)}</span>
            </div>

            <h3>{s.title}</h3>

            <div className="radar-card-why">
              <small>por que achei interessante</small>
              <p>{s.decode.replace("DECODE: ", "")}</p>
            </div>

            <div className="radar-card-foot">
              <div className="radar-card-str">
                <span>força {s.str}/5</span>
                <div className="radar-str-bars">
                  {Array.from({ length: 5 }).map((_, barIdx) => (
                    <i key={barIdx} className={barIdx < s.str ? "lit" : ""} />
                  ))}
                </div>
              </div>
              <div className="radar-card-actions">
                <time>{s.when}</time>
                <span className="radar-card-expand">inspecionar ↗</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="radar-empty-state">
          <p>Nenhum sinal encontrado para o filtro "{search}".</p>
          <button onClick={() => { setSearch(""); onSelectCat("todos"); }}>
            Limpar filtros e ver todos os sinais
          </button>
        </div>
      )}

      {/* A Esteira / Pipeline */}
      <div className="radar-pipeline rv" style={{ transitionDelay: "0.12s" }}>
        <div className="radar-pipeline-head">
          <p>
            <i /> A esteira de produção
          </p>
          <span>todo sinal do radar percorre o mesmo ciclo iterativo</span>
        </div>
        <div className="radar-pipeline-flow">
          {RADAR_PIPELINE.map((step, i) => (
            <Fragment key={step.label}>
              {i > 0 && (
                <div className="radar-connector" aria-hidden="true">
                  <svg viewBox="0 0 56 8" preserveAspectRatio="none" className="w-full h-full">
                    <line x1="0" y1="4" x2="56" y2="4" stroke="var(--line2)" strokeWidth="1.5" strokeDasharray="5 5" className="radar-dash-anim" />
                  </svg>
                  <span className="radar-connector-dot" />
                </div>
              )}
              <div className="radar-pipeline-step">
                <div>
                  <strong>{step.label}</strong>
                  <span>0{i + 1}</span>
                </div>
                <p>{step.count}</p>
                <small>{step.desc}</small>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- modal de sinal ---------------- */

function SignalDetailModal({ signal, onClose }: { signal: Signal; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copySignalText = async () => {
    try {
      await navigator.clipboard.writeText(`[ValdeCoder Radar] ${signal.title}\n${signal.decode}`);
      toast("Análise do sinal copiada com sucesso!");
    } catch {
      toast("Não foi possível copiar automaticamente.", true);
    }
  };

  return (
    <div className="modal-ovl" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog">
      <div className="modal signal-modal">
        <button className="modal-x" onClick={onClose} aria-label="fechar">✕</button>
        <div className="signal-modal-head">
          <span className="signal-modal-cat">{signal.cat.toUpperCase()}</span>
          <span className="signal-modal-src">{signal.src} · {signal.when}</span>
          <span className="signal-modal-str">Força de Sinal: {signal.str}/5</span>
        </div>

        <h3 className="signal-modal-title">{signal.title}</h3>

        <div className="signal-modal-decode">
          <span className="signal-decode-label">⚡ DECODIFICAÇÃO DIRETA</span>
          <p>{signal.decode.replace("DECODE: ", "")}</p>
        </div>

        {signal.fullNote && (
          <div className="signal-modal-note">
            <span className="signal-note-label">🔬 ANÁLISE DE BANCADA / CONTEXTO</span>
            <p>{signal.fullNote}</p>
          </div>
        )}

        <div className="signal-modal-actions">
          <button className="btn" onClick={copySignalText}>
            copiar análise ⧉
          </button>
          {signal.actionUrl && (
            <a className="btn ghost" href={signal.actionUrl} target="_blank" rel="noreferrer">
              pesquisar fontes ↗
            </a>
          )}
          <button className="btn ghost" onClick={onClose}>
            fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- arsenal ---------------- */

interface ArsenalProps {
  onSelectProject: (proj: Project) => void;
}

function Arsenal({ onSelectProject }: ArsenalProps) {
  const [langFilter, setLangFilter] = useState("todos");
  const gridRef = useStagger<HTMLDivElement>([langFilter]);

  const langs = useMemo(() => {
    const s = new Set(PROJECTS.map((p) => p.lang.toLowerCase()));
    return ["todos", ...Array.from(s)];
  }, []);

  const filtered = useMemo(() => {
    if (langFilter === "todos") return PROJECTS;
    return PROJECTS.filter((p) => p.lang.toLowerCase() === langFilter);
  }, [langFilter]);

  const handleCopyInstall = async (e: React.MouseEvent, cmd: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cmd);
      toast(`Comando copiado: ${cmd}`);
    } catch {
      toast("Não foi possível copiar.", true);
    }
  };

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
          Projetos open source nascidos de necessidades reais. Cada card é auditável no GitHub com licenças abertas.
        </p>
      </div>

      {/* Filtros por linguagem */}
      <div className="arsenal-filters rv">
        {langs.map((l) => (
          <button
            key={l}
            className={`arsenal-filter-btn ${langFilter === l ? "on" : ""}`}
            onClick={() => setLangFilter(l)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="proj-grid" ref={gridRef}>
        {filtered.map((p, i) => (
          <div
            key={p.name}
            className="proj rv"
            style={{ gridColumn: p.span, transitionDelay: `${(i % 3) * 0.08}s` }}
            onClick={() => onSelectProject(p)}
            role="button"
            tabIndex={0}
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
              
              <button
                className="proj-copy-cmd"
                onClick={(e) => handleCopyInstall(e, p.installCmd)}
                title={`Copiar: ${p.installCmd}`}
              >
                <code>{p.installCmd.slice(0, 18)}…</code> ⧉
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- modal de projeto ---------------- */

function ProjectDetailModal({ project, onClose }: { project: Project; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(project.installCmd);
      toast(`Comando copiado: ${project.installCmd}`);
    } catch {
      toast("Falha ao copiar", true);
    }
  };

  return (
    <div className="modal-ovl" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog">
      <div className="modal proj-modal">
        <button className="modal-x" onClick={onClose} aria-label="fechar">✕</button>
        <div className="proj-modal-head">
          <span className="proj-modal-status" style={{ borderColor: project.langColor, color: project.langColor }}>
            {project.lang} · {project.status.toUpperCase()}
          </span>
          <span className="proj-modal-stars">★ {project.stars} · ⑂ {project.forks} forks</span>
        </div>

        <h3 className="proj-modal-title">{project.name}</h3>
        <p className="proj-modal-desc">{project.tag}</p>

        <div className="proj-modal-cmd-box">
          <span className="cmd-label">COMANDO DE INSTALAÇÃO // EXECUÇÃO:</span>
          <div className="cmd-row">
            <code>{project.installCmd}</code>
            <button onClick={copyInstall}>copiar ⧉</button>
          </div>
        </div>

        <div className="proj-modal-highlights">
          <h4>Destaques Arquiteturais:</h4>
          <ul>
            {project.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>

        <div className="proj-modal-stack">
          {project.stack.map((s) => (
            <span key={s} className="stack-chip">{s}</span>
          ))}
        </div>

        <div className="modal-actions">
          <a
            className="btn"
            href={`https://github.com/search?q=${encodeURIComponent(project.name)}&type=repositories`}
            target="_blank"
            rel="noreferrer"
          >
            abrir no github ↗
          </a>
          <button className="btn ghost" onClick={onClose}>
            fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- transmissões ---------------- */

function Transmissions({ onPlay }: { onPlay: (v: Video) => void }) {
  const [tagFilter, setTagFilter] = useState("todos");
  const gridRef = useStagger<HTMLDivElement>([tagFilter]);

  const tags = useMemo(() => {
    const s = new Set(VIDEOS.map((v) => v.tagv));
    return ["todos", ...Array.from(s)];
  }, []);

  const filtered = useMemo(() => {
    if (tagFilter === "todos") return VIDEOS;
    return VIDEOS.filter((v) => v.tagv === tagFilter);
  }, [tagFilter]);

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
          Talks, deep dives e streams gravadas direto da bancada do deck.
        </p>
      </div>

      <div className="vid-filter-row rv">
        {tags.map((t) => (
          <button
            key={t}
            className={`vid-filter-btn ${tagFilter === t ? "on" : ""}`}
            onClick={() => setTagFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="vid-grid" ref={gridRef}>
        {filtered.map((v, i) => (
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
      <div className="modal video-player-modal">
        <button className="modal-x" onClick={onClose} aria-label="fechar">
          ✕
        </button>
        <p className="modal-tag">▸ sintonizando canal… // {vid.tagv.toUpperCase()}</p>
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

        {vid.takeaway && (
          <div className="vid-modal-takeaway">
            <strong>Conclusão prática:</strong> {vid.takeaway}
          </div>
        )}

        {vid.chapters && (
          <div className="vid-modal-chapters">
            <h4>Capítulos da transmissão:</h4>
            <ul>
              {vid.chapters.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="vid-modal-footer-note">
          Duração registrada: {vid.dur} · {vid.views} visualizações · gravado em {vid.date}.
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

/* ---------------- uptime hook ---------------- */

const UPTIME_BASE = 47 * 86400 + 12 * 3600 + 33 * 60 + 8;

function useUptime(baseSeconds = UPTIME_BASE) {
  const [seconds, setSeconds] = useState(baseSeconds);
  useEffect(() => {
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/* ---------------- textos & notas de bancada ---------------- */

function Writing() {
  const ref = useStagger<HTMLElement>();
  return (
    <section className="writing-section" id="textos" ref={ref}>
      <div className="writing-inner">
        <div className="radar-section-head rv">
          <div className="radar-head-rule">
            <span>04 /</span>
            <i />
            <small>quando o experimento termina, a conclusão vira texto</small>
          </div>
          <h2>
            Textos &amp; <em>notas de bancada</em>
          </h2>
        </div>

        <div className="writing-list rv">
          {ARTICLES.map((a, i) => (
            <a
              key={a.num}
              href="#textos"
              className="writing-row"
              style={{ transitionDelay: `${i * 0.06}s` }}
              onClick={(e) => {
                e.preventDefault();
                toast(`Artigo "${a.title}" — leitura rápida em rascunho.`);
              }}
            >
              <span className="writing-num">{a.num}</span>
              <div className="writing-main">
                <span className="writing-title">{a.title}</span>
                <span className="writing-excerpt">{a.excerpt}</span>
              </div>
              <span className="writing-tag">{a.tag}</span>
              <span className="writing-date">{a.date}</span>
              <span className="writing-read">{a.read}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="writing-arrow"
                width="16"
                height="16"
              >
                <path d="M6 18 18 6" />
                <path d="M9 6h9v9" />
              </svg>
            </a>
          ))}
        </div>

        <p className="writing-foot-note rv">
          <i /> 5 textos publicados · feed RSS gerado pelo radar-feeds · escrita sem IA-fantasma
        </p>
      </div>
    </section>
  );
}

/* ---------------- na bancada agora (lab) ---------------- */

function Lab() {
  const ref = useStagger<HTMLElement>();
  const uptime = useUptime();
  const totalCommits = COMMIT_WEEK.reduce((s, c) => s + c.n, 0);
  const maxCommits = Math.max(...COMMIT_WEEK.map((c) => c.n));

  return (
    <section className="lab-section" id="lab" ref={ref}>
      <div className="lab-inner">
        <div className="radar-section-head rv">
          <div className="radar-head-rule">
            <span>05 /</span>
            <i />
            <small>o que estou estudando, lendo e medindo nesta semana</small>
          </div>
          <h2>
            Na <em>bancada</em> agora
          </h2>
        </div>

        <div className="lab-grid">
          {/* Card 1: Estudando agora */}
          <div className="lab-card rv">
            <p className="lab-card-title">
              <i /> Estudando agora
            </p>
            <div className="lab-skills-list">
              {SKILLS.map((s) => (
                <div key={s.name} className="lab-skill-item">
                  <div className="lab-skill-head">
                    <span>{s.name}</span>
                    <span className="lab-skill-pct">{s.pct}%</span>
                  </div>
                  <div className="lab-skill-track">
                    <div className="lab-skill-fill" style={{ width: `${s.pct}%` }} />
                  </div>
                  <p className="lab-skill-note">{s.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Lendo agora & Na mira */}
          <div className="lab-card rv" style={{ transitionDelay: "0.1s" }}>
            <p className="lab-card-title" style={{ color: "#f0f1ef" }}>
              <i /> Lendo agora
            </p>
            <div className="lab-book-row">
              <div className="lab-book-3d">
                <span className="lab-book-spine" />
                OSTEP
              </div>
              <div className="lab-book-info">
                <p className="lab-book-title">Operating Systems: Three Easy Pieces</p>
                <p className="lab-book-meta">Arpaci-Dusseau · cap. 14/50</p>
                <div className="lab-book-prog">
                  <div className="lab-book-prog-bar" />
                </div>
                <p className="lab-book-badge">28% — ritmando bem</p>
              </div>
            </div>

            <p className="lab-card-title" style={{ color: "#f0f1ef", marginTop: "28px", marginBottom: "0" }}>
              <i /> Na mira
            </p>
            <ul className="lab-targets-list">
              {LAB_TARGETS.map((t) => (
                <li key={t} className="lab-target-item">
                  <span className="lab-target-diamond" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Card 3: Telemetria do Lab ao vivo */}
          <div className="lab-card rv" style={{ transitionDelay: "0.2s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="lab-card-title" style={{ color: "var(--phos)", margin: 0 }}>
                <span className="lab-live-dot" /> Telemetria do lab
              </p>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">ao vivo</span>
            </div>

            <p className="lab-uptime-label">uptime do servidor</p>
            <p className="lab-uptime-val">{uptime}</p>

            <p className="lab-commits-title">commits · últimos 7 dias</p>
            <div className="commit-histogram">
              {COMMIT_WEEK.map((c) => (
                <div key={c.day} className="commit-bar-col" title={`${c.n} commits na ${c.day}`}>
                  <div className="commit-bar-wrap" style={{ height: `${(c.n / maxCommits) * 52}px` }}>
                    <div className={`commit-bar-fill ${c.n === maxCommits ? "max" : ""}`} style={{ height: "100%" }} />
                  </div>
                  <span className="commit-bar-day">{c.day}</span>
                </div>
              ))}
            </div>

            <div className="lab-stats-trio">
              <div className="lab-stat-box">
                <p className="lab-stat-val">{totalCommits}</p>
                <p className="lab-stat-lbl">commits/sem</p>
              </div>
              <div className="lab-stat-box">
                <p className="lab-stat-val">28</p>
                <p className="lab-stat-lbl">cafés</p>
              </div>
              <div className="lab-stat-box">
                <p className="lab-stat-val">12</p>
                <p className="lab-stat-lbl">issues fechadas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- sobre ---------------- */

function About() {
  const aboutRef = useStagger<HTMLDivElement>();
  const [activeYear, setActiveYear] = useState("2026");

  return (
    <section className="about-backup" id="sobre">
      <div className="about-backup-inner" ref={aboutRef}>
        <div className="about-head rv">
          <div className="about-head-line">
            <span>06 /</span>
            <i />
            <small>identidade, stack e a linha do tempo até aqui</small>
          </div>
          <h2>Quem está atrás do <em>radar</em></h2>
        </div>

        <div className="about-layout">
          <div className="about-media rv">
            <div className="about-portrait-wrap">
              <div className="about-portrait-offset" aria-hidden="true" />
              <div className="about-portrait scanlines">
                <img src="assets/images/avatar.png" alt="Retrato do Valde" loading="lazy" />
              </div>
              <div className="about-badge">
                <svg viewBox="0 0 100 100">
                  <defs>
                    <path id="about-badge-circle" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" fill="none" />
                  </defs>
                  <text>
                    <textPath href="#about-badge-circle">DISPONÍVEL PARA COLABS · OPEN SOURCE ·</textPath>
                  </text>
                </svg>
                <TerminalGlyph className="about-terminal" />
              </div>
            </div>
            <p className="about-online"><span /> online — responde em ~24h</p>
          </div>

          <div className="about-copy">
            <div className="rv">
              <p className="about-lead">
                Sou o <strong>Valde</strong> — programador, curioso profissional e o cara que não consegue ler uma manchete de
                tecnologia sem querer testar a afirmação no próprio hardware. Este hub é meu espaço na internet: tudo que entra
                pelo Radar sai como experimento, código, vídeo ou texto.
              </p>
              <p>
                De dia trabalho com infra e devtools; de noite mantenho o homelab, gravo pro canal e escrevo o que aprendi do
                jeito que eu queria ter aprendido. Se envolve Linux, Rust ou um ferro de solda, provavelmente tem um pull
                request meu no meio.
              </p>
              <p className="about-compiler">// compilando desde 2016 — sem warnings</p>
            </div>

            <div className="about-facts rv">
              {ABOUT_FACTS.map(([key, value]) => (
                <div key={key}><small>{key}</small><span>{value}</span></div>
              ))}
            </div>

            <div className="about-stack rv">
              <p>stack do dia a dia</p>
              <div>
                {ABOUT_STACK.map((item) => (
                  <span
                    key={item}
                    onClick={() => toast(`Tecnologia: ${item} — utilizada em projetos do deck.`)}
                    title="Clique para ver detalhes"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Linha do tempo interativa */}
            <div className="about-timeline rv">
              {ABOUT_TIMELINE.map((item) => (
                <div
                  key={item.y}
                  className={`timeline-item ${activeYear === item.y ? "active" : ""}`}
                  onClick={() => setActiveYear(item.y)}
                >
                  <i />
                  <strong>{item.y}</strong>
                  <p>{item.t}</p>
                  {activeYear === item.y && item.desc && (
                    <small className="timeline-desc">{item.desc}</small>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- footer ---------------- */

function Footer() {
  const ftrRef = useStagger<HTMLElement>();
  const toTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer id="contato" className="ftr" ref={ftrRef}>
      <div className="ftr-contact-wrap">
        <div className="rv">
          <p className="ftr-kicker">contato</p>
          <div className="ftr-contact-row">
            <h2 className="ftr-heading">
              Bora construir algo <span className="text-outline">juntos?</span>
            </h2>
            <div className="ftr-actions">
              <a
                href="mailto:contato@valdecoder.dev"
                className="ftr-btn-mail"
              >
                contato@valdecoder.dev
              </a>
              <div className="ftr-social-row">
                <a
                  href="https://github.com/valdecoder"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub ↗
                </a>
                <a
                  href="https://www.youtube.com/@valdecoder"
                  target="_blank"
                  rel="noreferrer"
                >
                  YouTube ↗
                </a>
                <a
                  href="https://x.com/valdecoder"
                  target="_blank"
                  rel="noreferrer"
                >
                  X ↗
                </a>
                <a href="#textos">
                  RSS
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ftr-base">
        <span>© 2026 ValdeCoder — feito com Arch, café e teimosia</span>
        <span>v4.2.0 · three.js r169 · zero rastreadores</span>
        <button onClick={toTop} className="ftr-to-top">
          voltar ao topo ↑
        </button>
      </div>
    </footer>
  );
}

/* ---------------- painel FX com presets ---------------- */

function FxPanel({
  fx,
  setFx,
  god,
  onGod,
  foldRef,
  foldReady,
  onPreset,
}: {
  fx: FxSettings;
  setFx: (f: FxSettings) => void;
  god: boolean;
  onGod: () => void;
  foldRef: { current: HTMLDivElement | null };
  foldReady: boolean;
  onPreset: (key: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 860
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 860px)");
    let currentDesktop = media.matches;
    let resizeFrame = 0;
    const sync = () => {
      const nextDesktop = media.matches;
      if (nextDesktop === currentDesktop) return;
      currentDesktop = nextDesktop;
      setOpen(nextDesktop);
    };

    setOpen(currentDesktop);
    media.addEventListener("change", sync);
    const onResize = () => {
      sync();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        sync();
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    const fold = foldRef.current;
    const ticker = fold?.querySelector<HTMLElement>(".ticker");
    if (!foldReady || !panel || !fold || !ticker) return;

    let frame = 0;
    const syncFoldOffset = () => {
      const foldRect = fold.getBoundingClientRect();
      const tickerRect = ticker.getBoundingClientRect();
      const panelStyles = getComputedStyle(panel);
      const baseBottom = Number.parseFloat(panelStyles.bottom) || 0;
      const baseBottomEdge = window.innerHeight - baseBottom;
      const foldInViewport = foldRect.top < window.innerHeight && foldRect.bottom > 0;
      const tickerInViewport = tickerRect.top >= 0 && tickerRect.bottom > 0 && tickerRect.top < window.innerHeight;

      const shift = foldInViewport && tickerInViewport
        ? Math.max(0, baseBottomEdge - tickerRect.top)
        : 0;
      panel.style.setProperty("--fx-fold-shift", `${shift}px`);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncFoldOffset();
      });
    };
    const observer = new ResizeObserver(syncFoldOffset);
    observer.observe(fold);
    observer.observe(ticker);
    observer.observe(panel);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", syncFoldOffset);
    syncFoldOffset();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncFoldOffset);
      panel.style.removeProperty("--fx-fold-shift");
    };
  }, [foldReady, foldRef, open]);

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
    <div className="fx-panel" ref={panelRef}>
      <button className="fx-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>fx_deck {open ? "▾" : "▸"}</span>
        <span className="led" />
      </button>
      {open && (
        <div className="fx-body">
          {/* Presets Rápidos */}
          <div className="fx-presets-wrap">
            <span className="fx-presets-label">Presets Rápidos:</span>
            <div className="fx-presets-grid">
              {Object.entries(FX_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  className="fx-preset-btn"
                  onClick={() => onPreset(key)}
                  title={p.label}
                >
                  <span>{p.icon}</span>
                  <small>{p.label}</small>
                </button>
              ))}
            </div>
          </div>

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

/* ---------------- command palette (Ctrl+K) ---------------- */

function CommandPaletteModal({
  onClose,
  onNavigate,
  onToggleCrt,
  onToggleGod,
  onPreset,
  onSelectSignal,
  onSelectProject,
  onSelectVideo,
}: {
  onClose: () => void;
  onNavigate: (id: string) => void;
  onToggleCrt: () => void;
  onToggleGod: () => void;
  onPreset: (p: string) => void;
  onSelectSignal: (s: Signal) => void;
  onSelectProject: (p: Project) => void;
  onSelectVideo: (v: Video) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.toLowerCase().trim();

  const matchingSignals = useMemo(() => {
    if (!q) return SIGNALS.slice(0, 3);
    return SIGNALS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.cat.toLowerCase().includes(q) ||
        s.decode.toLowerCase().includes(q)
    ).slice(0, 4);
  }, [q]);

  const matchingProjects = useMemo(() => {
    if (!q) return PROJECTS.slice(0, 3);
    return PROJECTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.lang.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q)
    ).slice(0, 4);
  }, [q]);

  const matchingVideos = useMemo(() => {
    if (!q) return VIDEOS.slice(0, 2);
    return VIDEOS.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.tagv.toLowerCase().includes(q)
    ).slice(0, 3);
  }, [q]);

  return (
    <div className="modal-ovl cmd-ovl" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog">
      <div className="modal cmd-palette">
        <div className="cmd-input-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite para buscar sinais, projetos, vídeos ou comandos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cmd-esc-tag" onClick={onClose}>ESC</kbd>
        </div>

        <div className="cmd-results">
          {/* Navegação Rápida */}
          <div className="cmd-group">
            <span className="cmd-group-title">NAVEGAÇÃO RÁPIDA</span>
            <button className="cmd-item" onClick={() => onNavigate("topo")}>
              <span>⚡ Voltar ao Topo</span>
              <kbd>#topo</kbd>
            </button>
            <button className="cmd-item" onClick={() => onNavigate("radar")}>
              <span>📡 Radar de Tecnologia ({SIGNALS.length} sinais)</span>
              <kbd>#radar</kbd>
            </button>
            <button className="cmd-item" onClick={() => onNavigate("arsenal")}>
              <span>🖲️ Arsenal de Projetos Open Source</span>
              <kbd>#arsenal</kbd>
            </button>
            <button className="cmd-item" onClick={() => onNavigate("transmissoes")}>
              <span>▶ Transmissões e Talks Gravadas</span>
              <kbd>#transmissoes</kbd>
            </button>
            <button className="cmd-item" onClick={() => onNavigate("sobre")}>
              <span>👤 Sobre o Valde e Setup</span>
              <kbd>#sobre</kbd>
            </button>
          </div>

          {/* Sinais */}
          {matchingSignals.length > 0 && (
            <div className="cmd-group">
              <span className="cmd-group-title">SINAIS DO RADAR</span>
              {matchingSignals.map((s) => (
                <button key={s.title} className="cmd-item" onClick={() => onSelectSignal(s)}>
                  <span className="cmd-item-main">
                    <small className="cmd-tag">{s.cat.toUpperCase()}</small>
                    <span className="truncate">{s.title}</span>
                  </span>
                  <span className="cmd-arrow">↗</span>
                </button>
              ))}
            </div>
          )}

          {/* Projetos */}
          {matchingProjects.length > 0 && (
            <div className="cmd-group">
              <span className="cmd-group-title">PROJETOS OPEN SOURCE</span>
              {matchingProjects.map((p) => (
                <button key={p.name} className="cmd-item" onClick={() => onSelectProject(p)}>
                  <span className="cmd-item-main">
                    <small className="cmd-tag">{p.lang}</small>
                    <span className="truncate">{p.name} — {p.tag.slice(0, 45)}...</span>
                  </span>
                  <span className="cmd-arrow">↗</span>
                </button>
              ))}
            </div>
          )}

          {/* Transmissões */}
          {matchingVideos.length > 0 && (
            <div className="cmd-group">
              <span className="cmd-group-title">VÍDEOS E TRANSMISSÕES</span>
              {matchingVideos.map((v) => (
                <button key={v.title} className="cmd-item" onClick={() => onSelectVideo(v)}>
                  <span className="cmd-item-main">
                    <small className="cmd-tag">{v.dur}</small>
                    <span className="truncate">{v.title}</span>
                  </span>
                  <span className="cmd-arrow">▶</span>
                </button>
              ))}
            </div>
          )}

          {/* Ações Rápidas do Deck */}
          <div className="cmd-group">
            <span className="cmd-group-title">CONTROLES DO DECK</span>
            <button className="cmd-item" onClick={() => { onClose(); onToggleCrt(); }}>
              <span>📟 Alternar Modo CRT (Scanlines)</span>
              <kbd>CRT</kbd>
            </button>
            <button className="cmd-item" onClick={() => { onClose(); onToggleGod(); }}>
              <span>🌈 Alternar God Mode (Espectro Colorido)</span>
              <kbd>GOD</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
