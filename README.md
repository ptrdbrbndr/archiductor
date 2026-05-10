# Archiductor

> AI-augmented multi-language enterprise modeling — viewer, editor en multi-agent peer-review voor ArchiMate, BPMN, CMMN, DMN en UML.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Status

🚧 **Pre-alpha** — onder actieve ontwikkeling. Productie-positionering, architectuur en roadmap zien op:

- **Productpositionering**: <https://archiductor.archiductus.nl> (apex landing)
- **Architectuur**: [`archiductus.nl/docs/archiductor/ARCHITECTURE.md`](https://github.com/ptrdbrbndr/archiductus.nl/blob/staging/docs/archiductor/ARCHITECTURE.md)
- **Multi-language scope**: [ADR 0005](https://github.com/ptrdbrbndr/archiductus.nl/blob/staging/docs/adr/0005-archiductor-stack-en-multi-language-scope.md)
- **Repo-strategie**: [ADR 0006](https://github.com/ptrdbrbndr/archiductus.nl/blob/staging/docs/adr/0006-archimate-js-aparte-repo.md)

## Repo-structuur

Monorepo met npm workspaces:

```text
archiductor/
├── packages/
│   ├── archimate-js/           # ArchiMate 3.2 + 4.0 viewer/modeler op diagram-js (M1)
│   ├── uml-js/                 # UML 2.5 subset (Fase 4 — niet aanwezig nog)
│   └── cross-language/         # Cross-language linking meta-model (Fase 5 — niet aanwezig nog)
└── apps/
    └── (toekomstig — Archiductor-tool wanneer uit archiductus.nl gesplitst)
```

Elke package heeft eigen build, tests en publishable scope. De Archiductor-Next.js-applicatie zit op dit moment nog als sub-route binnen [archiductus.nl](https://github.com/ptrdbrbndr/archiductus.nl) (M0 fundament + M1-week-1 in uitvoering); splitsing naar `apps/web` volgt zodra het product loskomt van de marketing-site.

## Development

```bash
npm install              # installeer alle workspaces
npm run build            # build alle packages
npm test                 # vitest in alle packages
npm run typecheck        # tsc --noEmit in alle packages

# Werken aan één package:
npm -w packages/archimate-js run dev
npm -w packages/archimate-js test
```

## Bijdragen

Per package — zie elk package's eigen `CONTRIBUTING.md`. Voor monorepo-architectuur of cross-package vragen: open een issue in deze repo.

## License

MIT — zie [LICENSE](LICENSE). `ArchiMate®`, `BPMN®`, `CMMN®`, `DMN®`, `UML®` zijn handelsmerken van The Open Group / OMG. Dit project implementeert hun open standaarden, is geen onderdeel van of goedgekeurd door deze organisaties.
