export const IMG = {
  avatar: "assets/images/avatar.png",
  projHomelab: "assets/images/project-homelab.png",
  projClipdeck: "assets/images/project-clipdeck.png",
  projDotfiles: "assets/images/project-dotfiles.png",
  projRadar: "assets/images/project-radar.png",
  vidEp42: "assets/images/video-ep42.png",
  vidEp41: "assets/images/video-ep41.png",
  vidEp40: "assets/images/video-ep40.png",
  vidEp39: "assets/images/video-ep39.png",
} as const;

export const NAV_LINKS = [
  ["Radar", "#radar"],
  ["Projetos", "#projetos"],
  ["Vídeos", "#videos"],
  ["Textos", "#textos"],
  ["Lab", "#lab"],
  ["Sobre", "#sobre"],
] as const;

export const TICKER = [
  "RADAR ATIVO — 14 SINAIS/MÊS",
  "NOVO VÍDEO · EP 042 — HOMELAB COM PI 5",
  "TESTANDO · KERNEL 6.12 LTS + RUST",
  "LIVRO NA MESA · OSTEP, CAP. 14",
  "UPTIME DO LAB · 47 DIAS",
  "DOTFILES · 1.2K STARS NO GITHUB",
  "PRÓXIMO EXPERIMENTO · SEXTA, 20H",
];

export type Tone = "volt" | "mint" | "ghost";

export interface RadarItem {
  id: string;
  tag: string;
  tone: Tone;
  status: string;
  statusTone: Tone;
  title: string;
  source: string;
  date: string;
  why: string;
  next: string;
}

export const RADAR_TAGS = ["Tudo", "Linux", "IA", "Hardware", "Dev", "Segurança"] as const;

export const RADAR_ITEMS: RadarItem[] = [
  {
    id: "SIG_091",
    tag: "Linux",
    tone: "mint",
    status: "TESTANDO",
    statusTone: "volt",
    title: "Kernel 6.12 vira LTS — e o suporte a Rust avança de novo",
    source: "LKML · Phoronix",
    date: "há 2 dias",
    why: "Rust no kernel deixou de ser experimento de nicho. Quero medir o tempo de compilação com rustc habilitado na minha máquina e comparar com a build pura em C — se a diferença for menor que 15%, não tem mais desculpa.",
    next: "→ vai virar benchmark no canal",
  },
  {
    id: "SIG_090",
    tag: "IA",
    tone: "volt",
    status: "NA FILA",
    statusTone: "ghost",
    title: "Modelo local de 3B de parâmetros rodando liso em 8 GB de RAM",
    source: "Hugging Face · comunidade",
    date: "há 3 dias",
    why: "Se roda no meu notebook de 2015 reformado, roda no servidor do canal. A ideia é plugar um assistente local no meu fluxo de edição: transcrição, cortes e capítulos sem mandar áudio pra nuvem.",
    next: "→ experimento agendado pra sexta",
  },
  {
    id: "SIG_089",
    tag: "Hardware",
    tone: "volt",
    status: "NO VÍDEO",
    statusTone: "mint",
    title: "Raspberry Pi 5 com boot NVMe direto, sem gambiarra",
    source: "CNX Software · Jeff Geerling",
    date: "há 5 dias",
    why: "Fim do adaptador USB improvisado: com o HAT oficial, o Pi 5 pula de brinquedo pra servidor de verdade. Subi o homelab inteiro nele e o I/O mudou o jogo pro Postgres.",
    next: "→ EP 042 já está no ar",
  },
  {
    id: "SIG_088",
    tag: "Dev",
    tone: "mint",
    status: "TESTANDO",
    statusTone: "volt",
    title: "Bun 1.3 promete compatibilidade quase total com Node",
    source: "changelog oficial",
    date: "há 1 semana",
    why: "Migrei um projeto pessoal numa tarde e a DX é absurda. Mas quero ver o comportamento com dependências nativas pesadas (sharp, sqlite3) antes de recomendar pra qualquer pessoa.",
    next: "→ artigo em rascunho (60%)",
  },
  {
    id: "SIG_087",
    tag: "Linux",
    tone: "mint",
    status: "PUBLICADO",
    statusTone: "mint",
    title: "Wayland finalmente estável no meu setup NVIDIA",
    source: "release notes driver 555+",
    date: "há 2 semanas",
    why: "Depois de três anos de 'quase lá', o explicit sync resolveu o tearing de vez. Documentei cada passo da migração — do kernel ao Hyprland — porque eu queria ter lido isso em 2022.",
    next: "→ texto publicado na seção Textos",
  },
  {
    id: "SIG_086",
    tag: "Segurança",
    tone: "volt",
    status: "NA FILA",
    statusTone: "ghost",
    title: "Ataques de supply chain em pacotes npm cresceram 3x no ano",
    source: "relatório Socket.dev",
    date: "há 2 semanas",
    why: "É o tipo de coisa que ninguém quer auditar até ser tarde. Vou montar um pipeline simples de revisão de lockfile + pin de versões nos meus projetos abertos e publicar como template.",
    next: "→ vira template público no GitHub",
  },
];

