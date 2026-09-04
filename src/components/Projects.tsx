import { PROJECTS, type Project } from "../data/content";
import { ArrowUpRight, CardTilt, cx, Reveal, SectionHead, StarGlyph, StatusBadge, TagChip } from "./ui";

function ProjectCard({ p, span, delay }: { p: Project; span: string; delay: number }) {
  const isMint = p.statusTone === "mint";
  return (
    <Reveal delay={delay} duration={230} className={span}>
      <CardTilt
        glowColor={isMint ? "mint" : "volt"}
        className="h-full"
        maxTilt={6.5}
        scale={1.015}
      >
        <a
          href={p.repo}
          target="_blank"
          rel="noreferrer"
          className={cx(
            "group relative flex h-full flex-col border border-line bg-panel transition-all duration-200 ease-out",
            "hover:-translate-y-1 hover:border-volt/70",
            isMint
              ? "hover:border-mint/70 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85),0_0_35px_-10px_rgba(59,224,143,0.25)]"
              : "hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85),0_0_35px_-10px_rgba(255,217,28,0.25)]",
          )}
          style={{ transformStyle: "preserve-3d" }}
          data-cursor
        >
          {/* Image & floating overlays with depth */}
          <div
            className={cx("relative overflow-hidden", p.featured ? "aspect-[16/10]" : "aspect-[16/9]")}
            style={{ transform: "translateZ(14px)", transformStyle: "preserve-3d" }}
          >
            <img
              src={p.img}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
            <span
              className="absolute left-3 top-3 bg-ink/75 px-2.5 py-1 font-mono text-[10px] tracking-[0.2em] text-bone/90 backdrop-blur-sm transition-transform duration-200"
              style={{ transform: "translateZ(26px)" }}
            >
              {p.code}
            </span>
            <span
              className="absolute right-3 top-3 transition-transform duration-200"
              style={{ transform: "translateZ(26px)" }}
            >
              <StatusBadge label={p.status} tone={p.statusTone} />
            </span>
          </div>

          {/* Content with layered parallax depth */}
          <div className="flex flex-1 flex-col p-5 md:p-6" style={{ transformStyle: "preserve-3d" }}>
            <div className="flex items-start justify-between gap-3" style={{ transform: "translateZ(18px)" }}>
              <h3 className="font-display text-xl font-bold tracking-tight transition-colors duration-150 group-hover:text-volt">
                {p.name}
              </h3>
              <span className="flex items-center gap-1.5 font-mono text-xs text-fog">
                <StarGlyph className="h-3.5 w-3.5 text-volt" />
                {p.stars}
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-fog" style={{ transform: "translateZ(12px)" }}>
              {p.desc}
            </p>

            {/* Depth layer on tags with micro-interactive TagChips */}
            <div className="mt-4 flex flex-wrap gap-2" style={{ transform: "translateZ(22px)" }}>
              {p.tags.map((t) => (
                <TagChip key={t}>{t}</TagChip>
              ))}
            </div>

            <div
              className="mt-auto flex items-center justify-between border-t border-line pt-5 font-mono text-[10px] uppercase tracking-[0.15em]"
              style={{ transform: "translateZ(16px)" }}
            >
              <span className="text-fog">github.com/valdecoder</span>
              <span className="flex items-center gap-1.5 text-volt transition-all duration-200 group-hover:gap-3">
                abrir repo
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </div>
        </a>
      </CardTilt>
    </Reveal>
  );
}

export default function Projects() {
  const spans = ["md:col-span-7", "md:col-span-5", "md:col-span-5", "md:col-span-7"];
  return (
    <section id="projetos" className="relative scroll-mt-20 border-t border-line bg-coal/40 py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-40" />
      <div className="relative mx-auto max-w-7xl px-5 md:px-10">
        <SectionHead
          index="02 /"
          title={
            <>
              Projetos &amp; <span className="text-volt">código aberto</span>
            </>
          }
          note="o que sobreviveu ao radar e virou software de verdade"
        />
        <div className="grid gap-5 md:grid-cols-12">
          {PROJECTS.map((p, i) => (
            <ProjectCard key={p.code} p={p} span={spans[i]} delay={i * 35} />
          ))}
        </div>
      </div>
    </section>
  );
}
