# Bijdragen aan archimate-js

Dank dat je een bijdrage overweegt!

## Issues

Voor bug-rapporten of feature-requests: open een issue op <https://github.com/ptrdbrbndr/archimate-js/issues>. Vermeld bij bugs:

- ArchiMate-versie van het bron-bestand (3.2 / 4.0)
- Browser + versie (waar relevant)
- Reproduceerbaar voorbeeld of `.xml`-fragment dat het probleem triggert

## Pull requests

1. Fork de repo en maak een feature-branch (`git checkout -b feature/mijn-aanpassing`)
2. Schrijf tests onder `test/` voor je wijziging (vitest)
3. Run `npm test` en `npm run typecheck` lokaal — moeten beide groen zijn
4. Open een PR met heldere omschrijving: wat verandert er, waarom, en welke ArchiMate-spec-sectie het raakt

## Architectuur-conventies

- **Eén renderer-module per ArchiMate-laag** (`src/render/business.ts`, etc.)
- **Eén connection-renderer per relatie-type** (`src/render/connections/composition.ts`, etc.)
- **didi DI-pattern voor module-export** (volg `bpmn-js` / `cmmn-js` als referentie)
- **Geen DOM-manipulatie buiten `tiny-svg`** — gebruik altijd `svgCreate` / `svgAttr` / `svgAppend` voor consistente SVG-output

## Specs

- ArchiMate 3.2: <https://pubs.opengroup.org/architecture/archimate3-doc/>
- ArchiMate 4.0: <https://pubs.opengroup.org/architecture/archimate4-doc/>
- Open Exchange Format XSD: zie `Specifications/` op pubs.opengroup.org

## License

Door bij te dragen ga je akkoord dat je werk onder de [MIT-licentie](LICENSE) wordt vrijgegeven.
