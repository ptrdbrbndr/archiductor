# Handover: archimate-mcp implementatie

## Context

Je neemt de implementatie over van `packages/archimate-mcp` in het archiductor-monorepo (`c:\Projecten\archiductor`). Design en plan zijn volledig uitgewerkt en goedgekeurd. Jouw taak is puur uitvoering.

## Wat er al is

- **Monorepo**: `c:\Projecten\archiductor` (npm workspaces, Node.js 20, TypeScript 5, vitest, tsup)
- **Bestaand package**: `packages/archimate-js` — ArchiMate viewer op diagram-js (pre-alpha M1, raak dit niet aan)
- **Design spec**: `docs/superpowers/specs/2026-05-12-archimate-mcp-design.md`
- **Implementatieplan**: `docs/superpowers/plans/2026-05-12-archimate-mcp.md` ← **dit is je werkdocument**

## Wat je gaat bouwen

`packages/archimate-mcp` — een stateless remote HTTP/SSE MCP-server:
- Leest ArchiMate-modellen (OEF XML + `.archimate`) uit Supabase
- Exposed 15 MCP-tools (8 read, 7 write) voor Claude
- JWT-auth scoped op `model_id`, dubbel beveiligd met Supabase RLS
- Draait op Beelink 1 via Coolify + CF Tunnel op `mcp.archiductus.nl`

## Werkwijze

Gebruik de **`superpowers:subagent-driven-development`** skill om het plan taak-voor-taak uit te voeren. Het plan bevat exacte bestandspaden, volledige code per stap, en verwachte testoutput — volg het letterlijk.

**Commits**: na elke taak committen met de commit message uit het plan. Nooit pushen zonder expliciete instructie.

**Tests**: TDD — schrijf de test eerst, verifieer dat hij faalt, implementeer dan, verifieer dat hij slaagt. Sla geen stap over.

## Sleutelbeslissingen (niet heroverwegen)

1. **Eigen lichte parser** in archimate-mcp — geen dependency op archimate-js (browser-deps)
2. **Stateless per request** — elk tool-aanroep fetcht model opnieuw uit Supabase
3. **OEF XML** is canonieke opslagvorm; `.archimate` wordt genormaliseerd bij import
4. **AsyncLocalStorage** (`src/tools/context.ts`) om auth header te threaden naar tool handlers
5. **CoArchi folder-tree** is fase 2 — MVP ondersteunt alleen `.archimate` single-file
6. **`crypto.randomUUID()`** voor ID-generatie (Node.js 20 built-in, geen nanoid dep)

## Stack

```
@modelcontextprotocol/sdk  — HTTP/SSE MCP server
fast-xml-parser            — OEF + .archimate XML parsing
jose                       — JWT verify
@supabase/supabase-js      — storage (service role)
vitest                     — tests
tsup                       — build (ESM only, platform: node)
```

## Start

```bash
cd c:\Projecten\archiductor
cat docs/superpowers/plans/2026-05-12-archimate-mcp.md
```

Begin bij Task 1 (package scaffold) en werk sequentieel door naar Task 16.