export const PIPELINE = [
  { label: "RADAR", count: "14 sinais/mês", desc: "notícia filtrada" },
  { label: "EXPERIMENTO", count: "3 ativos", desc: "teste de bancada" },
  { label: "PROJETO", count: "2 em produção", desc: "código aberto" },
  { label: "VÍDEO", count: "1 por semana", desc: "processo gravado" },
  { label: "ARTIGO", count: "2 por mês", desc: "conclusão escrita" },
];

export interface Project {
  code: string;
  name: string;
  desc: string;
  img: string;
  tags: string[];
  stars: string;
  status: string;
  statusTone: Tone;
  repo: string;
  featured?: boolean;
}

export const PROJECTS: Project[] = [
  {
    code: "PRJ_01",
    name: "valde.lab",
    desc: "Homelab inteiro como código: Proxmox, Pi 5 com NVMe, Grafana pra métricas e scripts que se auto-recuperam. Se cair, eu fico sabendo antes da minha família notar que o Wi-Fi morreu.",
    img: IMG.projHomelab,
    tags: ["Proxmox", "Grafana", "Bash", "Ansible"],
    stars: "342",
    status: "EM PRODUÇÃO",
    statusTone: "mint",
    repo: "https://github.com/valdecoder/valde-lab",
    featured: true,
  },
  {
    code: "PRJ_02",
    name: "clipdeck",
    desc: "Gerenciador local de clipes de vídeo pra quem edita conteúdo: atalhos de teclado, busca por tag e export direto pro OBS. Tauri por fora, Rust por dentro.",
    img: IMG.projClipdeck,
    tags: ["Tauri", "Rust", "SQLite"],
    stars: "218",
    status: "ATIVO",
    statusTone: "volt",
    repo: "https://github.com/valdecoder/clipdeck",
  },
  {
    code: "PRJ_03",
    name: "radar-feeds",
    desc: "O agregador que alimenta esta página: puxa RSS/Atom, deduplica com hash de conteúdo e cospe o Radar em JSON. Dogfooding total — você está lendo o output dele agora.",
    img: IMG.projRadar,
    tags: ["Rust", "HTMX", "RSS"],
    stars: "129",
    status: "ATIVO",
    statusTone: "volt",
    repo: "https://github.com/valdecoder/radar-feeds",
  },
  {
    code: "PRJ_04",
    name: "dotfiles",
    desc: "Neovim, tmux, Hyprland e zsh do jeito que eu gosto. Um único comando instala tudo em máquina nova — já formatou 14 máquinas de amigos que pediram 'igualzinho ao seu'.",
    img: IMG.projDotfiles,
    tags: ["Neovim", "Lua", "Hyprland"],
    stars: "1.2k",
    status: "MANUTENÇÃO",
    statusTone: "ghost",
    repo: "https://github.com/valdecoder/dotfiles",
  },
];

export interface Video {
  ep: string;
  title: string;
  desc: string;
  thumb: string;
  duration: string;
  views: string;
  date: string;
}

export const VIDEOS: Video[] = [
  {
    ep: "EP 042",
    title: "Montei um homelab com Raspberry Pi 5 — e virou servidor de verdade",
    desc: "Boot NVMe sem gambiarra, Proxmox, Grafana e um Postgres que finalmente aguenta o tranco. O radar sobre o HAT oficial virou projeto completo.",
    thumb: IMG.vidEp42,
    duration: "24:18",
    views: "12,4 mil",
    date: "há 3 dias",
  },
  {
    ep: "EP 041",
    title: "Rust no kernel Linux: compilei, testei e medi a diferença",
    desc: "Kernel 6.12 com suporte a Rust habilitado: quanto custa compilar, o que muda no boot e se vale a pena hoje.",
    thumb: IMG.vidEp41,
    duration: "18:05",
    views: "8,4 mil",
    date: "há 2 semanas",
  },
  {
    ep: "EP 040",
    title: "IA local num notebook de 2015: dá pra confiar?",
    desc: "Modelo de 3B parâmetros, 8 GB de RAM e zero nuvem. Testei transcrição, resumo e código — com números.",
    thumb: IMG.vidEp40,
    duration: "15:42",
    views: "6,1 mil",
    date: "há 1 mês",
  },
  {
    ep: "EP 039",
    title: "Meu setup Wayland + NVIDIA em 2026 (sem sofrimento)",
    desc: "Do driver 555+ ao Hyprland: o passo a passo da migração que eu queria ter assistido três anos atrás.",
    thumb: IMG.vidEp39,
    duration: "12:30",
    views: "9,8 mil",
    date: "há 1 mês",
  },
];

