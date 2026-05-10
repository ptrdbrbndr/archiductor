# archimate-js

> ArchiMate® 3.2 + 4.0 viewer en modeler op `diagram-js` — in patroon van [bpmn-js](https://github.com/bpmn-io/bpmn-js), [cmmn-js](https://github.com/bpmn-io/cmmn-js), [dmn-js](https://github.com/bpmn-io/dmn-js).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Status

🚧 **Pre-alpha** — onder actieve ontwikkeling als onderdeel van [Archiductor](https://archiductor.archiductus.nl) M1-mijlpaal (mei 2026). Zie [Archiductor SESSION-HANDOVER](https://github.com/ptrdbrbndr/archiductus.nl/blob/staging/docs/archiductor/SESSION-HANDOVER.md) voor publieke voortgang.

API is **niet stabiel** tot eerste stable release (M3, juli 2026 doel).

## Wat is het

`archimate-js` voegt ArchiMate-rendering toe aan [`diagram-js`](https://github.com/bpmn-io/diagram-js), Camunda's diagram-engine. Het volgt het patroon dat `bpmn-js`, `cmmn-js` en `dmn-js` ook gebruiken: één modeleer-taal als laag bovenop diagram-js' generieke graph-engine.

```ts
import { Viewer } from 'archimate-js';

const viewer = new Viewer({
  container: '#archimate-canvas'
});

await viewer.importXML(archiMateOpenExchangeXml);
viewer.fit();
```

## Roadmap

- **M1 — viewer (in progress)**: 7 ArchiMate-laag-renderers, 11 connection-renderers, OEF 3.2 + 4.0 parser, pan/zoom/minimap.
- **M4 — modeler**: element toevoegen/verwijderen, relatie tekenen, properties bewerken, undo/redo.
- **M5+ — CoArchi git interop**: lezen vanuit Archi's `.archimate`/CoArchi-folder-tree.

## Waarom een eigen package

Geen volwassen npm-package dekt ArchiMate 4.0; bestaande packages (3.x) zijn hobby-projecten zonder onderhoud. `archimate-js` geeft eigen TypeScript-types die 1-op-1 matchen met de OEF XSD, controle over de 3.2→4.0 migratie-laag, en directe integratie met diagram-js' standaard API zodat consumers de hele bpmn-io ecosysteem (modeling, palette, context-pad, properties-panel) kunnen hergebruiken.

## Gebruik in een React-app (Next.js)

`archimate-js` is framework-agnostisch — werkt in elke browser-omgeving die ES2020+ ondersteunt. Voor React/Next.js: importeer dynamisch in een `useEffect`-mount om SSR te vermijden.

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function ArchiMateCanvas({ xml }: { xml: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let viewer: { destroy?: () => void } | null = null;
    (async () => {
      const { Viewer } = await import('archimate-js');
      const v = new Viewer({ container: ref.current });
      await v.importXML(xml);
      v.get('canvas').zoom('fit-viewport');
      viewer = v;
    })();
    return () => viewer?.destroy?.();
  }, [xml]);

  return <div ref={ref} style={{ height: 480, width: '100%' }} />;
}
```

## Development

```bash
npm install
npm run build       # tsup dual ESM+CJS
npm test            # vitest
npm run typecheck   # tsc --noEmit
```

## Dependencies

- [`diagram-js`](https://github.com/bpmn-io/diagram-js) — graph-engine (peer-dep, MIT)
- [`tiny-svg`](https://github.com/bpmn-io/tiny-svg) — SVG helpers (peer-dep, MIT)
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) — OEF parser (dep, MIT)

## Bijdragen

Zie [CONTRIBUTING.md](CONTRIBUTING.md). Issues en PRs welkom.

## License

MIT — zie [LICENSE](LICENSE).

`ArchiMate®` is een geregistreerd handelsmerk van The Open Group. Dit project is geen onderdeel van of goedgekeurd door The Open Group; het implementeert de ArchiMate-specificatie als open standaard.
