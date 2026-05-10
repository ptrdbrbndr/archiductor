# archimate-js-react

> React-componenten bovenop [`archimate-js`](../archimate-js): ModelExplorer (tree-view), PropertiesPane, ViewerCanvas.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

## Status

🚧 **Pre-alpha** — onderdeel van Archiductor M1-mijlpaal (mei 2026). API niet stabiel tot eerste tagged release.

## Componenten

### `<ModelExplorer>`

Tree-view links van de canvas. Toont alle elementen van een `ArchiModel`, gegroepeerd per ArchiMate-laag. Klikbaar → highlight in canvas.

```tsx
import { ModelExplorer } from "archimate-js-react";
import { parseOpenExchange } from "archimate-js";

const model = parseOpenExchange(oefXml);

<ModelExplorer
  model={model}
  selectedElementId={selected}
  onSelectElement={(id) => setSelected(id)}
/>;
```

### `<PropertiesPane>` (M1.1+)

### `<ViewerCanvas>` (M1.1+)

## Dependencies

Peer:
- `react` 18+/19+
- `react-dom` 18+/19+
- `archimate-js` ^0.0.1

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```

## License

MIT — zie [LICENSE](../../LICENSE).