export const UP_NEXT = [
  { title: "eBPF na prática: observabilidade sem agent", from: "vem do radar SIG_084", when: "EP 043 · semana que vem" },
  { title: "Bun vs Node num projeto de verdade", from: "vem do radar SIG_088", when: "EP 044 · em gravação" },
  { title: "Auditoria de supply chain em 30 min", from: "vem do radar SIG_086", when: "EP 045 · roteirizando" },
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
    num: "05",
    title: "O que o boot NVMe do Pi 5 muda no meu homelab",
    excerpt: "Números reais de I/O antes e depois do HAT — e por que aposentei o SSD USB.",
    tag: "INFRA",
    date: "12 FEV 26",
    read: "8 min",
  },
  {
    num: "04",
    title: "Compilando o kernel com Rust: números de verdade",
    excerpt: "Tempo de build, tamanho da imagem e comportamento no boot, medidos no mesmo hardware.",
    tag: "LINUX",
    date: "28 JAN 26",
    read: "12 min",
  },
  {
    num: "03",
    title: "Bun vs Node num projeto com 400 dependências",
    excerpt: "Migrei, medi e quase reverti. O que funcionou, o que quebrou e o que aprendi.",
    tag: "DEV",
    date: "15 JAN 26",
    read: "6 min",
  },
  {
    num: "02",
    title: "Wayland + NVIDIA: o guia que eu queria ter lido",
    excerpt: "Explicit sync, Hyprland e os três anos de tearing que poderiam ter sido três semanas.",
    tag: "LINUX",
    date: "03 JAN 26",
    read: "10 min",
  },
  {
    num: "01",
    title: "Como organizar um radar sem virar agregador",
    excerpt: "O método por trás desta página: sinal, opinião, teste — e quando descartar uma notícia.",
    tag: "PROCESSO",
    date: "18 DEZ 25",
    read: "5 min",
  },
];

export const SKILLS = [
  { name: "Rust — async & lifetimes sem medo", pct: 62, note: "meta: radar-feeds v2" },
  { name: "Three.js & shaders WebGL", pct: 45, note: "o header deste site é a prova" },
  { name: "eBPF & observabilidade", pct: 22, note: "próximo vídeo do canal" },
  { name: "Kubernetes (rumo à CKA)", pct: 38, note: "labs no homelab" },
];

export const COMMIT_WEEK = [
  { day: "SEG", n: 5 },
  { day: "TER", n: 8 },
  { day: "QUA", n: 3 },
  { day: "QUI", n: 12 },
  { day: "SEX", n: 6 },
  { day: "SÁB", n: 9 },
  { day: "DOM", n: 14 },
];

export const FACTS = [
  ["BASE", "Curitiba, BR — remoto"],
  ["FOCO", "infra · devtools · linux"],
  ["EDITOR", "Neovim, obviamente"],
  ["DISTRO", "Arch (btw)"],
  ["CANAL DESDE", "2020 · 42 episódios"],
  ["CAFÉ/DIA", "4 doses, sem açúcar"],
] as const;

export const TIMELINE = [
  { y: "2016", t: "Primeiro hello world em C, num Pentium 4 do tio" },
  { y: "2018", t: "Blog técnico — escrevendo pra aprender de verdade" },
  { y: "2020", t: "Canal no YouTube: EP 001 no ar, 47 views" },
  { y: "2022", t: "Homelab v1 + canal passa de 100 mil views" },
  { y: "2024", t: "Radar ValdeCoder: o método vira sistema" },
  { y: "2026", t: "Você está aqui — hub v4.2 no ar" },
];

export const STACK = [
  "TypeScript",
  "Rust",
  "Go",
  "Linux",
  "Docker",
  "PostgreSQL",
  "Three.js",
  "Neovim",
  "Grafana",
  "Ansible",
];

export const YT_CHANNEL = "https://www.youtube.com/@valdecoder";
