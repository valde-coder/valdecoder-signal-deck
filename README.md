# VALDECODER // SIGNAL DECK

Um personal tech hub experimental com estética phosphor-future: radar de sinais,
arsenal de projetos, transmissões, clocks multi-fuso e uma camada 3D interativa.
Foi construído pelo Qwen Coder através de um **Gauntlet Loop** (build → crítica
cega → refinamento) e integrado no GitHub por Hermes Agent.

## Experiência

- Campo 3D com shader próprio, partículas reativas, bloom e controles persistidos
- Boot transparente, decode/scramble de títulos, cursor customizado e hover magnético
- Radar pesquisável com filtros de Linux, IA, hardware, dev e segurança
- Arsenal de projetos e transmissões com modais, equalizador e links funcionais
- Relógios SP/Berlim/Tóquio, uptime, ticker duplo e contador de pacotes
- Konami code para GOD MODE + modo CRT com scanlines e vinheta
- Layout responsivo com navegação mobile e suporte a `prefers-reduced-motion`

## Executar localmente

```bash
npm ci
npm run typecheck
npm run dev
```

Abra `http://localhost:3000`.

## Publicação

O deploy é feito automaticamente pelo GitHub Actions após cada push em `main`.
A aplicação pública fica em:

**https://valde-coder.github.io/valdecoder-signal-deck/**

## Gauntlet Loop

O resultado foi avaliado em duas rodadas. A rodada 1 recebeu 7,0 em impacto e
6,5 em microinterações; a rodada 2 corrigiu ambos para 9,0 e 8,5. As demais
dimensões ficaram entre 8,5 e 9,0. O build final passou no typecheck e no Vite.
